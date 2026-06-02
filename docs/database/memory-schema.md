# Memory Schema Specification

## Core Memory Table

```sql id="ms1"
CREATE TABLE memory_objects (
    memory_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    client_id UUID NOT NULL,

    memory_type TEXT NOT NULL,

    raw_content TEXT,

    normalized_content TEXT,

    summary_short TEXT,

    summary_long TEXT,

    title TEXT,

    source_type TEXT,

    source_url TEXT,

    source_id TEXT,

    author TEXT,

    language TEXT,

    content_type TEXT,

    retrieval_priority FLOAT DEFAULT 1.0,

    importance_score FLOAT DEFAULT 1.0,

    decay_rate FLOAT DEFAULT 0.01,

    retrieval_count INTEGER DEFAULT 0,

    successful_retrievals INTEGER DEFAULT 0,

    failed_retrievals INTEGER DEFAULT 0,

    average_retrieval_score FLOAT DEFAULT 0,

    visibility TEXT DEFAULT 'private',

    access_level TEXT DEFAULT 'internal',

    sensitivity TEXT DEFAULT 'low',

    archived BOOLEAN DEFAULT FALSE,

    version INTEGER DEFAULT 1,

    version_hash TEXT,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW(),

    archived_at TIMESTAMP
);
```

---

# Memory Embeddings Table

```sql id="ms2"
CREATE TABLE memory_embeddings (
    embedding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    memory_id UUID REFERENCES memory_objects(memory_id),

    client_id UUID NOT NULL,

    embedding_type TEXT NOT NULL,

    embedding vector(1536),

    embedding_model TEXT,

    embedding_version TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);
```

Supported embedding types:

* raw
* summary
* keyword

Future embedding types remain extensible.

---

# Memory Metadata Table

```sql id="ms3"
CREATE TABLE memory_metadata (
    metadata_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    memory_id UUID REFERENCES memory_objects(memory_id),

    headings TEXT[],

    tags TEXT[],

    keyword_index TEXT[],

    phrase_index TEXT[],

    additional_metadata JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# Memory Lifecycle Table

```sql id="ms4"
CREATE TABLE memory_lifecycle (
    lifecycle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    memory_id UUID REFERENCES memory_objects(memory_id),

    lifecycle_stage TEXT,

    reinforcement_score FLOAT DEFAULT 0,

    decay_score FLOAT DEFAULT 0,

    compression_level TEXT,

    archival_status TEXT,

    last_reinforced_at TIMESTAMP,

    last_decayed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# Memory Version Table

```sql id="ms5"
CREATE TABLE memory_versions (
    version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    memory_id UUID REFERENCES memory_objects(memory_id),

    version INTEGER,

    raw_content TEXT,

    summary_short TEXT,

    version_hash TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# Indexes

```sql id="ms6"
CREATE INDEX idx_memory_client
ON memory_objects(client_id);

CREATE INDEX idx_memory_type
ON memory_objects(memory_type);

CREATE INDEX idx_memory_visibility
ON memory_objects(visibility);

CREATE INDEX idx_memory_archived
ON memory_objects(archived);

CREATE INDEX idx_memory_source
ON memory_objects(source_type);

CREATE INDEX idx_memory_updated
ON memory_objects(updated_at);
```

---

# Philosophy

The memory schema prioritizes:

* modularity
* retrieval observability
* lifecycle tracking
* governance
* semantic scalability

Memory remains:
governed,
versioned,
and retrieval-aware.
