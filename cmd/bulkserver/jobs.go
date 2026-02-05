package main

import (
    "crypto/rand"
    "encoding/hex"
    "sync"
    "sync/atomic"
    "time"

    emailverifier "github.com/AfterShip/email-verifier"
)

type JobStatus string

const (
    JobQueued    JobStatus = "queued"
    JobRunning   JobStatus = "running"
    JobCompleted JobStatus = "completed"
    JobFailed    JobStatus = "failed"
)

type EmailResult struct {
    Email  string                   `json:"email"`
    Result *emailverifier.Result    `json:"result,omitempty"`
    Error  string                   `json:"error,omitempty"`
}

type Job struct {
    ID            string    `json:"id"`
    Level         int       `json:"level"`
    Total         int       `json:"total"`
    Done          int64     `json:"done"`
    Failed        int64     `json:"failed"`
    Status        JobStatus `json:"status"`
    CreatedAt     time.Time `json:"created_at"`
    StartedAt     *time.Time `json:"started_at,omitempty"`
    FinishedAt    *time.Time `json:"finished_at,omitempty"`
    Error         string    `json:"error,omitempty"`
    StoreResults  bool      `json:"store_results"`

    mu       sync.RWMutex
    results  []EmailResult
    domains  map[string]bool
}

type JobManager struct {
    mu          sync.RWMutex
    jobs        map[string]*Job
    resultTTL   time.Duration
}

func NewJobManager(resultTTL time.Duration) *JobManager {
    jm := &JobManager{
        jobs:         make(map[string]*Job),
        resultTTL:    resultTTL,
    }
    go jm.cleanupLoop()
    return jm
}

func (jm *JobManager) CreateJob(level int, total int, storeResults bool) *Job {
    job := &Job{
        ID:           newJobID(),
        Level:        level,
        Total:        total,
        Status:       JobQueued,
        CreatedAt:    time.Now().UTC(),
        StoreResults: storeResults,
        domains:      make(map[string]bool),
    }
    jm.mu.Lock()
    jm.jobs[job.ID] = job
    jm.mu.Unlock()
    return job
}

func (jm *JobManager) GetJob(id string) (*Job, bool) {
    jm.mu.RLock()
    job, ok := jm.jobs[id]
    jm.mu.RUnlock()
    return job, ok
}

func (jm *JobManager) DeleteJob(id string) {
    jm.mu.Lock()
    delete(jm.jobs, id)
    jm.mu.Unlock()
}

func (j *Job) addResult(res EmailResult) {
    if !j.StoreResults {
        return
    }
    j.mu.Lock()
    j.results = append(j.results, res)
    j.mu.Unlock()
}

func (j *Job) getResults(offset, limit int) ([]EmailResult, int) {
    j.mu.RLock()
    defer j.mu.RUnlock()
    total := len(j.results)
    if offset > total {
        return []EmailResult{}, total
    }
    end := offset + limit
    if end > total {
        end = total
    }
    return append([]EmailResult(nil), j.results[offset:end]...), total
}

func (j *Job) markRunning() {
    now := time.Now().UTC()
    j.mu.Lock()
    j.Status = JobRunning
    j.StartedAt = &now
    j.mu.Unlock()
}

func (j *Job) markCompleted() {
    now := time.Now().UTC()
    j.mu.Lock()
    j.Status = JobCompleted
    j.FinishedAt = &now
    j.mu.Unlock()
}

func (j *Job) markFailed(err error) {
    now := time.Now().UTC()
    j.mu.Lock()
    j.Status = JobFailed
    j.FinishedAt = &now
    if err != nil {
        j.Error = err.Error()
    }
    j.mu.Unlock()
}

func (j *Job) snapshot() *Job {
    j.mu.RLock()
    copy := &Job{
        ID:           j.ID,
        Level:        j.Level,
        Total:        j.Total,
        Status:       j.Status,
        CreatedAt:    j.CreatedAt,
        StartedAt:    j.StartedAt,
        FinishedAt:   j.FinishedAt,
        Error:        j.Error,
        StoreResults: j.StoreResults,
    }
    j.mu.RUnlock()
    copy.Done = atomic.LoadInt64(&j.Done)
    copy.Failed = atomic.LoadInt64(&j.Failed)
    return copy
}

func (j *Job) storeResultsEnabled() bool {
    j.mu.RLock()
    defer j.mu.RUnlock()
    return j.StoreResults
}

func (jm *JobManager) cleanupLoop() {
    ticker := time.NewTicker(1 * time.Minute)
    defer ticker.Stop()
    for range ticker.C {
        jm.cleanup()
    }
}

func (jm *JobManager) cleanup() {
    if jm.resultTTL <= 0 {
        return
    }
    cutoff := time.Now().UTC().Add(-jm.resultTTL)
    var toDelete []string

    jm.mu.RLock()
    for id, job := range jm.jobs {
        if job.isExpired(cutoff) {
            toDelete = append(toDelete, id)
        }
    }
    jm.mu.RUnlock()

    if len(toDelete) == 0 {
        return
    }
    jm.mu.Lock()
    for _, id := range toDelete {
        delete(jm.jobs, id)
    }
    jm.mu.Unlock()
}

func (j *Job) isExpired(cutoff time.Time) bool {
    j.mu.RLock()
    defer j.mu.RUnlock()
    if j.FinishedAt == nil {
        return false
    }
    return j.FinishedAt.Before(cutoff)
}

func newJobID() string {
    b := make([]byte, 16)
    _, _ = rand.Read(b)
    return hex.EncodeToString(b)
}

func (j *Job) setCatchAll(domain string, isCatchAll bool) {
    j.mu.Lock()
    defer j.mu.Unlock()
    j.domains[domain] = isCatchAll
}

func (j *Job) getCatchAll(domain string) (bool, bool) {
    j.mu.RLock()
    defer j.mu.RUnlock()
    val, ok := j.domains[domain]
    return val, ok
}

func inc(ptr *int64) {
    atomic.AddInt64(ptr, 1)
}
