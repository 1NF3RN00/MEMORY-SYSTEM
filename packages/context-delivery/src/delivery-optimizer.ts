import type {
  DeliveryMode,
  DeliveryOptimizationDecision,
  RenderedSection,
} from "@memory-middleware/shared-types";
import { getDeliveryModeProfile } from "./config.js";
import { estimateTokens } from "./token-estimator.js";

function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function trimTrailingWhitespace(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function optimizeDelivery(
  sections: RenderedSection[],
  mode: DeliveryMode,
  rawTokenEstimate: number,
  deliveryDensity = 0.6,
): {
  sections: RenderedSection[];
  renderedContext: string;
  tokenCount: number;
  decision: DeliveryOptimizationDecision;
} {
  const profile = getDeliveryModeProfile(mode);
  let redundancyRemoved = 0;
  const densityFactor = Math.max(0.3, Math.min(1, deliveryDensity));

  const optimizedSections = sections.map((section) => {
    let content = trimTrailingWhitespace(section.content);
    const beforeLines = content.split("\n").length;

    content = collapseBlankLines(content);

    if (profile.compactBullets || densityFactor > 0.7) {
      content = content.replace(/\n\s*\n(?=- )/g, "\n");
    }

    if (densityFactor > 0.75) {
      content = content.replace(/^(#{1,6}\s+.+\n)\n+/gm, "$1\n");
    }

    const afterLines = content.split("\n").length;
    redundancyRemoved += Math.max(0, beforeLines - afterLines);

    return { ...section, content };
  });

  const renderedContext = optimizedSections.map((s) => s.content).join("\n\n");
  const tokenCount = estimateTokens(renderedContext);

  const tokenDensityScore =
    rawTokenEstimate > 0
      ? Math.min(1, Math.round((rawTokenEstimate / Math.max(tokenCount, 1)) * densityFactor * 100) / 100)
      : 1;

  const readabilityScore = profile.compactBullets ? 0.75 : mode === "detailed" ? 0.95 : 0.85;

  return {
    sections: optimizedSections,
    renderedContext,
    tokenCount,
    decision: {
      redundancyRemoved,
      tokenDensityScore,
      readabilityScore,
    },
  };
}
