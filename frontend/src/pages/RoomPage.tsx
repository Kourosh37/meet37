import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getLiveKitUrl, getUploadUrl, joinRoom, validateRoom } from '../lib/api';

type UIMessage = {
  id: string;
  from: string;
  createdAt: string;
} & (
  | { kind: 'text'; text: string }
  | { kind: 'file'; filename: string; size: number; downloadUrl: string; mimeType: string }
);

type RoomDataMessage =
  | { type: 'chat'; payload: UIMessage }
  | { type: 'file'; payload: UIMessage };

interface VideoTile {
  id: string;
  participantName: string;
  track: Track;
  isLocal: boolean;
  isScreenShare: boolean;
}

interface ParticipantCard {
  id: string;
  name: string;
  hasCamera: boolean;
}

interface AudioTrackItem {
  id: string;
  track: Track;
}

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon-svg">
      <path d={path} fill="currentColor" />
    </svg>
  );
}

const icons = {
  mic: 'M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm-7-3a1 1 0 0 1 2 0 5 5 0 1 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-3.07A7 7 0 0 1 5 11Z',
  micOff: 'M4.22 3.22a1 1 0 0 0-1.44 1.38l4.23 4.23V11a5 5 0 0 0 7.58 4.28l1.57 1.57A6.94 6.94 0 0 1 13 17.93V21h3a1 1 0 1 1 0 2H8a1 1 0 0 1 0-2h3v-3.07A7 7 0 0 1 5 11a1 1 0 0 1 2 0 5 5 0 0 0 7.71 4.21l-1.6-1.6A3 3 0 0 1 9 11v-.94L4.22 3.22ZM12 3a3 3 0 0 1 3 3v3.17l-2-2V6a1 1 0 1 0-2 0v.17l-2-2V6a3 3 0 0 1 3-3Zm9.78 18.78a1 1 0 0 1-1.41 0l-18-18a1 1 0 0 1 1.41-1.41l18 18a1 1 0 0 1 0 1.41Z',
  cam: 'M4 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1.38l2.45-1.4A2 2 0 0 1 22 7.72v8.56a2 2 0 0 1-3.55 1.74L16 16.62V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z',
  camOff: 'M4 6.17 2.29 4.46a1 1 0 0 1 1.42-1.42l18 18a1 1 0 0 1-1.42 1.42L16 18.17V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.17Zm12 7.17 2.45 2.45A2 2 0 0 0 22 16.28V7.72a2 2 0 0 0-3.55-1.74L16 7.38v5.96Z',
  share: 'M15 8a3 3 0 1 0-6 0v1H6a2 2 0 0 0-2 2v7h16v-7a2 2 0 0 0-2-2h-3V8Zm-2 0v1h-2V8a1 1 0 1 1 2 0Zm-6 5v3h10v-3H7Z',
  chat: 'M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9.41L5 20.41A1 1 0 0 1 3.29 19.7V16A2 2 0 0 1 2 14V5h2Z',
  leave: 'M10 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4v-2H6V5h4V3Zm4.3 4.3-1.4 1.4 1.3 1.3H9v2h5.2l-1.3 1.3 1.4 1.4L18 11l-3.7-3.7Z',
  send: 'M3.4 20.6 21 12 3.4 3.4 3 10l10 2-10 2 .4 6.6Z',
  download: 'M12 3a1 1 0 0 1 1 1v8.59l2.3-2.29a1 1 0 1 1 1.4 1.41l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.41L11 12.59V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z',
  sun: 'M12 4a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm0 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-4a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1ZM7 12a1 1 0 0 1-1 1H5a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1Zm9.66 6.24a1 1 0 0 1 0 1.42l-.71.7a1 1 0 1 1-1.41-1.41l.7-.71a1 1 0 0 1 1.42 0ZM9.46 9.05a1 1 0 0 1-1.41 0l-.7-.71a1 1 0 1 1 1.41-1.41l.7.7a1 1 0 0 1 0 1.42Zm7.2-2.12a1 1 0 0 1-1.42 0l-.7-.7a1 1 0 0 1 1.41-1.42l.71.71a1 1 0 0 1 0 1.41ZM9.46 14.95a1 1 0 0 1 0 1.41l-.7.71a1 1 0 1 1-1.42-1.41l.71-.71a1 1 0 0 1 1.41 0Z',
  moon: 'M20.74 14.6A8 8 0 0 1 9.4 3.26a1 1 0 0 0-1.08-1.61A10 10 0 1 0 22.35 15.7a1 1 0 0 0-1.61-1.1Z',
};

function MediaTrack({ track, muted }: { track: Track; muted?: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

function isImageFile(mimeType: string, filename: string) {
  return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename);
}

export function RoomPage() {
  const navigate = useNavigate();
  const params = useParams();
  const token = (params.token ?? '').trim().toLowerCase();

  const [status, setStatus] = useState<'checking' | 'not-found' | 'ready'>('checking');
  const [displayName, setDisplayName] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [participantCards, setParticipantCards] = useState<ParticipantCard[]>([]);
  const [cameraTiles, setCameraTiles] = useState<VideoTile[]>([]);
  const [screenTile, setScreenTile] = useState<VideoTile | null>(null);
  const [audioTracks, setAudioTracks] = useState<AudioTrackItem[]>([]);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [preparingMedia, setPreparingMedia] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [minimizeShare, setMinimizeShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const roomRef = useRef<Room | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkRoom = async () => {
      try {
        const exists = await validateRoom(token);
        if (mounted) setStatus(exists ? 'ready' : 'not-found');
      } catch (checkError) {
        if (!mounted) return;
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
    const nextCameraTiles: VideoTile[] = [];
    const nextAudioTracks: AudioTrackItem[] = [];
    const nextCards: ParticipantCard[] = [];
    let nextScreenTile: VideoTile | null = null;

    const collect = (participant: Participant, isLocal: boolean) => {
      let hasCamera = false;
      participant.trackPublications.forEach((publication, sid) => {
        const track = publication.track;
        if (!track) return;

        if (track.kind === Track.Kind.Video) {
          const isScreenShare = publication.source === Track.Source.ScreenShare;
          const tile: VideoTile = {
            id: `${participant.identity}-${sid}`,
            participantName: participant.name || participant.identity || (isLocal ? 'You' : 'Guest'),
            track,
            isLocal,
            isScreenShare,
          };
          if (isScreenShare) {
            nextScreenTile = tile;
          } else {
            hasCamera = true;
            nextCameraTiles.push(tile);
          }
          return;
        }

        if (track.kind === Track.Kind.Audio && !isLocal) {
          nextAudioTracks.push({ id: `${participant.identity}-${sid}`, track });
        }
      });

      nextCards.push({
        id: participant.identity,
        name: participant.name || participant.identity || (isLocal ? 'You' : 'Guest'),
        hasCamera,
      });
    };

    collect(targetRoom.localParticipant, true);
    targetRoom.remoteParticipants.forEach((participant) => collect(participant, false));

    setCameraTiles(nextCameraTiles);
    setAudioTracks(nextAudioTracks);
    setParticipantCards(nextCards);
    setScreenTile(nextScreenTile);
    setScreenShareEnabled(targetRoom.localParticipant.isScreenShareEnabled);
  }, []);

  const publishData = useCallback(async (message: RoomDataMessage) => {
    const activeRoom = roomRef.current;
    if (!activeRoom) return;
    const payload = new TextEncoder().encode(JSON.stringify(message));
    await activeRoom.localParticipant.publishData(payload, { reliable: true, topic: 'meet37-chat' });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
      previewStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const video = previewVideoRef.current;
    const stream = previewStreamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
  }, [previewReady]);

  const setupPreview = useCallback(async () => {
    if (previewStreamRef.current) return;
    setPreparingMedia(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 15, max: 24 },
        },
      });
      previewStreamRef.current = stream;
      setPreviewReady(true);
    } catch (mediaError) {
      setError(mediaError instanceof Error ? mediaError.message : 'Failed to access camera/microphone');
    } finally {
      setPreparingMedia(false);
    }
  }, []);

  const connectRoom = async (event: FormEvent<HTMLFormElement>) => {
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
      const nextRoom = new Room({ adaptiveStream: true, dynacast: true });
      const onTrackEvent = () => syncTracks(nextRoom);

      nextRoom.on(RoomEvent.TrackSubscribed, onTrackEvent);
      nextRoom.on(RoomEvent.TrackUnsubscribed, onTrackEvent);
      nextRoom.on(RoomEvent.ParticipantConnected, onTrackEvent);
      nextRoom.on(RoomEvent.ParticipantDisconnected, onTrackEvent);
      nextRoom.on(RoomEvent.LocalTrackPublished, onTrackEvent);
      nextRoom.on(RoomEvent.LocalTrackUnpublished, onTrackEvent);
      nextRoom.on(RoomEvent.TrackMuted, onTrackEvent);
      nextRoom.on(RoomEvent.TrackUnmuted, onTrackEvent);

      nextRoom.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const message = JSON.parse(new TextDecoder().decode(payload)) as RoomDataMessage;
          if (message.type === 'chat' || message.type === 'file') {
            setMessages((current) => [...current, message.payload]);
          }
        } catch {
          // noop
        }
      });

      nextRoom.prepareConnection(getLiveKitUrl(), join.livekitToken);
      await nextRoom.connect(getLiveKitUrl(), join.livekitToken);
      await nextRoom.localParticipant.setMicrophoneEnabled(micEnabled);
      await nextRoom.localParticipant.setCameraEnabled(cameraEnabled);

      roomRef.current = nextRoom;
      setRoom(nextRoom);
      syncTracks(nextRoom);

      previewStreamRef.current?.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = null;
      setPreviewReady(false);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Failed to join room');
    } finally {
      setConnecting(false);
    }
  };

  const onToggleMic = async () => {
    const activeRoom = roomRef.current;
    if (!activeRoom && previewStreamRef.current) {
      const next = !micEnabled;
      previewStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = next;
      });
      setMicEnabled(next);
      return;
    }
    if (!activeRoom) return;
    const next = !micEnabled;
    await activeRoom.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  };

  const onToggleCamera = async () => {
    const activeRoom = roomRef.current;
    if (!activeRoom && previewStreamRef.current) {
      const next = !cameraEnabled;
      previewStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
      setCameraEnabled(next);
      return;
    }
    if (!activeRoom) return;
    const next = !cameraEnabled;
    await activeRoom.localParticipant.setCameraEnabled(next);
    setCameraEnabled(next);
    syncTracks(activeRoom);
  };

  const onToggleScreenShare = async () => {
    const activeRoom = roomRef.current;
    if (!activeRoom) return;

    if (!screenShareEnabled && screenTile && !screenTile.isLocal) {
      setError('Another participant is sharing screen right now.');
      return;
    }

    try {
      const next = !screenShareEnabled;
      await activeRoom.localParticipant.setScreenShareEnabled(next);
      setScreenShareEnabled(next);
      setMinimizeShare(false);
      syncTracks(activeRoom);
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Screen share failed');
    }
  };

  const onSendChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || !roomRef.current) return;

    const payload: UIMessage = {
      id: crypto.randomUUID(),
      from: displayName.trim(),
      createdAt: new Date().toISOString(),
      kind: 'text',
      text,
    };
    setChatInput('');
    setMessages((current) => [...current, payload]);
    await publishData({ type: 'chat', payload });
  };

  const onUploadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const upload = await getUploadUrl(file.name, file.size);
      const uploadResult = await fetch(upload.uploadUrl, { method: 'PUT', body: file });
      if (!uploadResult.ok) throw new Error(`Upload failed (${uploadResult.status})`);

      const payload: UIMessage = {
        id: upload.fileId,
        from: displayName.trim(),
        createdAt: new Date().toISOString(),
        kind: 'file',
        filename: file.name,
        size: file.size,
        downloadUrl: upload.downloadUrl,
        mimeType: file.type || 'application/octet-stream',
      };
      setMessages((current) => [...current, payload]);
      await publishData({ type: 'file', payload });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'File upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const roomTokenTitle = useMemo(() => token.toUpperCase(), [token]);
  const showShareLayout = Boolean(screenTile) && !minimizeShare;

  if (status === 'checking') return <main className="room-root"><p>Checking room...</p></main>;
  if (status === 'not-found') {
    return (
      <main className="room-root">
        <h1>Room not found</h1>
        <p>Token `{token}` was not found.</p>
        <Link to="/" className="btn ghost">Back</Link>
      </main>
    );
  }

  return (
    <main className="room-root">
      <header className="topbar">
        <div className="brand-mark compact">
          <img src="/logo.png" alt="meet37 logo" className="brand-logo" />
          <div>
            <p className="eyebrow">meet37</p>
            <strong>{roomTokenTitle}</strong>
          </div>
        </div>
        <button className="btn ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          <Icon path={theme === 'dark' ? icons.sun : icons.moon} />
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </header>

      {!room ? (
        <section className="prejoin">
          <div className="preview-box">
            {previewReady ? <video ref={previewVideoRef} autoPlay muted playsInline className="prejoin-video" /> : <p>Enable camera/mic for preview.</p>}
          </div>
          <form onSubmit={connectRoom} className="join-form">
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" maxLength={64} disabled={connecting} />
            <div className="join-actions">
              <button type="button" className="btn ghost" onClick={setupPreview} disabled={preparingMedia || previewReady}>{preparingMedia ? 'Preparing...' : 'Enable Cam/Mic'}</button>
              <button type="submit" className="btn primary" disabled={connecting || !previewReady}>{connecting ? 'Joining...' : 'Join Room'}</button>
            </div>
          </form>
        </section>
      ) : (
        <section className="meeting-body">
          <aside className="participant-rail">
            {participantCards.map((participant) => (
              <article key={participant.id} className="participant-card">
                <strong>{participant.name}</strong>
                <span>{participant.hasCamera ? 'Camera On' : 'Camera Off'}</span>
              </article>
            ))}
          </aside>

          <section className="stage-area">
            {showShareLayout && screenTile ? (
              <article className="screen-share-box">
                <div className="tile-head">
                  <strong>{screenTile.participantName}</strong>
                  <button className="btn ghost" onClick={() => setMinimizeShare(true)}>Minimize</button>
                </div>
                <MediaTrack track={screenTile.track} muted={screenTile.isLocal} />
              </article>
            ) : (
              <div className="video-grid">
                {cameraTiles.map((tile) => (
                  <article key={tile.id} className="video-box">
                    <MediaTrack track={tile.track} muted={tile.isLocal} />
                    <p>{tile.participantName}</p>
                  </article>
                ))}
              </div>
            )}
            <div className="hidden-audio-container" aria-hidden>
              {audioTracks.map((item) => <MediaTrack key={item.id} track={item.track} />)}
            </div>
          </section>

          {showChat ? (
            <aside className="chat-panel">
              <div className="chat-list">
                {messages.map((message) => (
                  <article key={message.id} className="chat-item">
                    <div className="chat-meta">
                      <strong>{message.from}</strong>
                      <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                    </div>
                    {message.kind === 'text' ? (
                      <p>{message.text}</p>
                    ) : (
                      <div className="file-message">
                        {isImageFile(message.mimeType, message.filename) ? <img src={message.downloadUrl} alt={message.filename} className="chat-image" loading="lazy" /> : null}
                        <div className="file-info">
                          <span>{message.filename}</span>
                          <small>{Math.max(1, Math.ceil(message.size / 1024))} KB</small>
                        </div>
                        <a className="btn ghost" href={message.downloadUrl} target="_blank" rel="noreferrer">
                          <Icon path={icons.download} />
                          Download
                        </a>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <form onSubmit={onSendChat} className="chat-form">
                <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Type a message" />
                <button className="btn primary" type="submit"><Icon path={icons.send} />Send</button>
                <label className="btn ghost file-upload" htmlFor="fileInput">{uploading ? 'Uploading...' : 'File'}</label>
                <input id="fileInput" type="file" onChange={onUploadFile} hidden disabled={uploading} />
              </form>
            </aside>
          ) : null}
        </section>
      )}

      {room ? (
        <footer className="control-bar">
          <button className="btn ghost" onClick={onToggleMic}><Icon path={micEnabled ? icons.mic : icons.micOff} />{micEnabled ? 'Mute' : 'Unmute'}</button>
          <button className="btn ghost" onClick={onToggleCamera}><Icon path={cameraEnabled ? icons.cam : icons.camOff} />{cameraEnabled ? 'Camera Off' : 'Camera On'}</button>
          <button className="btn ghost" onClick={onToggleScreenShare}><Icon path={icons.share} />{screenShareEnabled ? 'Stop Share' : 'Share Screen'}</button>
          {screenTile ? <button className="btn ghost" onClick={() => setMinimizeShare((value) => !value)}>{minimizeShare ? 'Show Share' : 'Hide Share'}</button> : null}
          <button className="btn ghost" onClick={() => setShowChat((value) => !value)}><Icon path={icons.chat} />{showChat ? 'Hide Chat' : 'Show Chat'}</button>
          <button
            className="btn danger"
            onClick={() => {
              roomRef.current?.disconnect();
              roomRef.current = null;
              setRoom(null);
              navigate('/');
            }}
          >
            <Icon path={icons.leave} />Leave
          </button>
        </footer>
      ) : null}

      {error ? <p className="status-error">{error}</p> : null}
    </main>
  );
}
