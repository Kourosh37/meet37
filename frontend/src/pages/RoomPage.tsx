import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { getLiveKitUrl, getUploadUrl, joinRoom, validateRoom } from '../lib/api';
import type { ChatMessage, FileMessage, RoomDataMessage } from '../types';

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

function IconMic() {
  return <span aria-hidden>🎙️</span>;
}

function IconCam() {
  return <span aria-hidden>📹</span>;
}

function IconShare() {
  return <span aria-hidden>🖥️</span>;
}

function IconLeave() {
  return <span aria-hidden>⏏️</span>;
}

function IconCopy() {
  return <span aria-hidden>📋</span>;
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
  const token = (params.token ?? '').trim().toLowerCase();

  const [status, setStatus] = useState<'checking' | 'not-found' | 'ready'>('checking');
  const [displayName, setDisplayName] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [videoTiles, setVideoTiles] = useState<VideoTile[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrackItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<FileMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [preparingMedia, setPreparingMedia] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const roomRef = useRef<Room | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

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
    if (!video || !stream) {
      return;
    }
    video.srcObject = stream;
  }, [previewReady]);

  const setupPreview = useCallback(async () => {
    if (previewStreamRef.current) {
      return;
    }

    setPreparingMedia(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      previewStreamRef.current = stream;
      setPreviewReady(true);
      setMicEnabled(true);
      setCameraEnabled(true);
    } catch (mediaError) {
      setError(mediaError instanceof Error ? mediaError.message : 'Failed to access camera/microphone');
    } finally {
      setPreparingMedia(false);
    }
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
      nextRoom.on(RoomEvent.ActiveDeviceChanged, onTrackEvent);

      nextRoom.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const message = JSON.parse(new TextDecoder().decode(payload)) as RoomDataMessage;
          if (message.type === 'chat') {
            setChatMessages((current) => [...current, message.payload]);
            return;
          }
          if (message.type === 'file') {
            setFiles((current) => [...current, message.payload]);
          }
        } catch (decodeError) {
          console.warn('Failed to decode room data packet', decodeError);
        }
      });

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
      const message = connectError instanceof Error ? connectError.message : 'Failed to join room';
      setError(message);
    } finally {
      setConnecting(false);
    }
  };

  const onToggleMic = async () => {
    if (!roomRef.current && previewStreamRef.current) {
      const next = !micEnabled;
      previewStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = next;
      });
      setMicEnabled(next);
      return;
    }

    if (!roomRef.current) {
      return;
    }

    const next = !micEnabled;
    await roomRef.current.localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  };

  const onToggleCamera = async () => {
    if (!roomRef.current && previewStreamRef.current) {
      const next = !cameraEnabled;
      previewStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = next;
      });
      setCameraEnabled(next);
      return;
    }

    if (!roomRef.current) {
      return;
    }

    const next = !cameraEnabled;
    await roomRef.current.localParticipant.setCameraEnabled(next);
    setCameraEnabled(next);
  };

  const onToggleScreenShare = async () => {
    const activeRoom = roomRef.current;
    if (!activeRoom) {
      return;
    }

    const next = !screenShareEnabled;
    try {
      await activeRoom.localParticipant.setScreenShareEnabled(
        next,
        next
          ? {
              resolution: {
                width: 1920,
                height: 1080,
                frameRate: 30,
              },
            }
          : undefined,
      );
      setScreenShareEnabled(next);
      syncTracks(activeRoom);
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : 'Screen share failed');
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
    await publishData({ type: 'chat', payload: message });
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
      await publishData({ type: 'file', payload });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'File upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const onCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError('Failed to copy room token');
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
        <Link to="/" className="secondary-link">Back to home</Link>
      </main>
    );
  }

  return (
    <main className="shell room-shell meet-room-shell">
      <header className="room-header meet-header">
        <div className="brand-mark compact">
          <img src="/logo.png" alt="meet37 logo" className="brand-logo" />
          <div>
            <p className="eyebrow">meet37 room</p>
            <h1>{roomTokenTitle}</h1>
          </div>
          <button type="button" className="token-copy-btn" onClick={onCopyToken} title="Copy room token">
            <IconCopy /> {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className="token-copy-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>

      {!room ? (
        <section className="join-panel prejoin-panel">
          <h2>Ready to join?</h2>
          <div className="prejoin-preview compact-preview card">
            {previewReady ? (
              <video ref={previewVideoRef} autoPlay muted playsInline className="prejoin-video" />
            ) : (
              <p className="status-info">Enable camera/mic for preview before joining.</p>
            )}
          </div>

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
              <button type="button" className="secondary-btn" disabled={preparingMedia || previewReady} onClick={setupPreview}>
                {preparingMedia ? 'Preparing...' : previewReady ? 'Ready' : 'Enable Cam/Mic'}
              </button>
              <button type="submit" className="primary-btn" disabled={connecting || !previewReady}>
                {connecting ? 'Connecting...' : 'Join Room'}
              </button>
            </div>
          </form>

          <div className="prejoin-actions">
            <button type="button" className="control-btn" onClick={onToggleMic} disabled={!previewReady}>
              <IconMic /> {micEnabled ? 'Mic On' : 'Mic Off'}
            </button>
            <button type="button" className="control-btn" onClick={onToggleCamera} disabled={!previewReady}>
              <IconCam /> {cameraEnabled ? 'Cam On' : 'Cam Off'}
            </button>
          </div>
        </section>
      ) : (
        <section className="meet-layout">
          <section className="video-stage card meet-stage">
            <div className="video-grid meet-grid">
              {videoTiles.map((tile) => (
                <article key={tile.id} className="video-tile meet-tile">
                  <MediaTrack track={tile.track} muted={tile.isLocal} />
                  <p>{tile.participantName}{tile.isLocal ? ' (You)' : ''}</p>
                </article>
              ))}
            </div>
            <HiddenAudioTracks tracks={audioTracks} />
          </section>

          <aside className="side-panel meet-side-panel">
            <div className="panel-block card">
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
                <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Send a message" />
                <button type="submit" className="secondary-btn">Send</button>
              </form>
            </div>

            <div className="panel-block card">
              <div className="file-header">
                <h3>Files</h3>
                <label className="upload-btn" htmlFor="fileInput">{uploading ? 'Uploading...' : 'Upload'}</label>
                <input id="fileInput" type="file" onChange={onUploadFile} hidden disabled={uploading} />
              </div>
              <ul className="file-list">
                {files.map((file) => (
                  <li key={file.id}>
                    <a href={file.downloadUrl} target="_blank" rel="noreferrer">{file.filename}</a>
                    <span>{Math.ceil(file.size / 1024)} KB - from {file.from}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="meet-controls card">
            <button type="button" className="control-btn" onClick={onToggleMic}>
              <IconMic /> {micEnabled ? 'Mute' : 'Unmute'}
            </button>
            <button type="button" className="control-btn" onClick={onToggleCamera}>
              <IconCam /> {cameraEnabled ? 'Camera Off' : 'Camera On'}
            </button>
            <button type="button" className="control-btn" onClick={onToggleScreenShare}>
              <IconShare /> {screenShareEnabled ? 'Stop Share' : 'Share Screen'}
            </button>
            <button
              type="button"
              className="control-btn danger-btn"
              onClick={() => {
                roomRef.current?.disconnect();
                roomRef.current = null;
                setRoom(null);
                navigate('/');
              }}
            >
              <IconLeave /> Leave
            </button>
          </div>
        </section>
      )}

      {error ? <p className="status-error">{error}</p> : null}
    </main>
  );
}
