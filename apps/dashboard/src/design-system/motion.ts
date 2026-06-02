/**
 * Animation Philosophy
 *
 * - Purposeful, never decorative
 * - Fast enough to feel responsive (150–250ms for micro)
 * - Slow enough to feel premium (300–400ms for page/panel)
 * - Spring physics for interactive elements only
 * - No bounce, no overshoot on data panels
 * - Stagger children at 30–50ms for list reveals
 * - Respect prefers-reduced-motion
 */
import type { Transition, Variants } from "framer-motion";

export const easing = {
  /** Apple-style deceleration */
  out: [0.16, 1, 0.3, 1] as const,
  /** Smooth in-out for panels */
  inOut: [0.4, 0, 0.2, 1] as const,
  /** Snappy micro-interactions */
  snap: [0.25, 0.1, 0.25, 1] as const,
};

export const duration = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  slow: 0.35,
  page: 0.4,
};

export const transition = {
  fast: { duration: duration.fast, ease: easing.snap } satisfies Transition,
  normal: { duration: duration.normal, ease: easing.out } satisfies Transition,
  slow: { duration: duration.slow, ease: easing.out } satisfies Transition,
  page: { duration: duration.page, ease: easing.out } satisfies Transition,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1 },
};

export const slideRight: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0 },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.06 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transition.normal,
  },
};

export const panelHover = {
  rest: { borderColor: "rgba(255, 255, 255, 0.07)" },
  hover: {
    borderColor: "rgba(255, 255, 255, 0.11)",
    transition: transition.fast,
  },
};

export const pageTransition = {
  initial: "hidden",
  animate: "visible",
  variants: fadeUp,
  transition: transition.page,
};
