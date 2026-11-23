/** Whether a key event comes from a field the user is typing in, where bare letter shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

const MODAL = '[role="dialog"][aria-modal="true"], [role="alertdialog"]';

/**
 * Whether a bare-key shortcut (`C`, `/`, J/K) must not fire: during IME composition, while typing,
 * or with focus inside a modal dialog.
 */
export function isBareKeyBlocked(e: { isComposing: boolean; target: EventTarget | null }): boolean {
  return (
    e.isComposing ||
    isTypingTarget(e.target) ||
    (e.target instanceof Element && !!e.target.closest(MODAL))
  );
}
