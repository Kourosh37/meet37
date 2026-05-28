// WebSocket service placeholder.
//
// Planned responsibilities:
// - Own the native WebSocket instance.
// - Queue outbound messages while disconnected.
// - Reconnect with exponential backoff.
// - Emit typed events for signaling, moderation, chat, file, and SFU messages.
// - Provide explicit close behavior for logout and room leave.
