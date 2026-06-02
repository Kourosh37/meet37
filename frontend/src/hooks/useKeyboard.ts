"use client";

import { useEffect } from "react";

type KeyboardHandler = (event: KeyboardEvent) => void;

interface KeyboardShortcut {
  altKey?: boolean;
  ctrlKey?: boolean;
  enabled?: boolean;
  handler: KeyboardHandler;
  key: string;
  metaKey?: boolean;
  shiftKey?: boolean;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea"
  );
}

function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut) {
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    Boolean(event.altKey) === Boolean(shortcut.altKey) &&
    Boolean(event.ctrlKey) === Boolean(shortcut.ctrlKey) &&
    Boolean(event.metaKey) === Boolean(shortcut.metaKey) &&
    Boolean(event.shiftKey) === Boolean(shortcut.shiftKey)
  );
}

export function useKeyboard(shortcuts: KeyboardShortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const shortcut = shortcuts.find(
        (candidate) =>
          candidate.enabled !== false && matchesShortcut(event, candidate)
      );

      if (!shortcut) {
        return;
      }

      event.preventDefault();
      shortcut.handler(event);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, shortcuts]);
}
