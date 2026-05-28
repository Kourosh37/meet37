# P2P-First Media And Fallback

This product is designed as `p2p-first`: the normal path for camera, microphone, screen share, and low-latency peer media is direct browser-to-browser WebRTC. The backend starts as a coordinator, not as a media server.

## What P2P-First Means

In the default path:

1. A participant opens a shared room link.
2. The frontend requests camera/microphone permission with `getUserMedia`.
3. The frontend connects to backend WebSocket `/ws`.
4. The frontend joins the room with a `display_name`.
5. Browsers exchange WebRTC signaling through the backend:
   - `offer`
   - `answer`
   - `ice-candidate`
6. Each browser creates `RTCPeerConnection` objects to the other peers.
7. Media tracks flow directly between browsers when ICE succeeds.

The backend does not receive raw audio/video/screen frames in this default mode.

## Backend Responsibilities In P2P Mode

The backend handles coordination:

- Room metadata and access rules.
- Host token validation.
- Waiting-room approval.
- Peer presence.
- SDP/ICE signaling relay.
- Chat message relay if using backend WebSocket chat.
- File-transfer metadata relay.
- Quality stats ingestion.
- Fallback decision messaging.

The backend does not:

- Decode audio.
- Decode video.
- Store media frames.
- Mix audio.
- Transcode video.
- Forward RTP packets in the current implementation.

## Frontend Responsibilities In P2P Mode

The frontend must:

- Capture local tracks with browser media APIs.
- Create and manage `RTCPeerConnection` instances.
- Add camera/microphone/screen-share tracks.
- Generate and apply SDP offers/answers.
- Gather and send ICE candidates.
- Attach remote tracks to video/audio elements.
- Monitor `getStats`.
- Tear down connections when peers leave.

## Why This Reduces Server Load

For small meetings, P2P keeps the expensive traffic off the server.

In a 3-person meeting, each browser sends media directly to the other two browsers. The backend only sees lightweight JSON signaling and control messages.

Server load remains mostly:

- HTTP requests.
- WebSocket messages.
- SQLite reads/writes for room/admin state.
- Small JSON stats reports.

This is much cheaper than routing every video/audio packet through the backend.

## The Cost Of P2P

P2P is not free for clients. Each sender may need to upload one media stream per remote peer.

Approximate upload pressure:

```text
sender_upload = encoded_media_bitrate * number_of_remote_peers
```

Example:

```text
1.5 Mbps camera stream * 5 remote peers = 7.5 Mbps upload from that browser
```

This is why P2P works best for small rooms and starts to degrade with:

- More participants.
- Weak upload bandwidth.
- High packet loss.
- High RTT.
- Strict NAT/firewall networks.
- Mobile devices under thermal/battery pressure.

## Quality Stats Flow

Clients should periodically inspect WebRTC stats and send:

```json
{
  "type": "stats",
  "payload": {
    "bitrate_kbps": 900,
    "packet_loss_pct": 10,
    "rtt_ms": 350
  }
}
```

Recommended interval:

```text
3-5 seconds
```

Do not send stats before the connection has meaningful samples.

## Current Fallback Trigger Logic

The backend triggers fallback when any of these are true:

- `bitrate_kbps` is greater than zero and below `SFU_FALLBACK_THRESHOLD_KBPS`.
- `packet_loss_pct` is above the backend threshold.
- `rtt_ms` is above the backend threshold.

The bitrate threshold is configurable:

```env
SFU_FALLBACK_THRESHOLD_KBPS=1500
```

The current hard-coded packet loss and RTT thresholds are in `internal/signaling/signaling.go`:

```go
maxPacketLoss = 8.0
maxRTT        = 300.0
```

## What Happens On Fallback Today

When fallback is triggered, backend sends the affected peer:

```json
{
  "type": "sfu-switch",
  "payload": {
    "session_id": "session-id",
    "turn_servers": [
      {
        "urls": [
          "turn:your.server.public.ip:3478?transport=udp",
          "turn:your.server.public.ip:3478?transport=tcp"
        ],
        "username": "expiry:peer-id",
        "credential": "hmac-secret"
      }
    ]
  }
}
```

Other peers receive:

```json
{
  "type": "peer-mode-changed",
  "from": "peer-id",
  "payload": {
    "peer_id": "peer-id",
    "mode": "sfu"
  }
}
```

This means:

- The backend has decided this peer should leave pure P2P mode.
- The frontend should update UI and prepare renegotiation.
- The frontend receives server-assisted ICE/TURN information.
- The peer runtime mode becomes `sfu` in backend live stats.

## Important Current Limitation

The current backend does not yet implement real RTP media forwarding.

The current `internal/sfu` package provides:

- A room fallback session ID.
- Time-bound TURN-style credentials.
- Fallback metadata used by frontend orchestration.

It does not yet:

- Accept WebRTC publisher connections.
- Receive RTP tracks.
- Forward RTP tracks to subscribers.
- Simulcast or select layers.
- Mix, transcode, or record media.

So the current fallback is an orchestration contract and preparation layer, not a complete SFU media relay.

## Intended Gradual Server-Load Shift

The intended final architecture should move server load in stages:

### Stage 1: Pure P2P

Default path.

```text
Browser A <---- WebRTC media ----> Browser B
Backend only relays signaling JSON.
```

Server pressure:

- Very low.

### Stage 2: P2P With TURN Relay

If direct ICE fails, clients can use TURN relay. Media still behaves like peer connection traffic, but packets relay through a TURN server.

```text
Browser A <----> TURN <----> Browser B
Backend coordinates credentials and signaling.
```

Server pressure:

- Medium.
- Network bandwidth increases on TURN infrastructure.

### Stage 3: Selective SFU Fallback

When stats degrade or room size grows, selected peers publish media to an SFU and subscribe to remote tracks through the SFU.

```text
Browser A ---> SFU ---> Browser B
Browser A ---> SFU ---> Browser C
```

Server pressure:

- Higher, but controlled.
- Client upload pressure drops because each client uploads once to SFU.

### Stage 4: Full SFU Room

For large rooms, the whole room can switch to SFU mode.

Server pressure:

- Highest backend/media bandwidth.
- Most predictable client performance.

## Recommended Frontend Behavior On `sfu-switch`

Until real SFU media relay is added, frontend should:

1. Mark the peer/room as degraded or server-assisted.
2. Add the provided TURN servers to the next ICE configuration.
3. Renegotiate affected peer connections if the current product wants TURN-assisted retry.
4. Avoid repeatedly triggering UI changes for the same peer.
5. Continue sending stats.

After real SFU relay is implemented, frontend should:

1. Close or pause direct P2P sender paths for the affected peer.
2. Create a publisher connection to SFU.
3. Publish camera/mic/screen tracks once.
4. Subscribe to remote tracks from SFU.
5. Keep WebSocket signaling for room control and moderation.

## Suggested Future Backend Work

To make fallback fully real, add one of:

- Pion-based SFU implementation.
- Integration with an existing SFU such as LiveKit, Janus, mediasoup, or ion-sfu.
- Dedicated TURN server process with operational monitoring.

Needed backend additions:

- SFU publish/subscribe signaling routes.
- Track metadata model.
- Per-room media session lifecycle.
- Subscriber management.
- Simulcast/SVC layer selection.
- Bandwidth estimation.
- Reconnection behavior.
- Metrics for SFU bandwidth and packet loss.

## Summary

The backend is already designed around a P2P-first contract:

- Start with direct WebRTC browser media.
- Keep backend traffic minimal.
- Watch client quality stats.
- Send `sfu-switch` when quality crosses thresholds.
- Provide fallback session and TURN credential metadata.

The remaining major media milestone is implementing or integrating a real SFU relay that consumes this fallback contract.

