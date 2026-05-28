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
- Peer lists can include peers connected to other instances.
- P2P signaling relay can publish through Redis pub/sub.
- Broadcast room events can fan out to other instances.

Redis keys:

```text
meet:room:{room_id}:peers
meet:signals
```

## What Is Shared

Shared:

- Peer presence records.
- Peer display name/mode/host metadata.
- Relay messages to remote peers.
- Broadcast messages to remote instances.
- Room-closed notifications and Redis room presence cleanup.

Still local:

- Open WebSocket TCP connections.
- Pending approval maps.
- Pion SFU peer connections and RTP media forwarding.

## Current Multi-Instance Caveats

Redis support makes normal approved-peer signaling work across instances, but complete production scaling needs more:

- Sticky routing by room is still recommended.
- Approval-mode pending peers should ideally be routed to the same instance as a host, or a distributed pending-command flow should be added.
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
