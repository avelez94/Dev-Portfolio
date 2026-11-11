"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFormToken } from "@/app/actions/public";

/** Fetches a signed form token on mount and exposes the honeypot value. */
export function useEnvelope() {
  const [token, setToken] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);
  const refresh = useCallback(() => {
    getFormToken().then(setToken).catch(() => setToken(""));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const envelope = () => ({ token, website: honeypot.current?.value ?? "" });
  return { envelope, honeypot, refresh, ready: token !== "" };
}
