"use client";

import { useEffect, useState } from "react";

function getOnlineStatus() {
  if (typeof navigator === "undefined") {
    return true;
  }

  return navigator.onLine;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(getOnlineStatus);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(getOnlineStatus());

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOffline: !isOnline,
    isOnline
  };
}
