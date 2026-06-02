# SPRINT 1 — APPROVED DOCUMENTATION REFERENCES

Cursor MAY reference ONLY these documentation areas during Sprint 1 implementation.

# HIGH PRIORITY REFERENCES

## Ingestion

docs/ingestion/

Especially:

* ingestion-pipeline.md
* content-parsing.md
* semantic-chunking.md
* crawler-architecture.md
* ingestion-lifecycle.md

## Input Processing

docs/input-processing/

Especially:

* input-pipeline.md
* preprocessing-orchestration.md
* entity-extraction.md

## Schemas

docs/schemas/

Especially:

* processed-input.md
* retrieval-result.md

## Database

docs/database/

Especially:

* memory-schema.md
* postgres-architecture.md
* vector-indexing.md

## Memory Model

docs/memory-model/

Especially:

* memory-object-v1.md
* memory-lifecycle.md
* memory-object.md

## Analytics

docs/analytics/

Especially:

* event-pipeline.md
* telemetry-architecture.md

# ALLOWED REFERENCE PURPOSES

Cursor may reference these docs ONLY for:

* implementation clarification
* schema consistency
* event consistency
* ingestion lifecycle consistency
* observability consistency

# DOCUMENTATION USAGE RULES

DO NOT:

* import future architecture
* implement speculative systems
* implement advanced orchestration
* implement graph logic
* implement predictive systems

Use documentation ONLY to support deterministic V1 ingestion infrastructure.
