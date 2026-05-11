import { type FormEvent, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, SectionCard } from '../components/ui';
import { useNotify } from '../components/notificationsContext';
import { createRoom, validateRoom } from '../lib/api';

export function LandingPage() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [roomToken, setRoomToken] = useState('');
  const [busy, setBusy] = useState(false);

  const trimmedToken = useMemo(() => roomToken.trim(), [roomToken]);

  const onCreateRoom = useCallback(async () => {
    setBusy(true);

    try {
      const token = await createRoom();
      navigate(`/room/${token}`);
    } catch (createError) {
      notify.error(createError instanceof Error ? createError.message : 'Failed to create room');
    } finally {
      setBusy(false);
    }
  }, [navigate, notify]);

  const onJoinRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!trimmedToken) {
        notify.error('Enter a room token');
        return;
      }

      setBusy(true);

      try {
        const exists = await validateRoom(trimmedToken);
        if (!exists) {
          notify.error('Room was not found');
          return;
        }

        navigate(`/room/${trimmedToken}`);
      } catch (joinError) {
        notify.error(joinError instanceof Error ? joinError.message : 'Failed to validate room');
      } finally {
        setBusy(false);
      }
    },
    [navigate, notify, trimmedToken],
  );

  return (
    <main className="min-h-screen">
      <div className="shell grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <SectionCard className="relative order-2 overflow-hidden lg:order-1">
          <div className="absolute -right-20 top-10 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />

          <div className="relative z-10 flex items-center gap-5">
            <img
              src="/logo.png"
              alt="meet37 logo"
              className="h-24 w-24 rounded-3xl border border-[color:var(--border)] bg-surface-2 p-1 sm:h-28 sm:w-28"
            />
            <div>
              <Badge>meet37</Badge>
              <p className="mt-2 text-sm uppercase tracking-[0.2em] text-muted">Realtime collaboration</p>
            </div>
          </div>

          <h1 className="relative z-10 mt-6 text-4xl font-semibold leading-tight text-main sm:text-5xl">
            Fast meetings. Simple sharing.
          </h1>
          <p className="relative z-10 mt-4 text-lg text-muted">Create a room, share the token, and jump in.</p>
        </SectionCard>

        <SectionCard className="relative order-1 flex flex-col justify-between gap-8 lg:order-2">
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

          </div>

          <div className="rounded-2xl border border-[color:var(--border)] bg-surface-2 p-4 text-sm text-muted">
            Tip: Keep the room token handy to rejoin quickly. Tokens are case-insensitive.
          </div>
        </SectionCard>
      </div>
    </main>
  );
}
