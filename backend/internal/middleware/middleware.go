package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"meet-backend/internal/config"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
)

type contextKey string

const (
	CtxUserID   contextKey = "user_id"
	CtxUsername contextKey = "username"
	CtxIsAdmin  contextKey = "is_admin"
)

type Claims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	IsAdmin  bool   `json:"is_admin"`
	jwt.RegisteredClaims
}

func Auth(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenString := bearerToken(r)
			if tokenString == "" {
				tokenString = r.URL.Query().Get("token")
			}
			if tokenString == "" {
				http.Error(w, "missing token", http.StatusUnauthorized)
				return
			}

			claims, ok := ParseToken(cfg, tokenString)
			if !ok {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r.WithContext(WithClaims(r.Context(), claims)))
		})
	}
}

func OptionalAuth(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenString := bearerToken(r)
			if tokenString == "" {
				tokenString = r.URL.Query().Get("token")
			}
			if claims, ok := ParseToken(cfg, tokenString); ok {
				r = r.WithContext(WithClaims(r.Context(), claims))
			}
			next.ServeHTTP(w, r)
		})
	}
}

func ParseToken(cfg *config.Config, tokenString string) (*Claims, bool) {
	if tokenString == "" {
		return nil, false
	}
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, jwt.ErrTokenUnverifiable
		}
		return []byte(cfg.JWTSecret), nil
	})
	return claims, err == nil && token.Valid
}

func WithClaims(ctx context.Context, claims *Claims) context.Context {
	ctx = context.WithValue(ctx, CtxUserID, claims.UserID)
	ctx = context.WithValue(ctx, CtxUsername, claims.Username)
	ctx = context.WithValue(ctx, CtxIsAdmin, claims.IsAdmin)
	return ctx
}

func AdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		isAdmin, _ := r.Context().Value(CtxIsAdmin).(bool)
		if !isAdmin {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func CORS(allowed []string) func(http.Handler) http.Handler {
	allowAll := len(allowed) == 0 || (len(allowed) == 1 && allowed[0] == "*")
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if allowAll {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			} else if originAllowed(origin, allowed) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
			}
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Info().Str("method", r.Method).Str("path", r.URL.Path).Dur("duration", time.Since(start)).Msg("request")
	})
}

func bearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return ""
}

func originAllowed(origin string, allowed []string) bool {
	for _, item := range allowed {
		if item == origin {
			return true
		}
	}
	return false
}
