import type { ApifyClient } from "apify-client";

export interface ApifyRunResult {
  runId: string;
  datasetId: string;
  items: unknown[];
  status: string;
}

export interface ApifyRunStatus {
  runId: string;
  status: string;
  datasetId?: string;
  itemCount?: number;
}

const RATE_LIMIT_PATTERN = /rate limit|too many requests|429/i;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callActorWithRetry(
  client: ApifyClient,
  actorId: string,
  input: Record<string, unknown>,
): Promise<{ id: string; defaultDatasetId: string; status: string }> {
  try {
    const run = await client.actor(actorId).call(input);
    return {
      id: run.id,
      defaultDatasetId: run.defaultDatasetId,
      status: run.status,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!RATE_LIMIT_PATTERN.test(message)) throw error;
    await sleep(30_000);
    const run = await client.actor(actorId).call(input);
    return {
      id: run.id,
      defaultDatasetId: run.defaultDatasetId,
      status: run.status,
    };
  }
}

export async function runApifyActor(
  client: ApifyClient,
  actorId: string,
  input: Record<string, unknown>,
): Promise<ApifyRunResult> {
  const run = await callActorWithRetry(client, actorId, input);
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  return {
    runId: run.id,
    datasetId: run.defaultDatasetId,
    items,
    status: run.status,
  };
}

export async function getApifyRunStatus(
  client: ApifyClient,
  runId: string,
): Promise<ApifyRunStatus> {
  const run = await client.run(runId).get();
  if (!run) {
    throw new Error(`Apify run not found: ${runId}`);
  }

  const status: ApifyRunStatus = {
    runId: run.id,
    status: run.status,
  };

  if (run.defaultDatasetId) {
    status.datasetId = run.defaultDatasetId;
    if (run.status === "SUCCEEDED") {
      const dataset = await client.dataset(run.defaultDatasetId).listItems();
      status.itemCount = dataset.items.length;
    }
  }

  return status;
}
