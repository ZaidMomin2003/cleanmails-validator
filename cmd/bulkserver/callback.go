package main

import (
    "bytes"
    "encoding/json"
    "log"
    "net/http"
    "sync"
    "time"
)

type CallbackSender struct {
    url       string
    batchSize int
    client    *http.Client

    jobID string
    ch    chan EmailResult
    wg    sync.WaitGroup
}

type CallbackPayload struct {
    JobID   string        `json:"job_id"`
    Results []EmailResult `json:"results"`
    Final   bool          `json:"final"`
}

func NewCallbackSender(url string, batchSize int) *CallbackSender {
    return &CallbackSender{
        url:       url,
        batchSize: batchSize,
        client: &http.Client{
            Timeout: 30 * time.Second,
        },
        ch: make(chan EmailResult, batchSize*2),
    }
}

func (c *CallbackSender) Start(jobID string) {
    c.jobID = jobID
    c.wg.Add(1)
    go c.loop()
}

func (c *CallbackSender) Enqueue(res EmailResult) {
    c.ch <- res
}

func (c *CallbackSender) Close(final bool) {
    close(c.ch)
    c.wg.Wait()
    if final {
        c.postPayload(CallbackPayload{JobID: c.jobID, Results: []EmailResult{}, Final: true})
    }
}

func (c *CallbackSender) loop() {
    defer c.wg.Done()
    batch := make([]EmailResult, 0, c.batchSize)
    for res := range c.ch {
        batch = append(batch, res)
        if len(batch) >= c.batchSize {
            c.postPayload(CallbackPayload{JobID: c.jobID, Results: batch})
            batch = make([]EmailResult, 0, c.batchSize)
        }
    }
    if len(batch) > 0 {
        c.postPayload(CallbackPayload{JobID: c.jobID, Results: batch})
    }
}

func (c *CallbackSender) postPayload(payload CallbackPayload) {
    body, err := json.Marshal(payload)
    if err != nil {
        return
    }
    req, err := http.NewRequest(http.MethodPost, c.url, bytes.NewReader(body))
    if err != nil {
        return
    }
    req.Header.Set("Content-Type", "application/json")

    resp, err := c.client.Do(req)
    if err != nil {
        log.Printf("callback error: %v", err)
        return
    }
    _ = resp.Body.Close()
}
