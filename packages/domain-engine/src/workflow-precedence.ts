import type {
  WorkflowContextLayer,
  WorkflowExecutionContext,
} from "@memory-middleware/shared-types";
import { WORKFLOW_CONTEXT_LAYER_ORDER } from "@memory-middleware/shared-types";

export interface WorkflowContextLayerSection {
  layer: WorkflowContextLayer;
  count: number;
}

/** Returns populated context layers in mandatory workflow precedence order. */
export function getWorkflowContextLayerOrder(
  context: WorkflowExecutionContext,
): WorkflowContextLayer[] {
  return WORKFLOW_CONTEXT_LAYER_ORDER.filter((layer) => {
    const value = context[layer];
    return Array.isArray(value) && value.length > 0;
  });
}

/** Summarize layer counts in precedence order for traces and tests. */
export function summarizeWorkflowContextLayers(
  context: WorkflowExecutionContext,
): WorkflowContextLayerSection[] {
  return getWorkflowContextLayerOrder(context).map((layer) => ({
    layer,
    count: context[layer].length,
  }));
}

/** Verify layer A appears before layer B in mandatory workflow precedence. */
export function workflowLayerPrecedes(
  earlier: WorkflowContextLayer,
  later: WorkflowContextLayer,
): boolean {
  return (
    WORKFLOW_CONTEXT_LAYER_ORDER.indexOf(earlier) <
    WORKFLOW_CONTEXT_LAYER_ORDER.indexOf(later)
  );
}
