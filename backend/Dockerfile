FROM golang:1.24-alpine3.20 AS builder

RUN for attempt in 1 2 3; do \
      apk add --no-cache gcc musl-dev && break; \
      if [ "$attempt" = "3" ]; then exit 1; fi; \
      sleep 5; \
    done
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /meet-server ./cmd/server

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata wget && mkdir -p /data
COPY --from=builder /meet-server /meet-server

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- "${BACKEND_HEALTHCHECK_URL}" || exit 1
ENTRYPOINT ["/meet-server"]
