import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Room, RoomEvent, Track, type Participant } from 'livekit-client';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  CameraIcon,
  CameraOffIcon,
  ChatIcon,
  UploadIcon,
  LeaveIcon,
  MicIcon,
  MicOffIcon,
  MoonIcon,
  SendIcon,
  ShareScreenIcon,
  SunIcon,
} from '../components/icons';
import {
  ChatItem,
  type ChatItemMessage,
  ParticipantCard,
  type ParticipantCardData,
  VideoTile,
  type VideoTileData,
  MediaTrack,
} from '../components/room';
import { useNotify } from '../components/notificationsContext';
import { getLiveKitUrl, getUploadUrl, joinRoom, validateRoom } from '../lib/api';

export type UIMessage = ChatItemMessage;

type RoomDataMessage =
  | { type: 'chat'; payload: UIMessage }
  | { type: 'file'; payload: UIMessage };

interface AudioTrackItem {
  id: string;
  track: Track;
}

export function RoomPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const params = useParams();
  const token = (params.token ?? '').trim().toLowerCase();

  const [status, setStatus] = useState<'checking' | 'not-found' | 'ready'>('checking');
  const [displayName, setDisplayName] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [participantCards, setParticipantCards] = useState<ParticipantCardData[]>([]);
  const [cameraTiles, setCameraTiles] = useState<VideoTileData[]>([]);
  const [screenTile, setScreenTile] = useState<VideoTileData | null>(null);
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
  const [previewReady, setPreviewReady] = useState(false);
  const [copiedItem, setCopiedItem] = useState<'token' | 'link' | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = window.localStorage.getItem('meet37-theme');
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  });

  const roomRef = useRef<Room | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('meet37-theme', theme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    const checkRoom = async () => {
      try {
        const exists = await validateRoom(token);
        if (mounted) setStatus(exists ? 'ready' : 'not-found');
      } catch (checkError) {
        if (!mounted) return;
        notify.error(checkError instanceof Error ? checkError.message : 'Room validation failed');
        setStatus('not-found');
      }
    };
    checkRoom();
    return () => {
      mounted = false;
    };
  }, [notify, token]);

  const syncTracks = useCallback((targetRoom: Room) => {
    const nextCameraTiles: VideoTileData[] = [];
    const nextAudioTracks: AudioTrackItem[] = [];
    const nextCards: ParticipantCardData[] = [];
    let nextScreenTile: VideoTileData | null = null;

    const collect = (participant: Participant, isLocal: boolean) => {
      let hasCamera = false;
      participant.trackPublications.forEach((publication, sid) => {
        const track = publication.track;
        if (!track) return;

        if (track.kind === Track.Kind.Video) {
          const isScreenShare = publication.source === Track.Source.ScreenShare;
          const tile: VideoTileData = {
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  const setupPreview = useCallback(async () => {
    if (previewStreamRef.current) return;
    setPreparingMedia(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          aspectRatio: { ideal: 1 },
          frameRate: { ideal: 15, max: 24 },
        },
      });
      previewStreamRef.current = stream;
      setPreviewReady(true);
    } catch (mediaError) {
      notify.error(mediaError instanceof Error ? mediaError.message : 'Failed to access camera/microphone');
    } finally {
      setPreparingMedia(false);
    }
  }, [notify]);

  const connectRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      notify.error('Display name is required');
      return;
    }

    setConnecting(true);

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
      notify.error(connectError instanceof Error ? connectError.message : 'Failed to join room');
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
      notify.error('Another participant is sharing screen right now.');
      return;
    }

    try {
      const next = !screenShareEnabled;
      await activeRoom.localParticipant.setScreenShareEnabled(next);
      setScreenShareEnabled(next);
      setMinimizeShare(false);
      syncTracks(activeRoom);
    } catch (shareError) {
      notify.error(shareError instanceof Error ? shareError.message : 'Screen share failed');
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
      notify.error(uploadError instanceof Error ? uploadError.message : 'File upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const roomTokenTitle = useMemo(() => token.toUpperCase(), [token]);
  const roomLink = useMemo(() => `${window.location.origin}/room/${token}`, [token]);
  const showShareLayout = Boolean(screenTile) && !minimizeShare;
  const chatIdentity = displayName.trim();

  const onCopy = useCallback(async (value: string, kind: 'token' | 'link') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedItem(kind);
      notify.success(kind === 'link' ? 'Link copied' : 'Token copied');
      window.setTimeout(() => setCopiedItem(null), 1400);
    } catch {
      notify.error('Copy failed');
    }
  }, [notify]);

  if (status === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-muted">
        Checking room...
      </main>
    );
  }

  if (status === 'not-found') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <section className="panel max-w-lg text-center">
          <h1 className="text-2xl font-semibold text-main">Room not found</h1>
          <p className="mt-2 text-sm text-muted">Token "{token}" was not found.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => onCopy(token, 'token')}>
              {copiedItem === 'token' ? 'Copied Token' : 'Copy Token'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onCopy(roomLink, 'link')}>
              {copiedItem === 'link' ? 'Copied Link' : 'Copy Link'}
            </button>
          </div>
          <Link to="/" className="btn btn-ghost mt-6 inline-flex">
            Back home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 px-6 py-5">
      <header className="panel flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src="/logo.png"
            alt="meet37 logo"
            className="h-12 w-12 rounded-2xl border border-[color:var(--border)] bg-surface-2"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">meet37</p>
            <p className="text-lg font-semibold text-main">Room {roomTokenTitle}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => onCopy(token, 'token')}>
                {copiedItem === 'token' ? 'Copied Token' : 'Copy Token'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => onCopy(roomLink, 'link')}>
                {copiedItem === 'link' ? 'Copied Link' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </header>

      {!room ? (
        <section className="panel grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="mx-auto aspect-square w-full max-w-[22rem] rounded-3xl border border-[color:var(--border)] bg-black/60 p-4">
            {previewReady ? (
              <video
                ref={previewVideoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full rounded-2xl bg-black object-contain object-center"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-black/30 text-sm text-muted">
                Enable camera and mic for a preview.
              </div>
            )}
          </div>
          <form onSubmit={connectRoom} className="grid content-start gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Display name</p>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Enter your name"
                maxLength={64}
                className="input mt-2"
                disabled={connecting}
              />
            </div>
            <div className="grid gap-3">
              <button
                type="button"
                className="btn btn-ghost w-full disabled:cursor-not-allowed disabled:opacity-50"
                onClick={setupPreview}
                disabled={preparingMedia || previewReady}
              >
                {preparingMedia ? 'Preparing...' : previewReady ? 'Preview Ready' : 'Enable Cam/Mic'}
              </button>
              <button
                type="submit"
                className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                disabled={connecting || !previewReady}
              >
                {connecting ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section
          className={`grid min-h-0 flex-1 gap-4 ${
            showChat ? 'xl:grid-cols-[260px_minmax(0,1fr)_360px]' : 'xl:grid-cols-[260px_minmax(0,1fr)]'
          }`}
        >
          <aside className="panel flex min-h-0 flex-col gap-3 overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Participants</p>
              <span className="badge">{participantCards.length}</span>
            </div>
            <div className="grid gap-3">
              {participantCards.map((participant) => (
                <ParticipantCard key={participant.id} participant={participant} />
              ))}
            </div>
          </aside>

          <section className="panel-dark grid min-h-0 gap-4">
            {showShareLayout && screenTile ? (
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted">Screen share</p>
                    <p className="text-lg font-semibold text-main">{screenTile.participantName}</p>
                  </div>
                  <button className="btn btn-ghost" onClick={() => setMinimizeShare(true)}>
                    Minimize
                  </button>
                </div>
                <div className="h-[360px] overflow-hidden rounded-3xl border border-[color:var(--border)] bg-black">
                  <VideoTile tile={screenTile} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {cameraTiles.map((tile) => (
                    <VideoTile key={tile.id} tile={tile} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cameraTiles.map((tile) => (
                  <VideoTile key={tile.id} tile={tile} />
                ))}
              </div>
            )}

            <div className="h-0 w-0 overflow-hidden" aria-hidden>
                {audioTracks.map((item) => (
                  <MediaTrack key={item.id} track={item.track} />
                ))}
              </div>
          </section>

          {showChat ? (
            <aside className="panel flex min-h-0 flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Chat</p>
                <span className="badge">{messages.length}</span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto no-scrollbar">
                {messages.map((message) => (
                  <ChatItem key={message.id} message={message} isSelf={chatIdentity === message.from} />
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={onSendChat} className="grid gap-2">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Type a message"
                  className="input"
                />
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <button className="btn btn-primary" type="submit">
                    <SendIcon className="h-4 w-4" />
                    Send
                  </button>
                  <label className="btn btn-ghost" htmlFor="fileInput">
                    <UploadIcon className="h-4 w-4" />
                    {uploading ? 'Uploading...' : 'File'}
                  </label>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowChat(false)}>
                    <ChatIcon className="h-4 w-4" />
                    Hide
                  </button>
                </div>
                <input id="fileInput" type="file" onChange={onUploadFile} hidden disabled={uploading} />
              </form>
            </aside>
          ) : null}
        </section>
      )}

      {room ? (
        <footer className="panel flex flex-wrap items-center gap-2">
          <button className="btn btn-ghost" onClick={onToggleMic}>
            {micEnabled ? <MicIcon className="h-4 w-4" /> : <MicOffIcon className="h-4 w-4" />}
            {micEnabled ? 'Mute' : 'Unmute'}
          </button>
          <button className="btn btn-ghost" onClick={onToggleCamera}>
            {cameraEnabled ? <CameraIcon className="h-4 w-4" /> : <CameraOffIcon className="h-4 w-4" />}
            {cameraEnabled ? 'Camera Off' : 'Camera On'}
          </button>
          <button className="btn btn-ghost" onClick={onToggleScreenShare}>
            <ShareScreenIcon className="h-4 w-4" />
            {screenShareEnabled ? 'Stop Share' : 'Share Screen'}
          </button>
          {screenTile ? (
            <button className="btn btn-ghost" onClick={() => setMinimizeShare((value) => !value)}>
              {minimizeShare ? 'Show Share' : 'Hide Share'}
            </button>
          ) : null}
          <button className="btn btn-ghost" onClick={() => setShowChat((value) => !value)}>
            <ChatIcon className="h-4 w-4" />
            {showChat ? 'Hide Chat' : 'Show Chat'}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              roomRef.current?.disconnect();
              roomRef.current = null;
              setRoom(null);
              navigate('/');
            }}
          >
            <LeaveIcon className="h-4 w-4" />
            Leave
          </button>
        </footer>
      ) : null}
    </main>
  );
}
