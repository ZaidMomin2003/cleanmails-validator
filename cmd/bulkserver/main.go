package main

import (
    "log"
    "net/http"
)

func main() {
    cfg := LoadConfig()
    server := NewServer(cfg)

    httpServer := &http.Server{
        Addr:         cfg.Addr,
        Handler:      server.routes(),
        ReadTimeout:  cfg.ReadTimeout,
        WriteTimeout: cfg.WriteTimeout,
    }

    log.Printf("bulkserver listening on %s", cfg.Addr)
    if err := httpServer.ListenAndServe(); err != nil {
        log.Fatalf("server error: %v", err)
    }
}
