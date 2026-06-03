package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port                     string
	Environment              string
	AdminUsername            string
	AdminPassword            string
	JWTSecret                string
	DefaultAppMode           string
	TURNPublicIP             string
	TURNPort                 int
	TURNSecret               string
	DBPath                   string
	SFUFallbackThresholdKbps int
	AllowedOrigins           []string
	AccessTokenTTLMinutes    int
	RefreshTokenTTLDays      int
	RateLimitRPS             int
	RateLimitBurst           int
	MaxBodyBytes             int64
	SFURecordingEnabled      bool
	SFURecordingPath         string
	SFUAutoPeerThreshold     int
	WebRTCUDPPortMin         int
	WebRTCUDPPortMax         int
	RedisURL                 string
	InstanceID               string
}

func Load() *Config {
	return &Config{
		Port:                     getEnv("PORT", "8080"),
		Environment:              getEnv("ENV", "production"),
		AdminUsername:            getEnv("ADMIN_USERNAME", "admin"),
		AdminPassword:            getEnv("ADMIN_PASSWORD", "changeme"),
		JWTSecret:                getEnv("JWT_SECRET", "change-me-in-production"),
		DefaultAppMode:           getEnv("DEFAULT_APP_MODE", "public"),
		TURNPublicIP:             getEnv("TURN_PUBLIC_IP", "127.0.0.1"),
		TURNPort:                 getEnvInt("TURN_PORT", 3478),
		TURNSecret:               getEnv("TURN_SECRET", "turnsecret"),
		DBPath:                   getEnv("DB_PATH", "/data/meet.db"),
		SFUFallbackThresholdKbps: getEnvInt("SFU_FALLBACK_THRESHOLD_KBPS", 1500),
		AllowedOrigins:           splitCSV(getEnv("ALLOWED_ORIGINS", "*")),
		AccessTokenTTLMinutes:    getEnvInt("ACCESS_TOKEN_TTL_MINUTES", 15),
		RefreshTokenTTLDays:      getEnvInt("REFRESH_TOKEN_TTL_DAYS", 30),
		RateLimitRPS:             getEnvInt("RATE_LIMIT_RPS", 20),
		RateLimitBurst:           getEnvInt("RATE_LIMIT_BURST", 60),
		MaxBodyBytes:             int64(getEnvInt("MAX_BODY_BYTES", 1<<20)),
		SFURecordingEnabled:      getEnvBool("SFU_RECORDING_ENABLED", false),
		SFURecordingPath:         getEnv("SFU_RECORDING_PATH", "/data/recordings"),
		SFUAutoPeerThreshold:     getEnvInt("SFU_AUTO_PEER_THRESHOLD", 2),
		WebRTCUDPPortMin:         getEnvInt("WEBRTC_UDP_PORT_MIN", 40000),
		WebRTCUDPPortMax:         getEnvInt("WEBRTC_UDP_PORT_MAX", 40100),
		RedisURL:                 getEnv("REDIS_URL", ""),
		InstanceID:               getEnv("INSTANCE_ID", getHostname()),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v, err := strconv.Atoi(getEnv(key, ""))
	if err != nil {
		return fallback
	}
	return v
}

func getEnvBool(key string, fallback bool) bool {
	v := strings.ToLower(strings.TrimSpace(getEnv(key, "")))
	if v == "" {
		return fallback
	}
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

func splitCSV(v string) []string {
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func getHostname() string {
	host, err := os.Hostname()
	if err != nil || host == "" {
		return "local"
	}
	return host
}
