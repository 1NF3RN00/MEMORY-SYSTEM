# Graph Storage Specification

## Memory Relationships Table

```sql id="gs1"
CREATE TABLE memory_relationships (
    relationship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    client_id UUID NOT NULL,

    source_memory_id UUID REFERENCES memory_objects(memory_id),

    target_memory_id UUID REFERENCES memory_objects(memory_id),

    relationship_type TEXT NOT NULL,

    relationship_strength FLOAT DEFAULT 1.0,

    traversal_weight FLOAT DEFAULT 1.0,

    bidirectional BOOLEAN DEFAULT TRUE,

    created_via TEXT,

    confidence FLOAT DEFAULT 1.0,

    restricted BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# Relationship Types

Supported relationships:

* parent
* child
* adjacent
* semantic
* workflow
* temporal
* source

---

# Graph Philosophy

Memory exists in:
relationships,
not isolated fragments.

The middleware supports:
relationship-aware retrieval.

---

# Traversal Indexes

```sql id="gs2"
CREATE INDEX idx_relationship_source
ON memory_relationships(source_memory_id);

CREATE INDEX idx_relationship_target
ON memory_relationships(target_memory_id);

CREATE INDEX idx_relationship_type
ON memory_relationships(relationship_type);
```

---

# Traversal Philosophy

Traversal remains:

* token-aware
* governance-aware
* threshold-controlled

The middleware avoids:
unbounded graph expansion.
