"use client";

/**
 * Shared loading / empty / error / unconfigured states.
 *
 * Owner: Person 1. Kept in one place so Discover, Profile and any future page
 * present the same shapes and the same accessibility semantics.
 */

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

/**
 * Skeleton cards. `role="status"` + `aria-busy` means a screen reader is told
 * something is loading instead of being read an empty page.
 */
export function LoadingGrid({ count = 3, label = "Loading activities…" }: { count?: number; label?: string }) {
  return (
    <div className={GRID} role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-3xl bg-white/60" aria-hidden="true" />
      ))}
    </div>
  );
}

/**
 * A failure the user can act on. `retrying` both disables the button and
 * changes its label, which is what stops a second click from firing a second
 * request.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retrying = false,
  retryLabel = "Try again",
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
  retryLabel?: string;
}) {
  return (
    <div role="alert" className="sticker-sm rounded-3xl border-2 border-ink bg-coral/40 p-6 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {message && <p className="mx-auto mt-1 max-w-md break-words text-sm font-semibold text-ink/80">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          aria-busy={retrying || undefined}
          className="sticker-sm pop mt-3 rounded-full bg-white px-4 py-2 font-display font-bold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retrying ? "Retrying…" : retryLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Shown instead of the feed when no Supabase project is configured. The point
 * is that the page must never look like a legitimately empty campus — and it
 * must never invent rows to fill the gap.
 */
export function NotConfiguredNotice({ className = "" }: { className?: string }) {
  return (
    <div role="status" className={`sticker-sm rounded-3xl border-2 border-dashed border-ink bg-sun/40 p-6 text-center ${className}`}>
      <p className="font-display text-lg font-bold">⚙️ Backend not connected</p>
      <p className="mx-auto mt-1 max-w-md text-sm font-semibold text-ink/80">
        Add <code className="rounded bg-white/70 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-white/70 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
        <code className="rounded bg-white/70 px-1">.env.local</code>, then restart the dev server.
      </p>
      <p className="mx-auto mt-2 max-w-md text-xs font-bold text-ink/60">
        Nothing here is mocked. Real activities appear once the database is connected.
      </p>
    </div>
  );
}
