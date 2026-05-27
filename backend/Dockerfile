FROM golang:1.22-alpine AS builder

RUN apk add --no-cache gcc musl-dev
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /meet-server ./cmd/server

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata wget && mkdir -p /data
COPY --from=builder /meet-server /meet-server

EXPOSE 8080 3478/udp 3478/tcp
ENTRYPOINT ["/meet-server"]
