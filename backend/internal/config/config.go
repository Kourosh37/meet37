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
