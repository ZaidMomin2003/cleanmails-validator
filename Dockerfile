FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ .
RUN npm run build

FROM golang:1.22-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Explicitly copy the frontend build to the backend's expected directory
COPY --from=frontend-builder /app/web/dist ./public
RUN CGO_ENABLED=0 GOOS=linux go build -o bulkserver ./cmd/bulkserver

FROM alpine:latest
RUN apk --no-cache add ca-certificates wget
WORKDIR /app
# Copy everything needed to the app directory
COPY --from=backend-builder /app/bulkserver .
COPY --from=backend-builder /app/public ./public

RUN chmod +x ./bulkserver

ENV ADDR=:8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["./bulkserver"]
