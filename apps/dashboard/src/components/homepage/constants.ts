import type { OperationalEventCategory } from "./types.js";

export const EVENT_CATEGORY_STYLES: Record<
  OperationalEventCategory,
  { accent: string; border: string; glow: string }
> = {
  INGESTION: {
    accent: "text-[var(--color-accent)]",
    border: "border-[rgba(56,189,248,0.18)]",
    glow: "shadow-[0_0_12px_rgba(56,189,248,0.08)]",
  },
  RETRIEVAL: {
    accent: "text-[#67e8f9]",
    border: "border-[rgba(103,232,249,0.16)]",
    glow: "shadow-[0_0_12px_rgba(103,232,249,0.06)]",
  },
  REINFORCEMENT: {
    accent: "text-[var(--color-success)]",
    border: "border-[rgba(74,222,128,0.16)]",
    glow: "shadow-[0_0_12px_rgba(74,222,128,0.06)]",
  },
  COMPRESSION: {
    accent: "text-[var(--color-text-secondary)]",
    border: "border-[rgba(161,161,170,0.14)]",
    glow: "shadow-[0_0_10px_rgba(161,161,170,0.04)]",
  },
  MEMORY_HEALTH: {
    accent: "text-[var(--color-warning)]",
    border: "border-[rgba(251,191,36,0.16)]",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.06)]",
  },
};
