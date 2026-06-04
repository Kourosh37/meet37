"use client";

import { useEffect } from "react";
import type { CSSProperties } from "react";

export interface FloatingReaction {
  drift: number;
  emoji: string;
  id: string;
  name: string;
  rotate: number;
  x: number;
}

interface ReactionOverlayProps {
  onDone: (id: string) => void;
  reactions: FloatingReaction[];
}

export function ReactionOverlay({ onDone, reactions }: ReactionOverlayProps) {
  useEffect(() => {
    const timers = reactions.map((reaction) =>
      window.setTimeout(() => onDone(reaction.id), 3200)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [onDone, reactions]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-20 mx-auto h-[70svh] w-full max-w-7xl overflow-hidden">
      {reactions.map((reaction) => (
        <div
          className="meet-reaction-float absolute bottom-0"
          key={reaction.id}
          style={
            {
              "--meet-reaction-drift": `${reaction.drift}px`,
              "--meet-reaction-rotate": `${reaction.rotate}deg`,
              left: `${reaction.x}%`
            } as CSSProperties
          }
        >
          <div className="meet-reaction-sway flex items-center gap-2 rounded-full border border-white/25 bg-black/55 px-3 py-2 text-white shadow-xl backdrop-blur-md">
            <span className="text-3xl leading-none">{reaction.emoji}</span>
            <span className="max-w-32 truncate text-sm font-semibold">
              {reaction.name}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
