export const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** The platform's modifier key cap: ⌘ on Apple devices, Ctrl elsewhere. */
export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl";
