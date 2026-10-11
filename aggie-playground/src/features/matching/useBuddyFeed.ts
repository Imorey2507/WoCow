"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBuddyFeed, respondToBuddyRequest, sendBuddyRequest } from "./api";
import type { Profile } from "@/lib/types";
import type { BuddyRequest } from "./buddies";

interface Snapshot {
  viewerId: string;
  people: Profile[];
  requests: BuddyRequest[];
  names: Record<string, Profile>;
  ready: boolean;
  error: string | null;
}

export function useBuddyFeed(viewerId: string | undefined) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const inflightAction = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const currentViewer = useRef(viewerId);
  useEffect(() => { currentViewer.current = viewerId; }, [viewerId]);

  const refresh = useCallback(async () => {
    controller.current?.abort();
    if (!viewerId) return;
    const request = new AbortController();
    controller.current = request;
    try {
      const result = await getBuddyFeed(viewerId, request.signal);
      if (!request.signal.aborted) setSnapshot({ viewerId, ...result, ready: true, error: null });
    } catch (error) {
      if (!request.signal.aborted) setSnapshot((previous) => ({
        viewerId,
        people: previous?.viewerId === viewerId ? previous.people : [],
        requests: previous?.viewerId === viewerId ? previous.requests : [],
        names: previous?.viewerId === viewerId ? previous.names : {},
        ready: true,
        error: error instanceof Error ? error.message : "Could not load matches.",
      }));
    }
  }, [viewerId]);

  useEffect(() => {
    void refresh();
    if (!viewerId) return;
    // The current schema does not publish buddy_requests or profiles to Realtime.
    // Polling/focus refresh keeps both viewers in sync without altering shared migrations.
    const timer = setInterval(() => void refresh(), 30_000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      controller.current?.abort();
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [viewerId, refresh]);

  const act = useCallback(async (key: string, action: () => Promise<void>) => {
    if (!viewerId) return "Sign in to connect.";
    if (inflightAction.current) return "Request already in progress.";
    inflightAction.current = true;
    setBusy(key);
    try {
      await action();
      if (currentViewer.current === viewerId) await refresh();
      return null;
    } catch (error) {
      if (currentViewer.current === viewerId) await refresh();
      return error instanceof Error ? error.message : "Could not update buddy request.";
    } finally {
      inflightAction.current = false;
      setBusy(null);
    }
  }, [viewerId, refresh]);

  // Never display another account's in-flight/cached data after an auth change.
  const data = snapshot?.viewerId === viewerId ? snapshot : null;
  return {
    others: data?.people ?? [], reqs: data?.requests ?? [], names: data?.names ?? {},
    ready: data?.ready ?? false, error: data?.error ?? null, busy, refresh,
    connect: (id: string) => act(id, () => sendBuddyRequest(viewerId!, id)),
    respond: (id: string, status: "accepted" | "declined") =>
      act(id, () => respondToBuddyRequest(viewerId!, id, status)),
  };
}
