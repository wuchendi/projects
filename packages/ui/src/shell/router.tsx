"use client";

import NextLink, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useSyncExternalStore, useTransition } from "react";

export type ShellLinkProps = Omit<ComponentProps<"a">, "href"> & { href: string };

// Next has no router-wide pending state: shell links and `useShellNavigate` report theirs here.
let pending = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function usePendingReport(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const report = (delta: number) => {
      pending += delta;
      for (const listener of listeners) listener();
    };
    report(1);
    return () => report(-1);
  }, [active]);
}

function LinkPending() {
  usePendingReport(useLinkStatus().pending);
  return null;
}

/** A link to an app path; `href` may carry a query and a hash. */
export function ShellLink({ href, children, ...props }: ShellLinkProps) {
  return (
    // Next's handler props reject an explicit `undefined`, which it ignores at runtime.
    <NextLink href={href} {...(props as Omit<ComponentProps<typeof NextLink>, "href">)}>
      {children}
      <LinkPending />
    </NextLink>
  );
}

/** The current path, without the base path. */
export function useShellPathname(): string {
  return usePathname() ?? "/";
}

/** Navigates to an app path. */
export function useShellNavigate(): (href: string) => void {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  usePendingReport(isPending);
  return useCallback(href => startTransition(() => router.push(href)), [router]);
}

/** Whether a navigation started by the shell is pending. */
export function useShellNavigating(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => pending > 0,
    () => false,
  );
}
