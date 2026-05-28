package db

import (
	"testing"
)

func TestOpenMigratesApplicationTables(t *testing.T) {
	database, err := Open(t.TempDir()+"/meet.db", "private")
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer database.Close()

	for _, table := range []string{"settings", "users", "rooms", "room_events", "refresh_sessions", "chat_messages", "file_transfers"} {
		var name string
		if err := database.QueryRow(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, table).Scan(&name); err != nil {
			t.Fatalf("expected table %s to exist: %v", table, err)
		}
	}

	var mode string
	if err := database.QueryRow(`SELECT app_mode FROM settings WHERE id = 1`).Scan(&mode); err != nil {
		t.Fatalf("read default app mode: %v", err)
	}
	if mode != "private" {
		t.Fatalf("expected private default mode, got %q", mode)
	}
}
