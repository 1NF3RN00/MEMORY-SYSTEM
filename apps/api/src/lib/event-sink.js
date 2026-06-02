import { Prisma } from "@prisma/client";
export function createPrismaEventSink(prisma) {
    return {
        async persist(event) {
            const payload = JSON.parse(JSON.stringify(event));
            await prisma.eventLog.create({
                data: {
                    eventType: event.event_type,
                    traceId: event.trace_id,
                    severity: event.severity,
                    payload,
                    ...(event.workspace_id ? { workspaceId: event.workspace_id } : {}),
                    timestamp: new Date(event.timestamp),
                },
            });
        },
    };
}
//# sourceMappingURL=event-sink.js.map