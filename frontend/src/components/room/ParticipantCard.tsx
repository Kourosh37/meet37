import { memo } from 'react';

export type ParticipantCardData = {
  id: string;
  name: string;
  hasCamera: boolean;
};

function ParticipantCardBase({ participant }: { participant: ParticipantCardData }) {
  return (
    <article className="rounded-2xl border border-[color:var(--border)] bg-surface-2 p-4">
      <p className="text-sm font-semibold text-main">{participant.name}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted">
        {participant.hasCamera ? 'Camera On' : 'Camera Off'}
      </p>
    </article>
  );
}

export const ParticipantCard = memo(ParticipantCardBase);
