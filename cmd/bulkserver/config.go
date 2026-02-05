package main

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr                  string
	ReadTimeout           time.Duration
	WriteTimeout          time.Duration
	MaxEmails             int
	ResultTTL             time.Duration
	StoreResults          bool
	Level1Concurrency     int
	Level2Concurrency     int
	DefaultJobConcurrency int
	ValidationRate        float64
	RateJitter            float64
	LocalIPs              []string

	SMTPConnectTimeout   time.Duration
	SMTPOperationTimeout time.Duration
	SMTPFromEmail        string
	SMTPHelloName        string
	SMTPCatchAll         bool
}

func LoadConfig() Config {
	return Config{
		Addr:                  getEnvString("ADDR", ":8080"),
		ReadTimeout:           getEnvDuration("READ_TIMEOUT", 30*time.Second),
		WriteTimeout:          getEnvDuration("WRITE_TIMEOUT", 30*time.Second),
		MaxEmails:             getEnvInt("MAX_EMAILS", 100000),
		ResultTTL:             getEnvDuration("RESULT_TTL", 15*time.Minute),
		StoreResults:          getEnvBool("STORE_RESULTS", true),
		Level1Concurrency:     getEnvInt("LEVEL1_CONCURRENCY", 1000),
		Level2Concurrency:     getEnvInt("LEVEL2_CONCURRENCY", 100),
		DefaultJobConcurrency: getEnvInt("JOB_CONCURRENCY", 200),
		ValidationRate:        getEnvFloat("VALIDATION_RATE", 20.0),
		RateJitter:            getEnvFloat("RATE_JITTER", 0.1),
		LocalIPs:              getEnvStringSlice("LOCAL_IPS", []string{}),

		SMTPConnectTimeout:   getEnvDuration("SMTP_CONNECT_TIMEOUT", 10*time.Second),
		SMTPOperationTimeout: getEnvDuration("SMTP_OPERATION_TIMEOUT", 10*time.Second),
		SMTPFromEmail:        getEnvString("SMTP_FROM_EMAIL", "user@example.org"),
		SMTPHelloName:        getEnvString("SMTP_HELO_NAME", "localhost"),
		SMTPCatchAll:         getEnvBool("SMTP_CATCH_ALL", true),
	}
}

func getEnvString(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func getEnvBool(key string, def bool) bool {
	if v := os.Getenv(key); v != "" {
		switch v {
		case "1", "true", "TRUE", "yes", "YES", "y", "Y":
			return true
		case "0", "false", "FALSE", "no", "NO", "n", "N":
			return false
		}
	}
	return def
}

func getEnvDuration(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}
func getEnvStringSlice(key string, def []string) []string {
	if v := os.Getenv(key); v != "" {
		parts := strings.Split(v, ",")
		for i := range parts {
			parts[i] = strings.TrimSpace(parts[i])
		}
		return parts
	}
	return def
}

func getEnvFloat(key string, def float64) float64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil {
			return n
		}
	}
	return def
}
