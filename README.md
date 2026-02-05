# Cleanmails - Professional Email Validation Engine

Cleanmails is a high-performance, self-hosted email validation and hygiene engine designed for marketers, founders, and sales teams. It provides deep-level verification to ensure your emails reach the inbox while protecting your sender reputation.

## 🚀 Key Features

- **Phase 1: Basic Analysis (Near-Instant)**
  - Syntax check (RFC compliant)
  - MX Record lookup
  - Disposable email detection (100k+ blocklist)
  - Role-based email detection (info@, admin@, etc.)
  - Free provider detection (Gmail, Yahoo, etc.)

- **Phase 2: Deep SMTP Handshake**
  - Real-time mailbox verification
  - Catch-all domain detection
  - Greylisting detection
  - SMTP server response verification

- **Enterprise Ready**
  - High concurrency bulk processing (100k+ emails per session)
  - Single email verification API
  - Comprehensive dashboard with visualized data
  - Self-hosted for 100% data privacy

## 📊 Performance Statistics

- **Phase 1 Speed:** 10,000+ emails per minute
- **Phase 2 Speed:** 50-100 emails per second (network dependent)
- **Accuracy Rate:** >98.5% on standard SMTP checks
- **Blocklist Update:** Daily sync of disposable domains

## 🛠 Self-Hosting Requirements

- **CPU:** 1 Core (Minimum) / 4 Cores (Recommended for Bulk)
- **RAM:** 2GB (Minimum) / 8GB (Recommended for 100k+ lists)
- **Network:** Outbound Port 25 must be open for SMTP Handshakes.

## 💻 API Integration

Cleanmails provides a simple REST API for integrating into your existing sign-up flows or CRM systems.

```bash
# Verify single email
curl -X POST http://YOUR_IP:8080/v1/verify \
     -H "Content-Type: application/json" \
     -d '{"email": "user@example.com", "level": 1}'
```

---
© 2026 Cleanmails. All rights reserved.
