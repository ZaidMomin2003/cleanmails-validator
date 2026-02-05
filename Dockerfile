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
# Copy dependencies first for caching
COPY go.mod go.sum ./
RUN go mod download
# Copy the rest of the source code
COPY . .
# Explicitly build the binary from the cmd/bulkserver directory
RUN cd cmd/bulkserver && CGO_ENABLED=0 GOOS=linux go build -v -o /app/bulkserver .

# Stage 3: Final production image
FROM alpine:latest
RUN apk --no-cache add ca-certificates wget
WORKDIR /app
# Copy the frontend build to the backend's expected directory
COPY --from=frontend-builder /app/web/dist ./public
# Copy backend binary
COPY --from=backend-builder /app/bulkserver .

RUN chmod +x ./bulkserver

ENV ADDR=:8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["./bulkserver"]
