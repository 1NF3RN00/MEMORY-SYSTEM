# Archival Storage Specification

## Overview

The middleware supports:
soft archival by default.

Archived memories remain:
recoverable and governed.

---

# Archival Philosophy

The middleware prefers:
compression + archival
over hard deletion.

Historical semantic memory remains valuable for:

* auditing
* rollback
* historical retrieval
* debugging

---

# Archived Memory Table

```sql id="ar1"
CREATE TABLE archived_memories (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    original_memory_id UUID,

    client_id UUID,

    compressed_content TEXT,

    archival_reason TEXT,

    archived_at TIMESTAMP DEFAULT NOW()
);
```

---

# Cold Storage

Future architecture may support:

* object storage
* zip archival
* compressed graph snapshots
* cold vector storage

The middleware remains:
storage-modular.

---

# Governance Persistence

Governance metadata survives:

* archival
* compression
* restoration

Archived restricted memories remain restricted.
