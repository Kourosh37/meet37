// Token and local session storage placeholder.
//
// Planned responsibilities:
// - Keep tokens in memory by default.
// - Optionally mirror session data to sessionStorage for tab refresh recovery.
// - Never use localStorage for long-lived tokens.
// - Store per-room host_token privately by room id.
