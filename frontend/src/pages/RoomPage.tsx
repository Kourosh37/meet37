import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as Y from 'yjs';

import { WhiteboardCanvas } from '../components/WhiteboardCanvas';
import { getLiveKitUrl, getUploadUrl, joinRoom, validateRoom } from '../lib/api';
import type { ChatMessage, FileMessage, RoomDataMessage, Stroke } from '../types';

interface VideoTile {
  id: string;
  participantName: string;
  track: Track;
  isLocal: boolean;
}

interface AudioTrackItem {
  id: string;
  track: Track;
}

function MediaTrack({ track, muted }: { track: Track; muted?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const element = track.attach();
    if (element instanceof HTMLMediaElement) {
      element.autoplay = true;
      element.muted = Boolean(muted);
      if (element instanceof HTMLVideoElement) {
        element.playsInline = true;
        element.className = 'video-track';
      }
    }

    container.appendChild(element);

    return () => {
      track.detach(element);
      element.remove();
    };
  }, [muted, track]);

  return <div ref={containerRef} className="media-track" />;
}

function HiddenAudioTracks({ tracks }: { tracks: AudioTrackItem[] }) {
  return (
    <div className="hidden-audio-container" aria-hidden>
      {tracks.map((item) => (
        <MediaTrack key={item.id} track={item.track} />
      ))}
    </div>
  );
}

export function RoomPage() {
  const navigate = useNavigate();
  const params = useParams();
  const token = params.token ?? '';

  const [status, setStatus] = useState<'checking' | 'not-found' | 'ready'>('checking');
  const [displayName, setDisplayName] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [videoTiles, setVideoTiles] = useState<VideoTile[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrackItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<FileMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkRoom = async () => {
      try {
        const exists = await validateRoom(token);
        if (!mounted) {
          return;
        }

        setStatus(exists ? 'ready' : 'not-found');
      } catch (checkError) {
        if (!mounted) {
          return;
        }

        setError(checkError instanceof Error ? checkError.message : 'Room validation failed');
        setStatus('not-found');
      }
    };

    checkRoom();

    return () => {
      mounted = false;
    };
  }, [token]);

  const syncTracks = useCallback((targetRoom: Room) => {
    const nextVideoTiles: VideoTile[] = [];
    const nextAudioTracks: AudioTrackItem[] = [];

    const collectParticipantTracks = (participant: Participant, isLocalParticipant: boolean) => {
      participant.trackPublications.forEach((publication, sid) => {
        const track = publication.track;
        if (!track) {
          return;
        }

        if (track.kind === Track.Kind.Video) {
          nextVideoTiles.push({
            id: `${participant.identity}-${sid}`,
            participantName:
              participant.name || participant.identity || (isLocalParticipant ? 'You' : 'Guest'),
            track,
            isLocal: isLocalParticipant,
          });
          return;
        }

        if (track.kind === Track.Kind.Audio && !isLocalParticipant) {
          nextAudioTracks.push({
            id: `${participant.identity}-${sid}`,
            track,
          });
        }
      });
    };

    collectParticipantTracks(targetRoom.localParticipant, true);
    targetRoom.remoteParticipants.forEach((participant) => {
      collectParticipantTracks(participant, false);
    });

    setVideoTiles(nextVideoTiles);
    setAudioTracks(nextAudioTracks);
  }, []);

  const publishData = useCallback(async (message: RoomDataMessage) => {
    const activeRoom = roomRef.current;
    if (!activeRoom) {
      return;
    }

    const payload = new TextEncoder().encode(JSON.stringify(message));
    await activeRoom.localParticipant.publishData(payload, {
      reliable: true,
      topic: 'meet37-room-sync',
    });
  }, []);

  useEffect(() => {
    if (!room) {
      return;
    }

    const ydoc = new Y.Doc();
    const yStrokes = ydoc.getArray<Stroke>('strokes');

    const syncStrokes = () => {
      setStrokes(yStrokes.toArray() as Stroke[]);
    };

    const onUpdate = async (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') {
        return;
      }

      const encodedUpdate = uint8ArrayToBase64(update);
      await publishData({
        type: 'yjs-update',
        payload: { update: encodedUpdate },
      });
    };

    yStrokes.observe(syncStrokes);
    ydoc.on('update', onUpdate);
    ydocRef.current = ydoc;
    syncStrokes();

    return () => {
      yStrokes.unobserve(syncStrokes);
      ydoc.off('update', onUpdate);
      ydoc.destroy();
      ydocRef.current = null;
      setStrokes([]);
    };
  }, [publishData, room]);

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  const onConnect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError('Display name is required');
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const join = await joinRoom(token, trimmedName);
      const nextRoom = new Room();
      const onTrackEvent = () => syncTracks(nextRoom);

      nextRoom.on(RoomEvent.TrackSubscribed, onTrackEvent);
      nextRoom.on(RoomEvent.TrackUnsubscribed, onTrackEvent);
      nextRoom.on(RoomEvent.ParticipantConnected, onTrackEvent);
      nextRoom.on(RoomEvent.ParticipantDisconnected, onTrackEvent);
      nextRoom.on(RoomEvent.LocalTrackPublished, onTrackEvent);
      nextRoom.on(RoomEvent.LocalTrackUnpublished, onTrackEvent);

      nextRoom.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const message = JSON.parse(new TextDecoder().decode(payload)) as RoomDataMessage;
          if (message.type === 'chat') {
            setChatMessages((current) => [...current, message.payload]);
            return;
          }

          if (message.type === 'file') {
            setFiles((current) => [...current, message.payload]);
            return;
          }

          if (message.type === 'yjs-update') {
            const update = base64ToUint8Array(message.payload.update);
            if (ydocRef.current) {
              Y.applyUpdate(ydocRef.current, update, 'remote');
            }
          }
        } catch (decodeError) {
          console.warn('Failed to decode room data packet', decodeError);
        }
      });

      await nextRoom.connect(getLiveKitUrl(), join.livekitToken);
      await nextRoom.localParticipant.setMicrophoneEnabled(true);
      await nextRoom.localParticipant.setCameraEnabled(true);

      roomRef.current = nextRoom;
      setRoom(nextRoom);
      syncTracks(nextRoom);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Failed to join room');
    } finally {
      setConnecting(false);
    }
  };

  const onSendChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = chatInput.trim();
    if (!text || !roomRef.current) {
      return;
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      from: displayName.trim(),
      text,
      createdAt: new Date().toISOString(),
    };

    setChatInput('');
    setChatMessages((current) => [...current, message]);

    await publishData({
      type: 'chat',
      payload: message,
    });
  };

  const onUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const upload = await getUploadUrl(file.name, file.size);
      const uploadResult = await fetch(upload.uploadUrl, {
        method: 'PUT',
        body: file,
      });

      if (!uploadResult.ok) {
        throw new Error(`Upload failed with status ${uploadResult.status}`);
      }

      const payload: FileMessage = {
        id: upload.fileId,
        from: displayName.trim(),
        filename: file.name,
        size: file.size,
        downloadUrl: upload.downloadUrl,
      };

      setFiles((current) => [...current, payload]);
      await publishData({
        type: 'file',
        payload,
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'File upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const onCreateStroke = (stroke: Stroke) => {
    const ydoc = ydocRef.current;
    if (!ydoc) {
      return;
    }

    const yStrokes = ydoc.getArray<Stroke>('strokes');
    yStrokes.push([stroke]);
  };

  const onClearBoard = () => {
    const ydoc = ydocRef.current;
    if (!ydoc) {
      return;
    }

    const yStrokes = ydoc.getArray<Stroke>('strokes');
    if (yStrokes.length > 0) {
      yStrokes.delete(0, yStrokes.length);
    }
  };

  const roomTokenTitle = useMemo(() => token.toUpperCase(), [token]);

  if (status === 'checking') {
    return (
      <main className="shell room-shell">
        <p className="status-info">Checking room token...</p>
      </main>
    );
  }

  if (status === 'not-found') {
    return (
      <main className="shell room-shell">
        <h1>Room not found</h1>
        <p className="status-error">Token `{token}` does not exist or expired.</p>
        <Link to="/" className="secondary-link">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="shell room-shell">
      <header className="room-header">
        <div>
          <p className="eyebrow">meet37 room</p>
          <h1>{roomTokenTitle}</h1>
        </div>

        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            roomRef.current?.disconnect();
            roomRef.current = null;
            setRoom(null);
            navigate('/');
          }}
        >
          Leave
        </button>
      </header>

      {!room ? (
        <section className="join-panel">
          <h2>Join this room</h2>
          <form onSubmit={onConnect} className="join-room-form">
            <label htmlFor="displayName">Display name</label>
            <div className="join-row">
              <input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Alice"
                maxLength={64}
                disabled={connecting}
              />
              <button type="submit" className="primary-btn" disabled={connecting}>
                {connecting ? 'Connecting...' : 'Join Room'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="room-layout">
          <section className="video-stage">
            <h2>Participants</h2>
            <div className="video-grid">
              {videoTiles.map((tile) => (
                <article key={tile.id} className="video-tile">
                  <MediaTrack track={tile.track} muted={tile.isLocal} />
                  <p>
                    {tile.participantName}
                    {tile.isLocal ? ' (You)' : ''}
                  </p>
                </article>
              ))}
            </div>
            <HiddenAudioTracks tracks={audioTracks} />
          </section>

          <section className="side-panel">
            <div className="panel-block">
              <h3>Chat</h3>
              <div className="chat-log">
                {chatMessages.map((message) => (
                  <article key={message.id} className="chat-item">
                    <strong>{message.from}</strong>
                    <span>{message.text}</span>
                  </article>
                ))}
              </div>

              <form onSubmit={onSendChat} className="chat-form">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Send a message"
                />
                <button type="submit" className="secondary-btn">
                  Send
                </button>
              </form>
            </div>

            <div className="panel-block">
              <div className="file-header">
                <h3>Files</h3>
                <label className="upload-btn" htmlFor="fileInput">
                  {uploading ? 'Uploading...' : 'Upload'}
                </label>
                <input id="fileInput" type="file" onChange={onUploadFile} hidden disabled={uploading} />
              </div>
              <ul className="file-list">
                {files.map((file) => (
                  <li key={file.id}>
                    <a href={file.downloadUrl} target="_blank" rel="noreferrer">
                      {file.filename}
                    </a>
                    <span>
                      {Math.ceil(file.size / 1024)} KB - from {file.from}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="whiteboard-panel">
            <div className="whiteboard-header">
              <h3>Whiteboard (Yjs over LiveKit)</h3>
              <button type="button" className="secondary-btn" onClick={onClearBoard}>
                Clear
              </button>
            </div>
            <WhiteboardCanvas strokes={strokes} disabled={!room} onCreateStroke={onCreateStroke} />
          </section>
        </section>
      )}

      {error ? <p className="status-error">{error}</p> : null}
    </main>
  );
}

function uint8ArrayToBase64(value: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < value.byteLength; index += 1) {
    binary += String.fromCharCode(value[index]);
  }

  return window.btoa(binary);
}

function base64ToUint8Array(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
