package cluster

import (
	"context"
	"encoding/json"
	"time"

	"meet-backend/internal/config"
	"meet-backend/internal/models"

	"github.com/redis/go-redis/v9"
)

const signalsChannel = "meet:signals"

type Message struct {
	Origin       string               `json:"origin"`
	Kind         string               `json:"kind"`
	RoomID       string               `json:"room_id"`
	TargetPeerID string               `json:"target_peer_id,omitempty"`
	ExceptPeerID string               `json:"except_peer_id,omitempty"`
	Signal       models.SignalMessage `json:"signal"`
}

type PeerRecord struct {
	ID          string `json:"id"`
	UserID      string `json:"user_id,omitempty"`
	DisplayName string `json:"display_name"`
	Mode        string `json:"mode"`
	IsHost      bool   `json:"is_host"`
	InstanceID  string `json:"instance_id"`
	UpdatedAt   int64  `json:"updated_at"`
}

type Bus interface {
	Enabled() bool
	Start(ctx context.Context, handler func(Message))
	Publish(ctx context.Context, msg Message) error
	UpsertPeer(ctx context.Context, roomID string, peer PeerRecord) error
	RemovePeer(ctx context.Context, roomID, peerID string) error
	RemoveRoom(ctx context.Context, roomID string) error
	ListPeers(ctx context.Context, roomID string) ([]PeerRecord, error)
}

type NoopBus struct{}

func New(cfg *config.Config) Bus {
	if cfg.RedisURL == "" {
		return NoopBus{}
	}
	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return NoopBus{}
	}
	return &RedisBus{client: redis.NewClient(opt), instanceID: cfg.InstanceID}
}

func (NoopBus) Enabled() bool                                           { return false }
func (NoopBus) Start(context.Context, func(Message))                    {}
func (NoopBus) Publish(context.Context, Message) error                  { return nil }
func (NoopBus) UpsertPeer(context.Context, string, PeerRecord) error    { return nil }
func (NoopBus) RemovePeer(context.Context, string, string) error        { return nil }
func (NoopBus) RemoveRoom(context.Context, string) error                { return nil }
func (NoopBus) ListPeers(context.Context, string) ([]PeerRecord, error) { return nil, nil }

type RedisBus struct {
	client     *redis.Client
	instanceID string
}

func (b *RedisBus) Enabled() bool { return true }

func (b *RedisBus) Start(ctx context.Context, handler func(Message)) {
	go func() {
		pubsub := b.client.Subscribe(ctx, signalsChannel)
		defer pubsub.Close()
		ch := pubsub.Channel()
		for {
			select {
			case <-ctx.Done():
				return
			case msg, ok := <-ch:
				if !ok {
					return
				}
				var event Message
				if json.Unmarshal([]byte(msg.Payload), &event) == nil && event.Origin != b.instanceID {
					handler(event)
				}
			}
		}
	}()
}

func (b *RedisBus) Publish(ctx context.Context, msg Message) error {
	msg.Origin = b.instanceID
	raw, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	return b.client.Publish(ctx, signalsChannel, raw).Err()
}

func (b *RedisBus) UpsertPeer(ctx context.Context, roomID string, peer PeerRecord) error {
	peer.InstanceID = b.instanceID
	peer.UpdatedAt = time.Now().Unix()
	raw, err := json.Marshal(peer)
	if err != nil {
		return err
	}
	key := roomPeersKey(roomID)
	pipe := b.client.Pipeline()
	pipe.HSet(ctx, key, peer.ID, raw)
	pipe.Expire(ctx, key, 24*time.Hour)
	_, err = pipe.Exec(ctx)
	return err
}

func (b *RedisBus) RemovePeer(ctx context.Context, roomID, peerID string) error {
	return b.client.HDel(ctx, roomPeersKey(roomID), peerID).Err()
}

func (b *RedisBus) RemoveRoom(ctx context.Context, roomID string) error {
	return b.client.Del(ctx, roomPeersKey(roomID)).Err()
}

func (b *RedisBus) ListPeers(ctx context.Context, roomID string) ([]PeerRecord, error) {
	values, err := b.client.HVals(ctx, roomPeersKey(roomID)).Result()
	if err != nil {
		return nil, err
	}
	peers := make([]PeerRecord, 0, len(values))
	for _, value := range values {
		var peer PeerRecord
		if json.Unmarshal([]byte(value), &peer) == nil {
			peers = append(peers, peer)
		}
	}
	return peers, nil
}

func roomPeersKey(roomID string) string {
	return "meet:room:" + roomID + ":peers"
}
