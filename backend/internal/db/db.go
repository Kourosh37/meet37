package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	*sql.DB
}

func Open(path string, defaultMode string) (*DB, error) {
	if dir := filepath.Dir(path); dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0o750); err != nil {
			return nil, fmt.Errorf("create data directory: %w", err)
		}
	}
	dsn := fmt.Sprintf("file:%s?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL&_cache_size=-64000&_foreign_keys=on", path)
	sqlDB, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)

	database := &DB{DB: sqlDB}
	if err := database.migrate(defaultMode); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return database, nil
}

func (db *DB) migrate(defaultMode string) error {
	if defaultMode != "private" {
		defaultMode = "public"
	}
	schema := `
CREATE TABLE IF NOT EXISTS settings (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	app_mode TEXT NOT NULL DEFAULT 'public' CHECK (app_mode IN ('public', 'private'))
);

CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	username TEXT UNIQUE NOT NULL COLLATE NOCASE,
	password TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	host_id TEXT NOT NULL,
	is_locked INTEGER NOT NULL DEFAULT 0,
	password TEXT,
	join_policy TEXT NOT NULL DEFAULT 'open' CHECK (join_policy IN ('open', 'approval')),
	host_secret_hash TEXT,
	max_peers INTEGER NOT NULL DEFAULT 50,
	created_at INTEGER NOT NULL,
	expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS room_events (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	room_id TEXT NOT NULL,
	user_id TEXT,
	event TEXT NOT NULL CHECK (event IN ('join', 'leave')),
	ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	username TEXT NOT NULL,
	is_admin INTEGER NOT NULL DEFAULT 0,
	token_hash TEXT NOT NULL UNIQUE,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL,
	revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS chat_messages (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	room_id TEXT NOT NULL,
	peer_id TEXT NOT NULL,
	user_id TEXT,
	display_name TEXT NOT NULL,
	text TEXT NOT NULL,
	ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS file_transfers (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	room_id TEXT NOT NULL,
	file_id TEXT NOT NULL,
	sender_peer_id TEXT NOT NULL,
	target_peer_id TEXT,
	name TEXT,
	size INTEGER,
	mime TEXT,
	status TEXT NOT NULL,
	reason TEXT,
	ts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS room_peer_permissions (
	room_id TEXT NOT NULL,
	identity TEXT NOT NULL,
	can_use_mic INTEGER NOT NULL,
	can_use_camera INTEGER NOT NULL,
	can_share_screen INTEGER NOT NULL,
	can_chat INTEGER NOT NULL,
	can_react INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (room_id, identity)
);

CREATE TABLE IF NOT EXISTS room_admin_permissions (
	room_id TEXT NOT NULL,
	identity TEXT NOT NULL,
	can_kick INTEGER NOT NULL,
	can_mute_mic INTEGER NOT NULL,
	can_disable_camera INTEGER NOT NULL,
	can_disable_screen INTEGER NOT NULL,
	can_disable_chat INTEGER NOT NULL,
	can_disable_emoji INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (room_id, identity)
);

CREATE TABLE IF NOT EXISTS room_bans (
	room_id TEXT NOT NULL,
	identity TEXT NOT NULL,
	banned_until INTEGER NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (room_id, identity)
);

CREATE TABLE IF NOT EXISTS room_default_permissions (
	room_id TEXT PRIMARY KEY,
	can_use_mic INTEGER NOT NULL,
	can_use_camera INTEGER NOT NULL,
	can_share_screen INTEGER NOT NULL,
	can_chat INTEGER NOT NULL,
	can_react INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_room_events_room ON room_events(room_id, ts);
CREATE INDEX IF NOT EXISTS idx_rooms_host ON rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_rooms_expires ON rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_sessions_token ON refresh_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user ON refresh_sessions(user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, ts);
CREATE INDEX IF NOT EXISTS idx_file_transfers_room ON file_transfers(room_id, ts);
CREATE INDEX IF NOT EXISTS idx_room_bans_expires ON room_bans(room_id, banned_until);
`
	if _, err := db.Exec(schema); err != nil {
		return err
	}
	_ = addColumnIfMissing(db.DB, "rooms", "join_policy", `TEXT NOT NULL DEFAULT 'open' CHECK (join_policy IN ('open', 'approval'))`)
	_ = addColumnIfMissing(db.DB, "rooms", "host_secret_hash", `TEXT`)
	_, err := db.Exec(`INSERT OR IGNORE INTO settings (id, app_mode) VALUES (1, ?)`, defaultMode)
	return err
}

func addColumnIfMissing(db *sql.DB, table, column, definition string) error {
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, typ string
		var notNull int
		var dflt interface{}
		var pk int
		if err := rows.Scan(&cid, &name, &typ, &notNull, &dflt, &pk); err != nil {
			return err
		}
		if name == column {
			return nil
		}
	}
	_, err = db.Exec(`ALTER TABLE ` + table + ` ADD COLUMN ` + column + ` ` + definition)
	return err
}
