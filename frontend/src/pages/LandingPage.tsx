import { type FormEvent, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BoltIcon, ShieldIcon, SparkIcon } from '../components/icons';
import { Badge, SectionCard } from '../components/ui';
import { Stat } from '../components/stat';
import { createRoom, validateRoom } from '../lib/api';

export function LandingPage() {
  const navigate = useNavigate();
  const [roomToken, setRoomToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmedToken = useMemo(() => roomToken.trim(), [roomToken]);

  const onCreateRoom = useCallback(async () => {
    setError(null);
    setBusy(true);

    try {
      const token = await createRoom();
      navigate(`/room/${token}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create room');
    } finally {
      setBusy(false);
    }
  }, [navigate]);

  const onJoinRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!trimmedToken) {
        setError('Enter a room token');
        return;
      }

      setError(null);
      setBusy(true);

      try {
        const exists = await validateRoom(trimmedToken);
        if (!exists) {
          setError('Room was not found');
          return;
        }

        navigate(`/room/${trimmedToken}`);
      } catch (joinError) {
        setError(joinError instanceof Error ? joinError.message : 'Failed to validate room');
      } finally {
        setBusy(false);
      }
    },
    [navigate, trimmedToken],
  );

  return (
    <main className="min-h-screen">
      <div className="shell grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard className="relative overflow-hidden">
          <div className="absolute -right-20 top-10 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

          <div className="relative z-10 flex items-center gap-4">
            <img
              src="/logo.png"
              alt="meet37 logo"
              className="h-12 w-12 rounded-2xl border border-[color:var(--border)] bg-surface-2"
            />
            <div>
              <Badge>meet37</Badge>
              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-muted">Realtime collaboration</p>
            </div>
          </div>

          <h1 className="relative z-10 mt-6 text-4xl font-semibold leading-tight text-main sm:text-5xl">
            Meet faster, collaborate live, and keep the backend feather-light.
          </h1>
          <p className="relative z-10 mt-4 text-lg text-muted">
            Video, audio, chat, whiteboard sync, and file exchange run client-side over LiveKit and direct S3
            transfer. The API only handles room lifecycle and token issuance.
          </p>

          <div className="relative z-10 mt-8 grid gap-4 sm:grid-cols-3">
            <Stat label="Join flow" value="2 Calls" icon={<SparkIcon className="h-5 w-5 text-emerald-300" />} />
            <Stat label="File path" value="0 Proxy" icon={<ShieldIcon className="h-5 w-5 text-emerald-300" />} />
            <Stat label="Latency" value="Live" icon={<BoltIcon className="h-5 w-5 text-emerald-300" />} />
          </div>

          <div className="relative z-10 mt-8 grid gap-3 text-sm text-muted">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              <span>Peer-first media pipeline with adaptive streaming.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              <span>Token-based room access with Redis-backed throttling.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              <span>Direct-to-object storage for uploads and downloads.</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="relative flex flex-col justify-between gap-8">
          <div>
            <h2 className="text-2xl font-semibold text-main">Start or join a room</h2>
            <p className="mt-2 text-sm text-muted">Create a new room or jump in with a token.</p>
          </div>

          <div className="grid gap-4">
            <button
              type="button"
              className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onCreateRoom}
              disabled={busy}
            >
              {busy ? 'Creating...' : 'Create Room'}
            </button>

            <form className="grid gap-3" onSubmit={onJoinRoom}>
              <label className="text-xs uppercase tracking-[0.2em] text-muted" htmlFor="roomToken">
                Join with token
              </label>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  id="roomToken"
                  value={roomToken}
                  onChange={(event) => setRoomToken(event.target.value)}
                  placeholder="e.g. a1b2c3d4e5f6"
                  maxLength={24}
                  className="input"
                  disabled={busy}
                />
                <button
                  type="submit"
                  className="btn btn-ghost w-full disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy}
                >
                  {busy ? 'Checking...' : 'Join'}
                </button>
              </div>
            </form>

            {error ? <p className="text-sm text-red-200">{error}</p> : null}
          </div>

          <div className="rounded-2xl border border-[color:var(--border)] bg-surface-2 p-4 text-sm text-muted">
            Tip: Keep the room token handy to rejoin quickly. Tokens are case-insensitive.
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
