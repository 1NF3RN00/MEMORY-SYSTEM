import { motion } from "framer-motion";

const TELEMETRY = [
  "SCOPE::MIDDLEWARE",
  "AUTH::SUPABASE",
  "ISOLATION::WORKSPACE",
  "REPLAY::DETERMINISTIC",
  "TRACE::APPEND_ONLY",
];

export function OperationalBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,189,248,0.15), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(56,189,248,0.06), transparent)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0H0V48" fill="none" stroke="rgba(56,189,248,0.5)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {TELEMETRY.map((line, i) => (
        <motion.div
          key={line}
          className="absolute font-mono text-[0.625rem] tracking-[0.12em] text-[var(--color-accent)]/30"
          style={{ left: `${8 + i * 14}%`, top: `${12 + (i % 3) * 28}%` }}
          animate={{ opacity: [0.15, 0.45, 0.15] }}
          transition={{ duration: 4 + i * 0.7, repeat: Infinity, ease: "easeInOut" }}
        >
          {line}
        </motion.div>
      ))}
      <motion.div
        className="absolute left-1/2 top-0 h-px w-[60%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--color-accent)]/40 to-transparent"
        animate={{ opacity: [0.2, 0.8, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </div>
  );
}
