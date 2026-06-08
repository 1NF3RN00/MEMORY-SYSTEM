import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext.js";
import {
  mergeOperationalStreamEvents,
  operationalEventFromStreamPayload,
  subscribeOperationalStream,
  TELEMETRY_STREAM_CONNECTED_POLL_INTERVAL_MS,
  type OperationalStreamConnectionStatus,
} from "../lib/operationalStream.js";
import type { OperationalEvent } from "../components/homepage/types.js";
import {
  emptyWorkspaceTelemetry,
  fetchTelemetryAnalytics,
  fetchTelemetrySummary,
  type WorkspaceTelemetry,
} from "../lib/workspaceTelemetry.js";
import {
  TELEMETRY_POLL_INTERVAL_MS,
  TELEMETRY_STALE_TIME_MS,
  telemetryQueryKeys,
} from "../lib/telemetryQueryKeys.js";

/** Kept for sprint regression tests (Sprint-14/28). */
export const POLL_INTERVAL_MS = 15_000;

function telemetryErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Telemetry request failed";
}

interface WorkspaceTelemetryContextValue {
  authLoading: boolean;
  summaryLoading: boolean;
  summaryError: string | null;
  analyticsLoaded: boolean;
  analyticsLoading: boolean;
  analyticsError: string | null;
  telemetry: WorkspaceTelemetry;
  requestAnalytics: () => void;
}

const WorkspaceTelemetryContext = createContext<WorkspaceTelemetryContextValue | null>(null);

export function WorkspaceTelemetryProvider({ children }: { children: ReactNode }) {
  const { workspaceId, loading: authLoading, session } = useAuth();
  const client = useQueryClient();
  const [analyticsRequested, setAnalyticsRequested] = useState(false);
  const [streamStatus, setStreamStatus] = useState<OperationalStreamConnectionStatus>("idle");
  const [streamEvents, setStreamEvents] = useState<OperationalEvent[]>([]);
  const streamEventsRef = useRef<OperationalEvent[]>([]);

  const queriesEnabled = !authLoading && !!workspaceId;
  const resolvedWorkspaceId = workspaceId ?? "";
  const streamConnected = streamStatus === "connected";
  const summaryPollIntervalMs = streamConnected
    ? TELEMETRY_STREAM_CONNECTED_POLL_INTERVAL_MS
    : TELEMETRY_POLL_INTERVAL_MS;

  useEffect(() => {
    setAnalyticsRequested(false);
    setStreamEvents([]);
    streamEventsRef.current = [];
  }, [resolvedWorkspaceId]);

  useEffect(() => {
    if (!queriesEnabled) {
      setStreamStatus("idle");
      return;
    }

    const subscription = subscribeOperationalStream({
      workspaceId: resolvedWorkspaceId,
      accessToken: session?.access_token ?? null,
      enabled: queriesEnabled,
      onStatus: setStreamStatus,
      onEnvelope(envelope) {
        if (envelope.kind !== "event" || !envelope.event) return;
        const nextEvent = operationalEventFromStreamPayload(envelope.event);
        const merged = mergeOperationalStreamEvents(streamEventsRef.current, [nextEvent]);
        streamEventsRef.current = merged;
        setStreamEvents(merged);
      },
    });

    return () => subscription.close();
  }, [queriesEnabled, resolvedWorkspaceId, session?.access_token]);

  const summaryQuery = useQuery({
    queryKey: telemetryQueryKeys.summary(resolvedWorkspaceId),
    queryFn: async () => {
      const data = await fetchTelemetrySummary(resolvedWorkspaceId);
      if (!data) {
        throw new Error("Telemetry summary unavailable");
      }
      return data;
    },
    enabled: queriesEnabled,
    staleTime: TELEMETRY_STALE_TIME_MS,
    structuralSharing: true,
    refetchInterval: queriesEnabled && !analyticsRequested ? summaryPollIntervalMs : false,
  });

  const analyticsQuery = useQuery({
    queryKey: telemetryQueryKeys.analytics(resolvedWorkspaceId),
    queryFn: async () => {
      const data = await fetchTelemetryAnalytics(resolvedWorkspaceId);
      if (!data) {
        throw new Error("Telemetry analytics unavailable");
      }
      return data;
    },
    enabled: queriesEnabled && analyticsRequested,
    staleTime: TELEMETRY_STALE_TIME_MS,
    structuralSharing: true,
    refetchInterval:
      queriesEnabled && analyticsRequested ? TELEMETRY_POLL_INTERVAL_MS : false,
  });

  const requestAnalytics = useCallback(() => {
    if (!analyticsRequested) {
      setAnalyticsRequested(true);
    }
  }, [analyticsRequested]);

  useEffect(() => {
    if (!queriesEnabled) return;

    const onDataCleared = () => {
      setAnalyticsRequested(false);
      void client.invalidateQueries({
        queryKey: telemetryQueryKeys.all(resolvedWorkspaceId),
      });
    };

    window.addEventListener("mms:data-cleared", onDataCleared);
    return () => window.removeEventListener("mms:data-cleared", onDataCleared);
  }, [client, queriesEnabled, resolvedWorkspaceId]);

  const telemetry = useMemo(() => {
    const base = analyticsQuery.data ?? summaryQuery.data ?? emptyWorkspaceTelemetry();
    if (!streamConnected || streamEvents.length === 0) {
      return base;
    }
    return {
      ...base,
      events: mergeOperationalStreamEvents(base.events, streamEvents),
    };
  }, [analyticsQuery.data, summaryQuery.data, streamConnected, streamEvents]);

  const value = useMemo(
    () => ({
      authLoading,
      summaryLoading: authLoading || (summaryQuery.isPending && !summaryQuery.data),
      summaryError: summaryQuery.isError ? telemetryErrorMessage(summaryQuery.error) : null,
      analyticsLoaded: !!analyticsQuery.data,
      analyticsLoading: analyticsRequested && analyticsQuery.isFetching && !analyticsQuery.data,
      analyticsError: analyticsQuery.isError ? telemetryErrorMessage(analyticsQuery.error) : null,
      telemetry,
      requestAnalytics,
    }),
    [
      authLoading,
      summaryQuery.isPending,
      summaryQuery.data,
      summaryQuery.isError,
      summaryQuery.error,
      analyticsQuery.data,
      analyticsQuery.isFetching,
      analyticsQuery.isError,
      analyticsQuery.error,
      analyticsRequested,
      telemetry,
      requestAnalytics,
    ],
  );

  return (
    <WorkspaceTelemetryContext.Provider value={value}>{children}</WorkspaceTelemetryContext.Provider>
  );
}

function useWorkspaceTelemetryContext(): WorkspaceTelemetryContextValue {
  const ctx = useContext(WorkspaceTelemetryContext);
  if (!ctx) {
    throw new Error("Workspace telemetry hooks must be used within WorkspaceTelemetryProvider");
  }
  return ctx;
}

/** Full telemetry snapshot for Observability and advanced consumers. */
export function useWorkspaceTelemetry() {
  const {
    telemetry,
    authLoading,
    summaryLoading,
    summaryError,
    analyticsLoaded,
    analyticsLoading,
    analyticsError,
  } = useWorkspaceTelemetryContext();

  return useMemo(
    () => ({
      telemetry,
      loading: authLoading || summaryLoading || analyticsLoading || !analyticsLoaded,
      summaryLoading: authLoading || summaryLoading,
      summaryError,
      analyticsLoaded,
      analyticsLoading,
      analyticsError,
    }),
    [
      telemetry,
      authLoading,
      summaryLoading,
      summaryError,
      analyticsLoaded,
      analyticsLoading,
      analyticsError,
    ],
  );
}

export function useTelemetryIndicators() {
  const { telemetry, authLoading, summaryLoading, summaryError } = useWorkspaceTelemetryContext();
  return useMemo(
    () => ({
      indicators: telemetry.indicators,
      loading: authLoading || summaryLoading,
      error: summaryError,
    }),
    [telemetry.indicators, authLoading, summaryLoading, summaryError],
  );
}

export function useTelemetryPanelData() {
  const { telemetry, authLoading, summaryLoading, summaryError } = useWorkspaceTelemetryContext();
  return useMemo(
    () => ({
      panelData: telemetry.panelData,
      loading: authLoading || summaryLoading,
      error: summaryError,
    }),
    [telemetry.panelData, authLoading, summaryLoading, summaryError],
  );
}

export function useTelemetryEvents() {
  const { telemetry, authLoading, summaryLoading, summaryError } = useWorkspaceTelemetryContext();
  return useMemo(
    () => ({
      events: telemetry.events,
      loading: authLoading || summaryLoading,
      error: summaryError,
    }),
    [telemetry.events, authLoading, summaryLoading, summaryError],
  );
}

export function useTelemetryMetrics() {
  const { telemetry, authLoading, summaryLoading, summaryError } = useWorkspaceTelemetryContext();
  return useMemo(
    () => ({
      metrics: telemetry.metrics,
      activityFeed: telemetry.activityFeed,
      loading: authLoading || summaryLoading,
      error: summaryError,
    }),
    [telemetry.metrics, telemetry.activityFeed, authLoading, summaryLoading, summaryError],
  );
}

export function useTelemetryAnalyticsState() {
  const { analyticsLoaded, analyticsLoading, analyticsError, requestAnalytics } =
    useWorkspaceTelemetryContext();
  return useMemo(
    () => ({
      analyticsLoaded,
      analyticsLoading,
      analyticsError,
      requestAnalytics,
    }),
    [analyticsLoaded, analyticsLoading, analyticsError, requestAnalytics],
  );
}
