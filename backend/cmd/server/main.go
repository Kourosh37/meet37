package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"meet-backend/internal/cluster"
	"meet-backend/internal/config"
	"meet-backend/internal/db"
	"meet-backend/internal/handlers"
	"meet-backend/internal/middleware"
	"meet-backend/internal/sfu"
	"meet-backend/internal/signaling"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	cfg := config.Load()
	if cfg.Environment != "production" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

	database, err := db.Open(cfg.DBPath, cfg.DefaultAppMode)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to open database")
	}
	defer database.Close()

	sfuMgr := sfu.NewManager(cfg)
	clusterBus := cluster.New(cfg)
	hub := signaling.NewHub(cfg, database, sfuMgr, clusterBus)
	rootCtx, rootCancel := context.WithCancel(context.Background())
	defer rootCancel()
	hub.StartCluster(rootCtx)
	authH := handlers.NewAuthHandler(cfg, database)
	roomH := handlers.NewRoomHandler(cfg, database, hub)
	adminH := handlers.NewAdminHandler(database, hub)
	wsH := handlers.NewWSHandler(hub)

	mux := http.NewServeMux()
	authMw := middleware.Auth(cfg)
	optionalAuthMw := middleware.OptionalAuth(cfg)
	adminMw := middleware.AdminOnly

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/api/auth/login", authH.Login)
	mux.HandleFunc("/api/auth/refresh", authH.Refresh)
	mux.HandleFunc("/api/auth/logout", authH.Logout)
	mux.Handle("/api/auth/register", authMw(adminMw(http.HandlerFunc(authH.Register))))
	mux.Handle("/ws", optionalAuthMw(http.HandlerFunc(wsH.ServeWS)))

	mux.Handle("/api/rooms", optionalAuthMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			roomH.ListRooms(w, r)
		case http.MethodPost:
			roomH.CreateRoom(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))
	mux.Handle("/api/rooms/", optionalAuthMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			if strings.HasSuffix(r.URL.Path, "/chat") {
				roomH.GetChatHistory(w, r)
				return
			}
			if strings.HasSuffix(r.URL.Path, "/files") {
				roomH.GetFileHistory(w, r)
				return
			}
			roomH.GetRoom(w, r)
		case http.MethodDelete:
			roomH.DeleteRoom(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	mux.Handle("/api/admin/settings", authMw(adminMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			adminH.GetSettings(w, r)
		case http.MethodPut:
			adminH.UpdateSettings(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/admin/users", authMw(adminMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			adminH.ListUsers(w, r)
		case http.MethodPost:
			adminH.CreateUser(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/admin/users/", authMw(adminMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPut:
			adminH.UpdateUser(w, r)
		case http.MethodDelete:
			adminH.DeleteUser(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))
	mux.Handle("/api/admin/sfu/stats", authMw(adminMw(http.HandlerFunc(adminH.GetSFUStats))))
	mux.Handle("/api/admin/rooms/", authMw(adminMw(http.HandlerFunc(adminH.GetRoomStats))))

	limiter := middleware.NewRateLimiter(cfg.RateLimitRPS, cfg.RateLimitBurst)
	handler := middleware.Logger(limiter.Middleware(middleware.MaxBodyBytes(cfg.MaxBodyBytes)(middleware.CORS(cfg.AllowedOrigins)(mux))))
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Info().Str("port", cfg.Port).Msg("server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server failed")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	rootCancel()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
