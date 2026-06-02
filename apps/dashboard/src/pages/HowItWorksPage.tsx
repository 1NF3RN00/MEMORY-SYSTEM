import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Panel } from "../components/ui/Panel.js";
import { Button } from "../components/ui/Button.js";
import { transition } from "../design-system/motion.js";
import { cn } from "../lib/cn.js";

/* ── Content helpers ─────────────────────────────────────── */

function FlowDiagram({ lines }: { lines: string[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-0)] p-4">
      <pre className="font-metric m-0 whitespace-pre text-[0.8125rem] leading-[1.75] text-[var(--color-accent)]">
        {lines.join("\n")}
      </pre>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="m-0 grid gap-2 p-0 list-none">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2.5 text-[0.9375rem] leading-relaxed text-[var(--color-text-secondary)]"
        >
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--color-accent)]" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="m-0 grid gap-2 p-0 list-none">
      {items.map((item, i) => (
        <li
          key={item}
          className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-[var(--color-text-secondary)]"
        >
          <span className="font-metric flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--color-border-default)] bg-[var(--color-surface-2)] text-[0.625rem] text-[var(--color-accent)]">
            {i + 1}
          </span>
          {item}
        </li>
      ))}
    </ol>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 text-[0.9375rem] leading-relaxed text-[var(--color-text-secondary)]">
      {children}
    </p>
  );
}

function Subheading({ children }: { children: ReactNode }) {
  return (
    <h3 className="m-0 text-sm font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
      {children}
    </h3>
  );
}

function ModeCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-surface-0)] p-4">
      <span className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-accent)]">
        {title}
      </span>
      <div className="mt-2 space-y-1">
        {lines.map((line) => (
          <p
            key={line}
            className="m-0 text-[0.875rem] leading-relaxed text-[var(--color-text-secondary)]"
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function HighlightQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="m-0 rounded-md border-l-2 border-[var(--color-accent)] bg-[var(--color-accent-muted)] px-4 py-3">
      <p className="m-0 text-[0.9375rem] leading-relaxed text-[var(--color-text-primary)]">
        {children}
      </p>
    </blockquote>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-[rgba(248,113,113,0.2)] bg-[var(--color-danger-soft)] px-4 py-3">
      <p className="m-0 text-[0.9375rem] leading-relaxed text-[var(--color-text-secondary)]">
        {children}
      </p>
    </div>
  );
}

function Divider() {
  return <hr className="border-0 border-t border-[var(--color-border-subtle)]" />;
}

function SlideBody({ children }: { children: ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}

/* ── Slides ──────────────────────────────────────────────── */

interface Slide {
  id: string;
  code: string;
  title: string;
  content: ReactNode;
}

const slides: Slide[] = [
  {
    id: "overview",
    code: "SYS.01",
    title: "Overview",
    content: (
      <SlideBody>
        <Prose>
          This platform is a contextual intelligence middleware system designed to improve:
        </Prose>
        <BulletList
          items={[
            "retrieval quality",
            "contextual precision",
            "operational observability",
            "token efficiency",
            "replayability",
          ]}
        />
        <Divider />
        <Callout>The system is NOT a chatbot.</Callout>
        <Prose>It is infrastructure for:</Prose>
        <BulletList
          items={[
            "contextual retrieval",
            "memory organization",
            "retrieval optimization",
            "contextual replay",
            "operational observability",
          ]}
        />
        <HighlightQuote>
          The platform helps downstream systems retrieve: the right context, at the right time,
          with high precision and full explainability.
        </HighlightQuote>
      </SlideBody>
    ),
  },
  {
    id: "core-pipeline",
    code: "PIPE.01",
    title: "Core Pipeline",
    content: (
      <SlideBody>
        <Prose>The system operates through several deterministic stages:</Prose>
        <FlowDiagram
          lines={[
            "Ingestion",
            "→ Normalization",
            "→ Chunking",
            "→ Embedding",
            "→ Retrieval",
            "→ Ranking",
            "→ Compression",
            "→ Context Assembly",
            "→ Replay + Observability",
          ]}
        />
        <Prose>Every stage is:</Prose>
        <BulletList
          items={["observable", "replayable", "explainable", "operationally inspectable"]}
        />
      </SlideBody>
    ),
  },
  {
    id: "dashboard-overview",
    code: "DASH.01",
    title: "Dashboard Overview",
    content: (
      <SlideBody>
        <Prose>
          The dashboard exposes every operational layer of the contextual infrastructure.
        </Prose>
        <Callout>This is NOT a black-box AI system.</Callout>
        <Prose>The dashboard exists to make:</Prose>
        <BulletList
          items={[
            "retrieval behavior",
            "ranking logic",
            "compression",
            "relationships",
            "replay",
            "contextual evolution",
          ]}
        />
        <Prose>fully visible and inspectable.</Prose>
      </SlideBody>
    ),
  },
  {
    id: "ingestion",
    code: "ING.01",
    title: "Ingestion",
    content: (
      <SlideBody>
        <Prose>The ingestion system imports:</Prose>
        <BulletList
          items={[
            "markdown",
            "websites",
            "documents",
            "operational notes",
            "structured contextual data",
          ]}
        />
        <Divider />
        <Subheading>What Happens During Ingestion</Subheading>
        <Prose>The system:</Prose>
        <NumberedList
          items={[
            "extracts content",
            "normalizes structure",
            "segments semantic blocks",
            "generates embeddings",
            "stores contextual metadata",
            "creates retrieval-ready memory objects",
          ]}
        />
        <Divider />
        <Subheading>Metadata</Subheading>
        <Prose>Every memory object contains:</Prose>
        <BulletList
          items={[
            "source information",
            "timestamps",
            "embedding version",
            "normalization version",
            "lineage references",
            "contextual tags",
            "operational metadata",
          ]}
        />
      </SlideBody>
    ),
  },
  {
    id: "structural-chunking",
    code: "CHNK.01",
    title: "Structural Chunking",
    content: (
      <SlideBody>
        <Prose>The platform uses deterministic structure-aware chunking.</Prose>
        <Prose>Instead of blindly splitting text, the system preserves:</Prose>
        <BulletList
          items={["headings", "semantic blocks", "bullet groups", "contextual adjacency"]}
        />
        <Prose>This improves:</Prose>
        <BulletList
          items={["retrieval precision", "contextual integrity", "semantic coherence"]}
        />
      </SlideBody>
    ),
  },
  {
    id: "retrieval-engine",
    code: "RET.01",
    title: "Retrieval Engine",
    content: (
      <SlideBody>
        <Prose>
          The retrieval engine finds the most relevant contextual information for a query.
        </Prose>
        <Divider />
        <Subheading>Retrieval Process</Subheading>
        <FlowDiagram
          lines={[
            "Query",
            "→ preprocessing",
            "→ decomposition",
            "→ metadata expansion",
            "→ vector retrieval",
            "→ reranking",
            "→ contextual assembly",
          ]}
        />
        <Divider />
        <Subheading>Retrieval Modes</Subheading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ModeCard title="Precision" lines={["Highest relevance.", "Minimal retrieval pollution."]} />
          <ModeCard title="Expanded" lines={["Broader contextual recall."]} />
          <ModeCard
            title="Exploratory"
            lines={["Relationship and contextual neighborhood exploration."]}
          />
          <ModeCard
            title="Incident Response"
            lines={["Operationally relevant, high-speed retrieval."]}
          />
        </div>
      </SlideBody>
    ),
  },
  {
    id: "query-planning",
    code: "PLAN.01",
    title: "Query Planning",
    content: (
      <SlideBody>
        <Prose>The preprocessing layer analyzes queries deterministically.</Prose>
        <Prose>The system may:</Prose>
        <BulletList
          items={[
            "extract operational concepts",
            "identify domains",
            "expand metadata",
            "apply contextual weighting",
          ]}
        />
        <Divider />
        <Prose>The system does NOT:</Prose>
        <BulletList
          items={["hallucinate concepts", "rewrite intent", "autonomously reason"]}
        />
        <Prose>Everything remains:</Prose>
        <BulletList items={["explainable", "observable", "replayable"]} />
      </SlideBody>
    ),
  },
  {
    id: "ranking",
    code: "RANK.01",
    title: "Ranking",
    content: (
      <SlideBody>
        <Prose>Retrieved memories are reranked using:</Prose>
        <BulletList
          items={[
            "semantic relevance",
            "semantic density",
            "reinforcement",
            "operational weighting",
            "contextual importance",
          ]}
        />
        <HighlightQuote>Ranking is deterministic and fully inspectable.</HighlightQuote>
      </SlideBody>
    ),
  },
  {
    id: "compression",
    code: "CMP.01",
    title: "Compression",
    content: (
      <SlideBody>
        <Prose>Compression optimizes contextual packages while preserving fidelity.</Prose>
        <Prose>Compression is:</Prose>
        <BulletList
          items={["retrieval-aware", "explainable", "bounded", "fidelity-controlled"]}
        />
        <Callout>Compression NEVER mutates source memory.</Callout>
        <HighlightQuote>
          The system prioritizes: context quality over token minimization.
        </HighlightQuote>
      </SlideBody>
    ),
  },
  {
    id: "memory-evolution",
    code: "MEM.01",
    title: "Memory Evolution",
    content: (
      <SlideBody>
        <Prose>Memories evolve operationally over time.</Prose>
        <Prose>The system tracks:</Prose>
        <BulletList
          items={[
            "reinforcement",
            "retrieval frequency",
            "recency decay",
            "archival eligibility",
          ]}
        />
        <Prose>This improves:</Prose>
        <BulletList
          items={["contextual prioritization", "retrieval quality", "operational relevance"]}
        />
      </SlideBody>
    ),
  },
  {
    id: "relationship-layer",
    code: "REL.01",
    title: "Relationship Layer",
    content: (
      <SlideBody>
        <Prose>
          The relationship layer creates bounded contextual associations between memories.
        </Prose>
        <Prose>Relationships may derive from:</Prose>
        <BulletList
          items={[
            "semantic similarity",
            "structural adjacency",
            "metadata overlap",
            "retrieval co-occurrence",
          ]}
        />
        <HighlightQuote>
          Relationships enhance retrieval but NEVER override semantic precision.
        </HighlightQuote>
      </SlideBody>
    ),
  },
  {
    id: "operational-mapping",
    code: "MAP.01",
    title: "Operational Mapping",
    content: (
      <SlideBody>
        <Prose>The operational map visualizes:</Prose>
        <BulletList
          items={[
            "contextual neighborhoods",
            "retrieval paths",
            "memory relationships",
            "operational clusters",
            "replay flows",
          ]}
        />
        <Prose>The visualization system exists for:</Prose>
        <BulletList
          items={[
            "observability",
            "explainability",
            "retrieval diagnostics",
            "contextual exploration",
          ]}
        />
      </SlideBody>
    ),
  },
  {
    id: "replay-system",
    code: "HIST.01",
    title: "Replay System",
    content: (
      <SlideBody>
        <Prose>Every retrieval operation is replayable.</Prose>
        <Prose>The historian system can reconstruct:</Prose>
        <BulletList
          items={[
            "preprocessing",
            "retrieval",
            "ranking",
            "compression",
            "contextual assembly",
          ]}
        />
        <Prose>This enables:</Prose>
        <BulletList
          items={["debugging", "benchmarking", "retrieval analysis", "drift detection"]}
        />
      </SlideBody>
    ),
  },
  {
    id: "drift-detection",
    code: "DRFT.01",
    title: "Drift Detection",
    content: (
      <SlideBody>
        <Prose>The platform monitors:</Prose>
        <BulletList
          items={[
            "ranking instability",
            "token inflation",
            "retrieval degradation",
            "compression aggressiveness",
          ]}
        />
        <Prose>This helps maintain:</Prose>
        <BulletList
          items={["retrieval quality", "contextual precision", "operational consistency"]}
        />
      </SlideBody>
    ),
  },
  {
    id: "explainability",
    code: "EXPL.01",
    title: "Explainability",
    content: (
      <SlideBody>
        <Prose>Every major operation in the system is explainable.</Prose>
        <Prose>The platform exposes:</Prose>
        <BulletList
          items={[
            "retrieval reasoning",
            "ranking logic",
            "relationship generation",
            "compression decisions",
            "contextual weighting",
          ]}
        />
        <HighlightQuote>This is foundational to the system architecture.</HighlightQuote>
      </SlideBody>
    ),
  },
  {
    id: "precision-first",
    code: "PHIL.01",
    title: "Precision-First Philosophy",
    content: (
      <SlideBody>
        <Prose>The platform is designed around one core principle:</Prose>
        <FlowDiagram lines={["semantic precision remains dominant"]} />
        <Prose>Every system:</Prose>
        <BulletList
          items={[
            "retrieval",
            "relationships",
            "compression",
            "preprocessing",
            "memory evolution",
          ]}
        />
        <Prose>
          exists to improve contextual precision without sacrificing explainability or operational
          integrity.
        </Prose>
      </SlideBody>
    ),
  },
  {
    id: "what-is",
    code: "SYS.02",
    title: "What This System Is",
    content: (
      <SlideBody>
        <Prose>This platform is:</Prose>
        <BulletList
          items={[
            "contextual middleware",
            "retrieval infrastructure",
            "operational memory infrastructure",
            "replayable contextual intelligence infrastructure",
          ]}
        />
      </SlideBody>
    ),
  },
  {
    id: "what-is-not",
    code: "SYS.03",
    title: "What This System Is NOT",
    content: (
      <SlideBody>
        <Prose>This platform is NOT:</Prose>
        <BulletList
          items={[
            "a chatbot",
            "autonomous AGI",
            "a black-box AI system",
            "an autonomous reasoning engine",
          ]}
        />
        <Divider />
        <Prose>
          The platform exists to improve: contextual organization, retrieval quality, and
          operational contextual intelligence.
        </Prose>
      </SlideBody>
    ),
  },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 32 : -32,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -32 : 32,
    opacity: 0,
  }),
};

/* ── Page ────────────────────────────────────────────────── */

export function HowItWorksPage() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const slide = slides[activeIndex]!;
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === slides.length - 1;

  const goTo = useCallback((index: number) => {
    setActiveIndex((prev) => {
      if (index !== prev) setDirection(index > prev ? 1 : -1);
      return index;
    });
  }, []);

  const goNext = useCallback(() => {
    if (!isLast) goTo(activeIndex + 1);
  }, [activeIndex, goTo, isLast]);

  const goPrev = useCallback(() => {
    if (!isFirst) goTo(activeIndex - 1);
  }, [activeIndex, goTo, isFirst]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev]);

  return (
    <div className="max-w-[1100px]">
      <PageHeader
        code="DOC.00"
        title="How It Works"
        lede="Contextual intelligence middleware — deterministic retrieval, memory organization, and full operational observability."
      />

      <div className="flex gap-8">
        {/* Index */}
        <aside className="hidden w-[220px] shrink-0 md:block">
          <div className="sticky top-20">
            <span className="mb-3 block font-metric text-[0.625rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
              Index
            </span>
            <ol className="m-0 flex flex-col gap-0.5 p-0 list-none">
              {slides.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    className={cn(
                      "group flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150",
                      i === activeIndex
                        ? "bg-[var(--color-accent-muted)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)]",
                    )}
                  >
                    <span
                      className={cn(
                        "font-metric mt-0.5 shrink-0 text-[0.625rem] tabular-nums",
                        i === activeIndex
                          ? "text-[var(--color-accent)]"
                          : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-tertiary)]",
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[0.8125rem] font-medium leading-snug">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        {/* Card */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between gap-4">
            <span className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              {String(activeIndex + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
            </span>
            <div className="h-1 flex-1 max-w-[200px] overflow-hidden rounded-full bg-[var(--color-surface-2)]">
              <motion.div
                className="h-full rounded-full bg-[var(--color-accent)]"
                animate={{ width: `${((activeIndex + 1) / slides.length) * 100}%` }}
                transition={transition.normal}
              />
            </div>
          </div>

          <div className="relative min-h-[420px]">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={slide.id}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={transition.page}
              >
                <Panel code={slide.code} title={slide.title}>
                  {slide.content}
                </Panel>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <Button variant="secondary" onClick={goPrev} disabled={isFirst}>
              ← Previous
            </Button>

            <span className="font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)] md:hidden">
              {slide.title}
            </span>

            <Button variant={isLast ? "secondary" : "primary"} onClick={goNext} disabled={isLast}>
              {isLast ? "End" : "Next →"}
            </Button>
          </div>

          <p className="mt-3 font-metric text-[0.5625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
            Use arrow keys to navigate
          </p>
        </div>
      </div>
    </div>
  );
}
