import type { ReactNode } from 'react';

export function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-surface-2 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-semibold text-main">{value}</p>
    </div>
  );
}
