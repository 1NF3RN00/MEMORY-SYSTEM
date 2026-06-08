/** Telemetry analytics — compression list rows for events + latest-id follow-up. */
export const TELEMETRY_COMPRESSION_LIST_FIELDS =
  "compressionTraceId,status,createdAt";

/** Telemetry analytics — context render list rows for operational events. */
export const TELEMETRY_CONTEXT_RENDER_LIST_FIELDS = "deliveryId,status,createdAt";

/** Trace pickers — retrieval dropdowns that only need identity + package flag. */
export const RETRIEVAL_PICKER_LIST_FIELDS =
  "retrievalTraceId,query,status,hasContextPackage";

/** Trace pickers — compression dropdowns on context delivery. */
export const COMPRESSION_PICKER_LIST_FIELDS =
  "compressionTraceId,retrievalTraceId,status";
