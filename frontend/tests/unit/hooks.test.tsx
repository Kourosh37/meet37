import { act, renderHook } from "@testing-library/react";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { afterEach, describe, expect, it, vi } from "vitest";

type MatchMediaListener = (event: MediaQueryListEvent) => void;

function installMatchMedia(initialMatches = false) {
  let matches = initialMatches;
  const listeners = new Set<MatchMediaListener>();

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      addEventListener: (_type: string, listener: MatchMediaListener) => {
        listeners.add(listener);
      },
      dispatch: (nextMatches: boolean) => {
        matches = nextMatches;
        listeners.forEach((listener) =>
          listener({ matches, media: query } as MediaQueryListEvent)
        );
      },
      matches,
      media: query,
      removeEventListener: (_type: string, listener: MatchMediaListener) => {
        listeners.delete(listener);
      }
    }))
  });

  return {
    dispatch: (nextMatches: boolean) => {
      matches = nextMatches;
      listeners.forEach((listener) =>
        listener({
          matches,
          media: "(min-width: 768px)"
        } as MediaQueryListEvent)
      );
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shared hooks", () => {
  it("tracks browser online and offline events", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true
    });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(true);

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false
    });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.isOffline).toBe(true);
  });

  it("updates media query matches when matchMedia changes", () => {
    const media = installMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));

    expect(result.current).toBe(false);

    act(() => {
      media.dispatch(true);
    });

    expect(result.current).toBe(true);
  });

  it("runs keyboard shortcuts without stealing focus from editable fields", () => {
    const handler = vi.fn();

    renderHook(() => useKeyboard([{ handler, key: "m" }]));

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    });
    expect(handler).toHaveBeenCalledTimes(1);

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "m" })
      );
    });

    expect(handler).toHaveBeenCalledTimes(1);
    input.remove();
  });
});
