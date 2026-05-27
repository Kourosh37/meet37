package handlers

import (
	"net/http"

	"meet-backend/internal/signaling"
)

type WSHandler struct {
	hub *signaling.Hub
}

func NewWSHandler(hub *signaling.Hub) *WSHandler {
	return &WSHandler{hub: hub}
}

func (h *WSHandler) ServeWS(w http.ResponseWriter, r *http.Request) {
	h.hub.ServeWS(w, r)
}
