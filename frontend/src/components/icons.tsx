import type { PropsWithChildren } from 'react';

function IconShell({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className ?? 'h-5 w-5'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function MicIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </IconShell>
  );
}

export function MicOffIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M9 5v2" />
      <path d="M15 9V6a3 3 0 0 0-5.4-1.8" />
      <path d="M19 11a7 7 0 0 1-7 7" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
      <path d="m3 3 18 18" />
    </IconShell>
  );
}

export function CameraIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="m16 9 5-3v12l-5-3" />
    </IconShell>
  );
}

export function CameraOffIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="m16 9 5-3v12l-5-3" />
      <path d="m3 3 18 18" />
    </IconShell>
  );
}

export function ShareScreenIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <rect x="4" y="4" width="16" height="12" rx="2" />
      <path d="M12 20v-4" />
      <path d="M8 20h8" />
      <path d="m9 9 3-3 3 3" />
      <path d="M12 6v6" />
    </IconShell>
  );
}

export function ChatIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M5 6h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 4v-4H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
    </IconShell>
  );
}

export function LeaveIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" />
      <path d="m15 16 4-4-4-4" />
      <path d="M19 12H9" />
    </IconShell>
  );
}

export function SendIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="m4 12 16-8-6 16-3-7-7-1Z" />
    </IconShell>
  );
}

export function DownloadIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M12 3v11" />
      <path d="m7 9 5 5 5-5" />
      <path d="M4 20h16" />
    </IconShell>
  );
}

export function UploadIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M12 21V10" />
      <path d="m7 14 5-5 5 5" />
      <path d="M4 4h16" />
    </IconShell>
  );
}

export function SunIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4 12H2" />
      <path d="M22 12h-2" />
      <path d="m5 5 1.5 1.5" />
      <path d="m17.5 17.5 1.5 1.5" />
      <path d="m5 19 1.5-1.5" />
      <path d="m17.5 6.5 1.5-1.5" />
    </IconShell>
  );
}

export function MoonIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M21 12.8A8.5 8.5 0 0 1 11.2 3 7.5 7.5 0 1 0 21 12.8Z" />
    </IconShell>
  );
}

export function SparkIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="m12 2 1.8 4.7L18 8.5l-4.2 1.8L12 15l-1.8-4.7L6 8.5l4.2-1.8L12 2Z" />
    </IconShell>
  );
}

export function ShieldIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </IconShell>
  );
}

export function BoltIcon({ className }: { className?: string }) {
  return (
    <IconShell className={className}>
      <path d="M13 2 5 13h6l-1 9 8-11h-6l1-9Z" />
    </IconShell>
  );
}
