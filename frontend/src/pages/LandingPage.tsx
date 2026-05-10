import { type FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createRoom, validateRoom } from '../lib/api';

export function LandingPage() {
  const navigate = useNavigate();
  const [roomToken, setRoomToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmedToken = useMemo(() => roomToken.trim(), [roomToken]);

  const onCreateRoom = async () => {
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
  };

  const onJoinRoom = async (event: FormEvent<HTMLFormElement>) => {
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
  };

  return (
    <main className="shell landing-shell">
      <section className="hero-panel">
        <p className="eyebrow">meet37</p>
        <h1>Realtime meetings with a near-zero backend footprint</h1>
        <p className="hero-copy">
          Video, audio, chat, whiteboard sync, and file exchange run client-side over LiveKit and direct S3
          transfers. Backend handles room lifecycle and token issuance only.
        </p>
      </section>

      <section className="action-panel">
        <button type="button" className="primary-btn" onClick={onCreateRoom} disabled={busy}>
          {busy ? 'Creating...' : 'Create Room'}
        </button>

        <form className="join-form" onSubmit={onJoinRoom}>
          <label htmlFor="roomToken">Join with token</label>
          <div className="join-row">
            <input
              id="roomToken"
              value={roomToken}
              onChange={(event) => setRoomToken(event.target.value)}
              placeholder="e.g. a1b2c3d4e5f6"
              maxLength={24}
              disabled={busy}
            />
            <button type="submit" className="secondary-btn" disabled={busy}>
              {busy ? 'Checking...' : 'Join'}
            </button>
          </div>
        </form>

        {error ? <p className="status-error">{error}</p> : null}
      </section>
    </main>
  );
}

