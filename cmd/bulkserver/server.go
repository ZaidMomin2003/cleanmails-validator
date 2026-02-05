package main

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"errors"
	"io"
	"log"
	"math"
	"math/rand"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	emailverifier "github.com/AfterShip/email-verifier"
)

type Server struct {
	cfg  Config
	jobs *JobManager

	level1Sem chan struct{}
	level2Sem chan struct{}
	rateCh    chan struct{}
	reqCount  uint64
	mxCache   sync.Map // cache for *emailverifier.Mx
}

type VerifyRequest struct {
	Email string `json:"email"`
	Level int    `json:"level"`
}

type BulkRequest struct {
	Emails        []string `json:"emails"`
	Level         int      `json:"level"`
	Concurrency   int      `json:"concurrency"`
	StoreResults  *bool    `json:"store_results"`
	CallbackURL   string   `json:"callback_url"`
	CallbackBatch int      `json:"callback_batch"`
}

type BulkResponse struct {
	ID    string `json:"id"`
	Total int    `json:"total"`
}

type BulkStatusResponse struct {
	Job *Job `json:"job"`
}

type ResultsResponse struct {
	JobID   string        `json:"job_id"`
	Offset  int           `json:"offset"`
	Limit   int           `json:"limit"`
	Total   int           `json:"total"`
	Results []EmailResult `json:"results"`
}

func NewServer(cfg Config) *Server {
	s := &Server{
		cfg:       cfg,
		jobs:      NewJobManager(cfg.ResultTTL),
		level1Sem: make(chan struct{}, cfg.Level1Concurrency),
		level2Sem: make(chan struct{}, cfg.Level2Concurrency),
		rateCh:    make(chan struct{}, 1000),
	}
	go s.startRateLimiter()
	return s
}

func (s *Server) startRateLimiter() {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for range ticker.C {
		rate := s.cfg.ValidationRate
		jitter := s.cfg.RateJitter

		offset := rate * jitter
		variation := (r.Float64() * 2 * offset) - offset
		count := int(math.Round(rate + variation))

		if count < 1 {
			count = 1
		}

		for i := 0; i < count; i++ {
			select {
			case s.rateCh <- struct{}{}:
			default:
			}
		}
	}
}

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/v1/verify", s.handleVerify)
	mux.HandleFunc("/v1/bulk", s.handleBulk)
	mux.HandleFunc("/v1/bulk/", s.handleBulkByID)
	// Robust Static File Path Searching
	cwd, _ := os.Getwd()
	log.Printf("[Init] Current Working Directory: %s", cwd)

	possiblePaths := []string{
		filepath.Join(cwd, "public"),
		"./public",
		"public",
	}

	var publicPath string
	for _, p := range possiblePaths {
		if _, err := os.Stat(filepath.Join(p, "index.html")); err == nil {
			publicPath = p
			log.Printf("[Init] FOUND static assets at: %s", p)
			break
		}
	}

	if publicPath == "" {
		log.Printf("[ERROR] Could not find 'public/index.html' in many locations. Static UI will 404.")
		publicPath = "./public" // fallback
	}

	fs := http.FileServer(http.Dir(publicPath))
	mux.Handle("/", fs)

	return mux
}

func (s *Server) getNextLocalIP() string {
	if len(s.cfg.LocalIPs) == 0 {
		return ""
	}
	idx := atomic.AddUint64(&s.reqCount, 1) % uint64(len(s.cfg.LocalIPs))
	return s.cfg.LocalIPs[idx]
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleNetworkCheck(w http.ResponseWriter, r *http.Request) {
	// Try to dial a common SMTP server on port 25 to check if host blocks it
	conn, err := net.DialTimeout("tcp", "gmail-smtp-in.l.google.com:25", 3*time.Second)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"port25": false,
			"error":  err.Error(),
		})
		return
	}
	conn.Close()
	writeJSON(w, http.StatusOK, map[string]interface{}{"port25": true})
}

func (s *Server) handleVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
		return
	}
	var req VerifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" {
		writeError(w, http.StatusBadRequest, "email_required")
		return
	}
	level := normalizeLevel(req.Level)
	if level == 0 {
		writeError(w, http.StatusBadRequest, "invalid_level")
		return
	}

	res, err := s.newVerifier(level).Verify(req.Email)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleBulk(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
		return
	}

	emails, level, concurrency, storeResults, callbackURL, callbackBatch, err := s.parseBulkRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if len(emails) == 0 {
		writeError(w, http.StatusBadRequest, "emails_required")
		return
	}
	if len(emails) > s.cfg.MaxEmails {
		writeError(w, http.StatusBadRequest, "emails_limit_exceeded")
		return
	}

	sort.Slice(emails, func(i, j int) bool {
		di := ""
		if idx := strings.LastIndex(emails[i], "@"); idx != -1 {
			di = emails[i][idx+1:]
		}
		dj := ""
		if idx := strings.LastIndex(emails[j], "@"); idx != -1 {
			dj = emails[j][idx+1:]
		}
		return di < dj
	})

	job := s.jobs.CreateJob(level, len(emails), storeResults)
	go s.runJob(job, emails, concurrency, callbackURL, callbackBatch)

	writeJSON(w, http.StatusAccepted, BulkResponse{ID: job.ID, Total: job.Total})
}

func (s *Server) handleBulkByID(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/v1/bulk/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusNotFound, "not_found")
		return
	}
	id := parts[0]

	job, ok := s.jobs.GetJob(id)
	if !ok {
		writeError(w, http.StatusNotFound, "job_not_found")
		return
	}

	if len(parts) == 1 {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
			return
		}
		writeJSON(w, http.StatusOK, BulkStatusResponse{Job: job.snapshot()})
		return
	}

	if len(parts) == 2 && parts[1] == "results" {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
			return
		}
		if !job.storeResultsEnabled() {
			writeError(w, http.StatusGone, "results_not_stored")
			return
		}
		offset, limit := parseOffsetLimit(r)
		results, total := job.getResults(offset, limit)
		writeJSON(w, http.StatusOK, ResultsResponse{
			JobID:   job.ID,
			Offset:  offset,
			Limit:   limit,
			Total:   total,
			Results: results,
		})
		return
	}

	if len(parts) == 2 && parts[1] == "download" {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method_not_allowed")
			return
		}
		if !job.storeResultsEnabled() {
			writeError(w, http.StatusGone, "results_not_stored")
			return
		}
		s.writeCSV(w, job)
		return
	}

	writeError(w, http.StatusNotFound, "not_found")
}

func (s *Server) runJob(job *Job, emails []string, concurrency int, callbackURL string, callbackBatch int) {
	job.markRunning()

	if concurrency <= 0 {
		concurrency = s.cfg.DefaultJobConcurrency
	}
	if concurrency > len(emails) {
		concurrency = len(emails)
	}
	if concurrency <= 0 {
		concurrency = 1
	}

	jobsCh := make(chan string)
	var wg sync.WaitGroup

	var callback *CallbackSender
	if callbackURL != "" {
		if callbackBatch <= 0 {
			callbackBatch = 200
		}
		callback = NewCallbackSender(callbackURL, callbackBatch)
		callback.Start(job.ID)
	}

	worker := func() {
		defer wg.Done()
		vInfra := s.newVerifier(1)

		for email := range jobsCh {
			if job.Level == 2 {
				<-s.rateCh
			}

			syntax := vInfra.ParseAddress(email)
			if !syntax.Valid {
				result := EmailResult{Email: email, Result: &emailverifier.Result{Email: email, Syntax: syntax, Reachable: "no"}}
				job.addResult(result)
				if callback != nil {
					callback.Enqueue(result)
				}
				inc(&job.Done)
				continue
			}

			// Check MX Cache
			var mx *emailverifier.Mx
			if val, ok := s.mxCache.Load(syntax.Domain); ok {
				mx = val.(*emailverifier.Mx)
			} else {
				mx, _ = vInfra.CheckMX(syntax.Domain)
				if mx != nil {
					s.mxCache.Store(syntax.Domain, mx)
				}
			}

			var res *emailverifier.Result
			var err error

			cachedCatchAll, found := job.getCatchAll(syntax.Domain)

			if job.Level == 1 {
				res = &emailverifier.Result{
					Email:        email,
					Syntax:       syntax,
					Disposable:   vInfra.IsDisposable(syntax.Domain),
					Free:         vInfra.IsFreeDomain(syntax.Domain),
					HasMxRecords: mx != nil && mx.HasMXRecord,
					Reachable:    "unknown",
				}
				if mx == nil || !mx.HasMXRecord {
					res.Reachable = "no"
				}
			} else if found && cachedCatchAll {
				res = &emailverifier.Result{
					Email:        email,
					Syntax:       syntax,
					Disposable:   vInfra.IsDisposable(syntax.Domain),
					Free:         vInfra.IsFreeDomain(syntax.Domain),
					HasMxRecords: true,
					SMTP: &emailverifier.SMTP{
						HostExists:  true,
						CatchAll:    true,
						Deliverable: false,
					},
					Reachable: "unknown",
				}
			} else {
				vJob := s.newVerifier(2)
				res, err = vJob.Verify(email)
				if err == nil && res.SMTP != nil && res.SMTP.CatchAll {
					job.setCatchAll(syntax.Domain, true)
				}
			}

			if err != nil {
				inc(&job.Failed)
				result := EmailResult{Email: email, Error: err.Error()}
				job.addResult(result)
				if callback != nil {
					callback.Enqueue(result)
				}
			} else {
				result := EmailResult{Email: email, Result: res}
				job.addResult(result)
				if callback != nil {
					callback.Enqueue(result)
				}
			}
			inc(&job.Done)
		}
	}

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go worker()
	}

	for _, email := range emails {
		jobsCh <- email
	}
	close(jobsCh)
	wg.Wait()

	if callback != nil {
		callback.Close(true)
	}
	job.markCompleted()
}

func (s *Server) newVerifier(level int) *emailverifier.Verifier {
	verifier := emailverifier.NewVerifier().
		ConnectTimeout(s.cfg.SMTPConnectTimeout).
		OperationTimeout(s.cfg.SMTPOperationTimeout).
		FromEmail(s.cfg.SMTPFromEmail).
		HelloName(s.cfg.SMTPHelloName)

	if level == 2 {
		verifier.LocalAddr(s.getNextLocalIP())
		verifier.EnableSMTPCheck()
		if !s.cfg.SMTPCatchAll {
			verifier.DisableCatchAllCheck()
		}
	}

	return verifier
}

func (s *Server) parseBulkRequest(r *http.Request) ([]string, int, int, bool, string, int, error) {
	ct := r.Header.Get("Content-Type")
	if strings.HasPrefix(ct, "application/json") || ct == "" {
		var req BulkRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			return nil, 0, 0, false, "", 0, errors.New("invalid_json")
		}
		level := normalizeLevel(req.Level)
		if level == 0 {
			return nil, 0, 0, false, "", 0, errors.New("invalid_level")
		}
		emails := normalizeEmails(req.Emails)
		storeResults := s.cfg.StoreResults
		if req.StoreResults != nil {
			storeResults = *req.StoreResults
		}
		return emails, level, req.Concurrency, storeResults, req.CallbackURL, req.CallbackBatch, nil
	}

	if strings.HasPrefix(ct, "text/csv") {
		emails, err := readCSVEmails(r.Body)
		if err != nil {
			return nil, 0, 0, false, "", 0, err
		}
		level := normalizeLevel(parseQueryInt(r.URL.Query().Get("level"), 1))
		if level == 0 {
			return nil, 0, 0, false, "", 0, errors.New("invalid_level")
		}
		concurrency := parseQueryInt(r.URL.Query().Get("concurrency"), 0)
		return emails, level, concurrency, s.cfg.StoreResults, "", 0, nil
	}

	return nil, 0, 0, false, "", 0, errors.New("unsupported_content_type")
}

func normalizeLevel(level int) int {
	if level == 0 {
		level = 1
	}
	if level != 1 && level != 2 {
		return 0
	}
	return level
}

func normalizeEmails(emails []string) []string {
	out := make([]string, 0, len(emails))
	for _, e := range emails {
		e = strings.TrimSpace(e)
		if e == "" {
			continue
		}
		out = append(out, e)
	}
	return out
}

func readCSVEmails(r io.Reader) ([]string, error) {
	reader := csv.NewReader(bufio.NewReader(r))
	var emails []string
	headerChecked := false
	emailIndex := -1

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, errors.New("invalid_csv")
		}
		if !headerChecked {
			headerChecked = true
			for i, col := range record {
				if strings.EqualFold(strings.TrimSpace(col), "email") {
					emailIndex = i
					break
				}
			}
			if emailIndex >= 0 {
				continue
			}
			emailIndex = 0
		}
		if emailIndex < len(record) {
			email := strings.TrimSpace(record[emailIndex])
			if email != "" {
				emails = append(emails, email)
			}
		}
	}
	return emails, nil
}

func parseOffsetLimit(r *http.Request) (int, int) {
	q := r.URL.Query()
	offset := parseQueryInt(q.Get("offset"), 0)
	limit := parseQueryInt(q.Get("limit"), 1000)
	if limit > 5000 {
		limit = 5000
	}
	if offset < 0 {
		offset = 0
	}
	return offset, limit
}

func parseQueryInt(v string, def int) int {
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func (s *Server) writeCSV(w http.ResponseWriter, job *Job) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=results.csv")

	writer := csv.NewWriter(w)
	_ = writer.Write([]string{
		"email",
		"reachable",
		"syntax_valid",
		"syntax_username",
		"syntax_domain",
		"disposable",
		"role_account",
		"free",
		"has_mx_records",
		"suggestion",
		"smtp_host_exists",
		"smtp_full_inbox",
		"smtp_catch_all",
		"smtp_deliverable",
		"smtp_disabled",
	})

	results, _ := job.getResults(0, int(^uint(0)>>1))
	for _, r := range results {
		if r.Result == nil {
			_ = writer.Write([]string{r.Email, "", "", "", "", "", "", "", "", "", "", "", "", "", ""})
			continue
		}
		res := r.Result
		smtp := res.SMTP
		writer.Write([]string{
			res.Email,
			res.Reachable,
			strconv.FormatBool(res.Syntax.Valid),
			res.Syntax.Username,
			res.Syntax.Domain,
			strconv.FormatBool(res.Disposable),
			strconv.FormatBool(res.RoleAccount),
			strconv.FormatBool(res.Free),
			strconv.FormatBool(res.HasMxRecords),
			res.Suggestion,
			formatBoolPtr(smtp, func(s *emailverifier.SMTP) bool { return s.HostExists }),
			formatBoolPtr(smtp, func(s *emailverifier.SMTP) bool { return s.FullInbox }),
			formatBoolPtr(smtp, func(s *emailverifier.SMTP) bool { return s.CatchAll }),
			formatBoolPtr(smtp, func(s *emailverifier.SMTP) bool { return s.Deliverable }),
			formatBoolPtr(smtp, func(s *emailverifier.SMTP) bool { return s.Disabled }),
		})
	}
	writer.Flush()
}

func formatBoolPtr(smtp *emailverifier.SMTP, f func(*emailverifier.SMTP) bool) string {
	if smtp == nil {
		return ""
	}
	return strconv.FormatBool(f(smtp))
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}
