# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ .
RUN npm run build

# Stage 2: Build the Go backend
FROM golang:1.22-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN cd cmd/bulkserver && CGO_ENABLED=0 GOOS=linux go build -v -o /app/bulkserver .

# Stage 3: Final production image
FROM alpine:latest
# Install curl for reliable healthchecks
RUN apk --no-cache add ca-certificates curl
WORKDIR /app
COPY --from=frontend-builder /app/web/dist ./public
COPY --from=backend-builder /app/bulkserver .

RUN chmod +x ./bulkserver

ENV ADDR=:8080
EXPOSE 8080

# More standard healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:8080/health || exit 1

CMD ["./bulkserver"]
