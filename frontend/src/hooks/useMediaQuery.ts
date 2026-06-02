"use client";

import { useEffect, useMemo, useState } from "react";

export const breakpoints = {
  lg: 1024,
  md: 768,
  sm: 640,
  xl: 1280,
  "2xl": 1536
} as const;

export type Breakpoint = keyof typeof breakpoints;

function getMatches(query: string, defaultValue: boolean) {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string, defaultValue = false) {
  const [matches, setMatches] = useState(() => getMatches(query, defaultValue));

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    function handleChange(event: MediaQueryListEvent) {
      setMatches(event.matches);
    }

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}

export function useBreakpoint() {
  const isSm = useMediaQuery(`(min-width: ${breakpoints.sm}px)`);
  const isMd = useMediaQuery(`(min-width: ${breakpoints.md}px)`);
  const isLg = useMediaQuery(`(min-width: ${breakpoints.lg}px)`);
  const isXl = useMediaQuery(`(min-width: ${breakpoints.xl}px)`);
  const is2Xl = useMediaQuery(`(min-width: ${breakpoints["2xl"]}px)`);

  return useMemo(
    () => ({
      current: is2Xl
        ? "2xl"
        : isXl
          ? "xl"
          : isLg
            ? "lg"
            : isMd
              ? "md"
              : isSm
                ? "sm"
                : "base",
      is2Xl,
      isDesktop: isLg,
      isLg,
      isMd,
      isMobile: !isMd,
      isSm,
      isTablet: isMd && !isLg,
      isXl
    }),
    [is2Xl, isLg, isMd, isSm, isXl]
  );
}
