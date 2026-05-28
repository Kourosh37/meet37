# Horizontal Scaling

The backend supports optional shared signaling state through Redis.

## Single Instance

With no `REDIS_URL`, the backend runs in single-instance mode:

- Active peers live in memory.
- WebSocket relay happens in-process.
- Room metadata persists in SQLite.
- SFU media sessions live in the local process.

This is the simplest and recommended mode for early development.

## Multi-Instance Signaling

Set:

```env
REDIS_URL=redis://localhost:6379/0
INSTANCE_ID=backend-1
```

When enabled:

- Each instance registers approved peers in Redis.
- Each instance registers pending approval peers in Redis.
- Peer lists can include peers connected to other instances.
- P2P signaling relay can publish through Redis pub/sub.
- Broadcast room events can fan out to other instances.
- Host approval, rejection, mute, and kick commands can be delivered to peers on another instance.

Redis keys:

```text
meet:room:{room_id}:peers
meet:room:{room_id}:pending
meet:signals
```

## What Is Shared

Shared:

- Peer presence records.
- Pending approval records.
- Peer display name/mode/host metadata.
- Relay messages to remote peers.
- Broadcast messages to remote instances.
- Approval/rejection/moderation commands for peers connected to another instance.
- Room-closed notifications and Redis room presence cleanup.

Still local:

- Open WebSocket TCP connections.
- Pion SFU peer connections and RTP media forwarding.

## Current Multi-Instance Caveats

Redis support makes approved-peer signaling and waiting-room commands work across instances, but complete production scaling still needs room/media placement discipline:

- Sticky routing by room is recommended for lower latency and simpler SFU placement.
- SFU media sessions are process-local. An SFU room should stay on one instance unless a dedicated SFU media layer is introduced.
- SQLite must be replaced or carefully deployed if multiple containers need durable writes from different hosts.

## Recommended Production Topology

For near-term production:

```text
Load balancer
  sticky route by room_id
    -> backend instance
Redis
  peer presence and cross-instance signaling
SQLite volume or managed DB
  durable metadata
Dedicated TURN/SFU layer
  media relay at scale
```

For larger scale:

- Move durable state from SQLite to Postgres.
- Move SFU media to dedicated SFU nodes.
- Use Redis/NATS for signaling commands and presence.
- Use room affinity so all peers in a room prefer the same signaling/SFU node.
