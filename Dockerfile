FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ .
RUN npm run build

FROM golang:1.21-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-builder /app/web/dist ./public
RUN CGO_ENABLED=0 GOOS=linux go build -o bulkserver ./cmd/bulkserver

# ... (Previous stages remain same)

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=backend-builder /app/bulkserver .
COPY --from=backend-builder /app/public ./public

# Ensure binary is executable
RUN chmod +x ./bulkserver

ENV ADDR=:8080
EXPOSE 8080

# Basic health check for Docker/Coolify
HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["./bulkserver"]
