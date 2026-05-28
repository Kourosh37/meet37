"use client";

import { RadioTower } from "lucide-react";

interface SFUBannerProps {
  active?: boolean;
}

export function SFUBanner({ active = false }: SFUBannerProps) {
  if (!active) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
      <RadioTower className="size-4" />
      Large-room relay mode is active.
    </div>
  );
}
