# Analytics Storage Specification

## Retrieval Analytics Table

```sql id="as1"
CREATE TABLE retrieval_analytics (
    analytics_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    client_id UUID NOT NULL,

    retrieval_id UUID,

    processed_input_id UUID,

    retrieval_strategy TEXT,

    confidence_score FLOAT,

    retry_count INTEGER DEFAULT 0,

    retrieval_time_ms INTEGER,

    token_usage INTEGER,

    compression_ratio FLOAT,

    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# Interaction Analytics Table

```sql id="as2"
CREATE TABLE interaction_analytics (
    interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    client_id UUID NOT NULL,

    success_score FLOAT,

    retrieval_success BOOLEAN,

    clarification_requested BOOLEAN,

    lead_detected BOOLEAN,

    escalation_triggered BOOLEAN,

    created_at TIMESTAMP DEFAULT NOW()
);
```

---

# Philosophy

Analytics remain:
structured,
queryable,
and observable.

The middleware prioritizes:
traceable optimization infrastructure.
