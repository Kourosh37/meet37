# File Transfer

File transfer in meet37 uses WebRTC data channels for file bytes and WebSocket signaling for negotiation. The backend persists transfer metadata but does not store file contents.

## Responsibilities

Frontend:

- Creates file records in UI state.
- Opens or waits for WebRTC data channels.
- Sends `file-offer`, `file-answer`, and `file-candidate` signals.
- Chunks files and sends chunks over data channels.
- Applies backpressure through data channel buffered amount.
- Tracks progress and completion.
- Stores local sent/received file metadata in IndexedDB.

Backend:

- Relays file signaling to target peers.
- Persists transfer metadata in `file_transfers`.
- Returns room file history from `GET /api/rooms/{roomId}/files`.
- Supports `GET /api/rooms/{roomId}/files?peer_id={peerId}` so clients can load only transfers targeted at their current meeting peer and avoid showing duplicate entries from multi-recipient sends.

## Transfer Lifecycle

1. Sender selects a file.
2. Sender creates a unique `file_id`.
3. Sender records the file locally for future rejoin recovery.
4. Sender waits for data channel registration and open state.
5. Sender sends `file-offer` to each target peer.
6. Receiver accepts or rejects with `file-answer`.
7. Sender sends chunks over the data channel.
8. Receiver reconstructs the file from chunks.
9. UI marks the transfer complete and removes transient loading indicators.

## Data Channel Reliability

`DataChannelRegistry` centralizes channel registration and lookup. The transfer code should:

- Wait for a channel to be registered.
- Wait for `readyState === "open"`.
- Retry when channels are not ready.
- Use `bufferedAmountLowThreshold` and `bufferedamountlow` to avoid flooding.
- Fail with a clear error instead of leaving a transfer permanently in loading state.

## Persistence Model

SQLite stores metadata:

- `room_id`
- `file_id`
- `sender_peer_id`
- `target_peer_id`
- `name`
- `size`
- `mime`
- `status`
- `reason`
- `ts`

IndexedDB stores local file-share metadata so a sender who leaves and rejoins can still have enough local state to offer files again. Because file bytes are not stored on the server, a receiver cannot download a file after all clients that have the bytes are gone.

## Rejoin Behavior

When a sender leaves and rejoins:

- The frontend should load local persistent file shares.
- The frontend should reconcile room file history with local file availability.
- New peers can receive offers for files still available on a connected client.
- Transfers should not remain stuck at upload `0%`; if no local file bytes are available, the UI should show an unavailable/error state.

## Limitations

- The backend is not a file storage server.
- Large files depend on browser memory, data channel reliability, and peer connectivity.
- If every client that has the file bytes leaves, only metadata remains.
- A reverse proxy cannot fix data channel failures caused by blocked WebRTC connectivity.

## Troubleshooting

If transfer stays on `transferring`:

1. Confirm both peers are still in the room.
2. Confirm the WebRTC data channel opened.
3. Check browser console for data channel errors.
4. Check whether media/WebRTC UDP ports are reachable on the server.
5. Check whether the sender still has the local file bytes.
6. Confirm the receiver accepted the offer and sent `file-answer`.
7. Confirm progress events are not blocked by data channel backpressure.
