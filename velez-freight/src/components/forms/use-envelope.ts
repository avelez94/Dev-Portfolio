"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { getFormToken } from "@/app/actions/public";

/** Fetches a signed form token on mount and exposes the honeypot field id. */
export function useEnvelope() {
  const [token, setToken] = useState("");
  const honeypotId = `hp-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const refresh = useCallback(() => {
    getFormToken().then(setToken).catch(() => setToken(""));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  // Read at submit time (event handler), never during render.
  const envelope = () => ({ token, website: (document.getElementById(honeypotId) as HTMLInputElement | null)?.value ?? "" });
  return { envelope, honeypot: honeypotId, refresh, ready: token !== "" };
}
