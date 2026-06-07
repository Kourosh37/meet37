"use client";

import { cn } from "@/lib/utils/cn";

const bars = Array.from({ length: 12 }, (_, index) => index);

interface LoadingSpinnerProps {
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClass = {
  lg: "size-8",
  md: "size-5",
  sm: "size-4"
};

export function LoadingSpinner({
  className,
  label = "Loading",
  size = "md"
}: LoadingSpinnerProps) {
  return (
    <span
      aria-label={label}
      className={cn(
        "meet-loading-spinner relative inline-block text-current",
        sizeClass[size],
        className
      )}
      role="status"
    >
      {bars.map((bar) => (
        <span
          className="meet-loading-spinner-bar"
          key={bar}
          style={{
            animationDelay: `${-1.2 + bar * 0.1}s`,
            transform: `rotate(${bar * 30 || 0.0001}deg) translate(146%)`
          }}
        />
      ))}
    </span>
  );
}
