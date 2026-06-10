# Comprehensive Q&A Session Preparation — ConverSight AI
This document prepares you for the **15-minute Q&A block** following your presentation. It covers probable questions from technical, product, and architectural viewpoints, offering detailed answers with direct references to the codebase.

---

## Part 1: Tech Stack & Architecture Rationale

### Q1.1: Why did you choose DuckDB over a standard relational database like PostgreSQL or a dedicated vector database like Qdrant?
* **Answer**: 
  1. **Columnar OLAP Aggregations**: The core requirement of this platform is analytical. We need to compute sentiment timelines over weeks, count competitor mentions across thousands of conversational lines, and rank product bugs. Traditional relational databases (PostgreSQL/MySQL) are OLTP-oriented (row-oriented), which means executing full table scans to count strings or aggregate floats causes high I/O overhead. DuckDB is a columnar store; it reads only the specific columns queried, making analytics and aggregations extremely fast.
  2. **In-Process Lifecycle**: DuckDB runs in-process as a Python library. This eliminates the latency and operational overhead of network connection pools and database server maintenance. The entire database is persisted to a single binary file (`conversight.db`), which simplifies deployment.
  3. **Embedded Keyword Indexing (FTS)**: Instead of installing a separate search engine or vector store like Qdrant, we use DuckDB’s native Full-Text Search (FTS) extension to build BM25-based keyword indices. This keeps the deployment lightweight and reliable.
  4. **Why not Neo4j/Qdrant?**: A dedicated vector database or graph database lacks SQL support for complex aggregations, table joins, and transactional CRUD operations. DuckDB handles relational joins, full-text search, and relational graph modeling natively in a single engine.

### Q1.2: How does your Redis caching strategy handle multi-worker concurrency and what happens if the Redis container crashes in production?
* **Answer**:
  1. **Multi-Worker Scaling**: In production, Uvicorn or Gunicorn runs multiple worker processes to handle concurrency. If we cached data in a local Python dictionary, each worker would maintain a separate cache, leading to inconsistent dashboard reports. Redis is a shared key-value store, meaning all workers read from and write to the same cache.
  2. **Automated Expiry**: We set cache timeouts (300s for dashboards to capture new ingestions, 3600s for RAG answers to optimize API costs) using Redis `SETEX`.
  3. **Auto-Healing Fallback**: If Redis crashes, our backend uses a lazy-loading connection handler:
     ```python
     def get_redis_client():
         global redis_client
         if redis_client:
             try:
                 redis_client.ping()
                 return redis_client
             except Exception:
                 redis_client = None
     ```
     If `redis_client.ping()` fails, the client is reset to `None`, and FastAPI endpoints gracefully fall back to executing direct DuckDB SQL queries. This avoids downtime and guarantees system availability.

---

## Part 2: Data Engineering & Ingestion

### Q2.1: How does your ingestion pipeline validate transcripts, and how does it attribute roles to speakers when the metadata is incomplete?
* **Answer**:
  1. **Schema Validation**: The pipeline ([ingest.py](file:///Users/nikola/Downloads/ConverSight%20AI/backend/ingestion/ingest.py)) checks each meeting directory for the presence of the six required files (`summary.json`, `meeting-info.json`, `speakers.json`, `events.json`, `speaker-meta.json`, `transcript.json`). If any required file is missing or contains corrupt JSON, the meeting is skipped, and a warning log is recorded, ensuring the ETL loop is robust.
  2. **Role Attribution Heuristics**: To identify who is an internal agent and who is a customer, the pipeline performs domain-level matching:
     * We extract the email address of the meeting host from `meeting-info.json` and split it to identify our internal domain (e.g., `@aegiscloud.com` or `@aegis.com`).
     * We cross-reference the speaker's email domain. If a speaker’s email domain matches the host's domain, or if their name matches known internal roles (e.g., "Sarah Chen", "Support Agent", "Engineer"), they are attributed as a **Support Agent**, **Engineer**, or **Account Manager** depending on the call type.
     * Speakers from external domains are categorized as **Customer**. If the call type is `Internal`, all speakers are defaulted to the **Engineer** role.

### Q2.2: How does the pipeline handle duplicate meetings or action items if the ingestion process is run multiple times?
* **Answer**:
  * The pipeline utilizes a **clean-slate initialization pattern** on every manual ingestion run. To prevent duplicate primary key violations in DuckDB, the `run_ingestion` function executes `DELETE FROM <table_name>` across all tables before starting the directory walk:
    ```python
    conn.execute("DELETE FROM meetings;")
    conn.execute("DELETE FROM transcript_segments;")
    conn.execute("DELETE FROM action_items;")
    ```
  * In addition, database tables use explicit primary keys: `meeting_id` on the `meetings` table, and structured compound IDs like `{meeting_id}_ai_{index}` on `action_items` and `{meeting_id}_t_{index}` on `transcript_segments`. This guarantees data integrity and prevents record duplication during ingestion.

---

## Part 3: Generative AI, RAG & Search Mechanics

### Q3.1: How does your RAG retrieval engine work, and how does it blend keyword matching with context?
* **Answer**:
  * The RAG engine implements a **Hybrid Retrieval strategy** in [search.py](file:///Users/nikola/Downloads/ConverSight%20AI/backend/rag/search.py):
    1. **Keyword Search (BM25)**: We query the database to find transcripts that contain the user's search tokens. We run a case-insensitive query using ILIKE:
       `SELECT sentence, speaker_name, speaker_role, time, meeting_id FROM transcript_segments WHERE sentence ILIKE ?`
    2. **Context Window Assembly**: Instead of just extracting matching sentences, we retrieve the surrounding conversation. For each matching segment, we pull the surrounding turns (e.g., turns from the same meeting ID) to preserve conversational context.
    3. **Grounding Prompt Construction**: We combine the matching segments into a structured context block and append it to a strict system prompt:
       *"Answer the user's question based ONLY on the provided context. If the answer cannot be found in the context, say 'I cannot find the answer in the provided transcripts'. Cite the meeting title in brackets like [Support Case #9279]."*

### Q3.2: Why did you decide to implement a direct HTTPS REST client for Gemini instead of using the official Google GenAI SDK?
* **Answer**:
  * We opted for a raw REST client utilizing Python's built-in `urllib.request` to minimize the production deployment footprint. Loading heavy external libraries like the official Google Generative AI SDK introduces extensive transitive dependencies (such as large gRPC or protobuf packages). 
  * A direct REST call to:
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}`
    requires zero external packages, runs faster, compiles instantly, and is completely portable in low-resource container environments (like `python:3.10-slim`).

### Q3.3: How does your offline fallback engine function if `GEMINI_API_KEY` is not present, and how do you test RAG locally?
* **Answer**:
  * If the API key is not configured, the `rag_query` function catches the absence and reroutes the query to an **offline heuristic parser**:
    * If the query relates to "risk" or "churn", the parser queries the database for clients with low sentiment scores and returns a summary of at-risk accounts.
    * If the query is about "competitors" or "Okta", it aggregates mentions from the `entities` table.
    * If the query is about a specific meeting, it fetches the summary and action items.
  * This guarantees that the UI Copilot remains fully operational and useful even in offline or highly secure environments where external API access is disabled.

---

## Part 4: Knowledge Graph & Visualizer

### Q4.1: How is the Knowledge Graph stored in DuckDB and how does the canvas physics simulation work in the frontend?
* **Answer**:
  1. **DuckDB Graph Schema**: The graph is modeled relationally via two tables:
     * `graph_nodes (id VARCHAR PRIMARY KEY, label VARCHAR, type VARCHAR)`
     * `graph_edges (source VARCHAR, target VARCHAR, relation VARCHAR, PRIMARY KEY(source, target, relation))`
  2. **Canvas Render Loop**: The frontend ([page.tsx](file:///Users/nikola/Downloads/ConverSight%20AI/frontend/app/graph/page.tsx)) reads these tables and initializes physics coordinates `(x, y)` and velocities `(vx, vy)` for each node. It runs a `requestAnimationFrame` loop that calculates classical forces:
     * **Repulsion Force**: Nodes push against each other using Coulomb's inverse-square law:
       `const force = repulsionStrength / (dist * dist);`
     * **Attraction Force**: Nodes linked by edges pull towards each other using Hooke's linear spring law:
       `const force = attractionStrength * (dist - target_dist);`
     * **Gravity & Friction**: Disconnected clusters are pulled toward the center of the canvas, and a friction factor (0.85) dampens velocity over time so the graph stabilizes.

---

## Part 5: Business Intelligence & Analytics Computations

### Q5.1: What are the exact mathematical metrics behind your Customer Health Score and Product Risk calculations?
* **Answer**:
  1. **Customer Health Score**:
     * We calculate the average sentiment score for each customer:
       `avg_score = SUM(sentiment_score) / COUNT(meetings)`
     * We count the number of support calls logged:
       `support_count = COUNT(meetings WHERE call_type = 'Support')`
     * **Classification**:
       * **High Risk**: `avg_score < 2.6` OR `support_count >= 3`.
       * **Medium Risk**: `avg_score < 3.4` OR `support_count >= 1`.
       * **Low Risk**: All other accounts.
  2. **Product Risk Heatmap**:
     * We scan the `topics` table and filter for strings containing terms like "error", "failure", "bug", or "latency".
     * We group by the topic name and count the occurrences across all meetings, rendering the top 10 on the dashboard. This highlights which product features are causing the most customer complaints.
