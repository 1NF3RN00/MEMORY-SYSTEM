/**
 * Semantic Core Design System — Color Tokens
 *
 * Philosophy: Matte graphite surfaces, sharp white type, single accent channel.
 * No neon. No cyberpunk. Operational seriousness.
 */
export const colors = {
  void: "#050506",
  surface: {
    0: "#0a0a0b",
    1: "#111113",
    2: "#18181b",
    3: "#1f1f23",
    elevated: "#232328",
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.04)",
    default: "rgba(255, 255, 255, 0.07)",
    strong: "rgba(255, 255, 255, 0.11)",
  },
  text: {
    primary: "#fafafa",
    secondary: "#a1a1aa",
    tertiary: "#71717a",
    muted: "#52525b",
  },
  accent: {
    DEFAULT: "#38bdf8",
    soft: "rgba(56, 189, 248, 0.12)",
    muted: "rgba(56, 189, 248, 0.06)",
  },
  semantic: {
    success: "#4ade80",
    warning: "#fbbf24",
    danger: "#f87171",
  },
} as const;

export const spacing = {
  /** 4px — micro gaps, icon padding */
  xs: "0.25rem",
  /** 8px — tight component internal */
  sm: "0.5rem",
  /** 12px — default component gap */
  md: "0.75rem",
  /** 16px — panel padding */
  lg: "1rem",
  /** 20px — panel padding (generous) */
  xl: "1.25rem",
  /** 32px — section separation */
  "2xl": "2rem",
  /** 40px — page margins */
  "3xl": "2.5rem",
} as const;

export const typography = {
  fontFamily: {
    sans: '"Inter", system-ui, -apple-system, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
  },
  scale: {
    caption: { size: "0.6875rem", lineHeight: "1.4", weight: 500, tracking: "0.04em" },
    label: { size: "0.6875rem", lineHeight: "1.4", weight: 500, tracking: "0.06em" },
    body: { size: "0.875rem", lineHeight: "1.55", weight: 400, tracking: "0" },
    bodySm: { size: "0.8125rem", lineHeight: "1.5", weight: 400, tracking: "0" },
    heading: { size: "1rem", lineHeight: "1.3", weight: 600, tracking: "-0.01em" },
    title: { size: "1.5rem", lineHeight: "1.2", weight: 600, tracking: "-0.025em" },
    display: { size: "1.875rem", lineHeight: "1.15", weight: 600, tracking: "-0.03em" },
  },
} as const;

export const radius = {
  sm: "6px",
  md: "8px",
  lg: "10px",
  xl: "12px",
} as const;
