# Presentation Script — ConverSight AI (30-Minute Block)
This script is structured to guide you slide-by-slide through the 10-slide interactive presentation at [ConverSight_AI_Presentation.html](file:///Users/nikola/Downloads/ConverSight%20AI/ConverSight_AI_Presentation.html). The script is designed to fill approximately **25 minutes** of speaking time, leaving a solid **5 minutes** for transitional padding and wrapping up, ensuring you transition cleanly into the 15-minute Q&A block.

---

## Slide 1: Title Slide (ConverSight AI: Product Pitch & Architecture)
* **On-Screen Visual**: Deep-slate dark interface with neon cyan and magenta gradient background glow. Displaying "ConverSight AI" and the subtitle: "Enterprise-Grade Conversation Intelligence Platform turning transcripts into real-time business insights."
* **Timing**: 2 Minutes
* **Speaking Script**:
  > "Good afternoon, everyone. Thank you for your time today. I’m excited to introduce **ConverSight AI**—an enterprise-grade conversation intelligence platform that we built to address a critical friction point in B2B SaaS companies: the 'dialogue gap'.
  > 
  > In any enterprise, customers talk to us every day: they report bugs in support tickets, they discuss renewals and product adoption with account managers, and our teams run internal standups. However, this wealth of raw conversation data remains completely siloed.
  > 
  > Today, I will walk you through how we built a production-grade, containerized ETL and RAG pipeline that normalizes this data, extracts key deliverables, tracks client churn risks, maps knowledge relationships, and exposes them in a real-time executive dashboard console. We will discuss the stack choices we made, why we chose them over common alternatives, and the strategic value this platform unlocks."
* **Transition**: *"Let's begin by defining the core business problem we set out to solve."*

---

## Slide 2: The Business Problem (The B2B Dialogue Gap)
* **On-Screen Visual**: Displaying three clean panels under the heading "The B2B Dialogue Gap":
  1. *Information Silos*: Support tickets, renewals, and bugs stored separately.
  2. *No Proactive Alerts*: Account health realized only after churn.
  3. *Manual Synthesis*: Hours spent listening to recordings to compile feature requests.
* **Timing**: 2.5 Minutes
* **Speaking Script**:
  > "To build a product that leadership teams will actually use, we must start with the core business questions that standard databases cannot answer easily:
  > *What are customers complaining about? Which accounts are at risk of churning? What feature requests appear repeatedly, and which competitors are they mentioning?*
  > 
  > Currently, companies suffer from three major issues. First, **Information Silos**: transcript data is scattered across tools and directories, disconnected from any relational context. Second, **Lacking Proactive Alerts**: support managers only find out a customer is unhappy when they receive a cancellation notice. Third, **Manual Synthesis**: product managers spend hours reading transcripts or listening to recordings to find feature requests.
  > 
  > Our objective with ConverSight AI was to build an automated engine that digests these conversations, extracts critical moments, and visualizes them on a unified dashboard. This replaces manual synthesis with real-time, actionable business intelligence."
* **Transition**: *"Now, let's look at the underlying architecture that makes this automated ingestion possible."*

---

## Slide 3: Platform Architecture (Production AI Data Ingestion)
* **On-Screen Visual**: Flowchart illustrating the multi-service Docker Compose stack (Raw Dataset JSONs ➔ ingest.py ETL ➔ DuckDB ➔ FastAPI ➔ Redis Cache ➔ Next.js 16 Dashboard).
* **Timing**: 3 Minutes
* **Speaking Script**:
  > "To support these goals, we designed a containerized architecture split into three primary layers.
  > 
  > First, our **Data Engineering Layer**: we built a Python ETL pipeline ([ingest.py](file:///Users/nikola/Downloads/ConverSight%20AI/backend/ingestion/ingest.py)) that traverses the meeting directories, runs schema validation to filter corrupt records, normalizes timestamps, and extracts key entities like competitors, products, and clients.
  > 
  > Second, the **Storage and Caching Layer**: we utilize **DuckDB** as our in-process analytical data warehouse, storing meetings, transcript turns, action items, and knowledge graph mappings. We sit a **Redis Cache** directly in front of FastAPI to serve heavy dashboard aggregates and search results in sub-milliseconds.
  > 
  > Third, the **Presentation Layer**: a Next.js 16 console that talks to our FastAPI endpoints. The entire stack is fully dockerized via Docker Compose, making it highly portable. Let's look at the first set of insights this ingestion engine exposes: customer churn risk."
* **Transition**: *"Let's examine how our ETL engine converts raw text into customer health scores."*

---

## Slide 4: Insight 1 - Churn Risk (Customer Health & Churn Risk)
* **On-Screen Visual**: Three cards highlighting clients and their risk categories:
  * *Summit Trust* (High Risk): Disputed a 200-seat overage on their billing invoice.
  * *Northstar Pharma* (High Risk): Concerned with regulatory SLA compliance due to downtime.
  * *Trailhead Marketplace* (Medium Risk): Critical incident during platform upgrade.
* **Timing**: 3 Minutes
* **Speaking Script**:
  > "One of the most valuable aspects of the platform is the **Customer Health Score**. Instead of relying on manual customer success surveys, our ingestion engine scans meeting summaries and segment sentiments to compute a real-time risk profile.
  > 
  > Our algorithm flags clients as High Risk if their average meeting sentiment score drops below 2.6 out of 5.0, or if they have logged three or more Support-related calls.
  > 
  > For instance, **Summit Trust** is flagged at High Risk. By parsing the transcripts, we found they disputed a 200-seat overage because migration test accounts were left un-deprovisioned. **Northstar Pharma** is also High Risk due to regulatory SLA concerns following recent platform downtime on the Protect module. By exposing these risks directly on the dashboard, customer success managers can intervene proactively before renewals."
* **Transition**: *"Beyond customer success, the platform compiles insights for our engineering and product teams."*

---

## Slide 5: Insight 2 - Product Priorities (Product Risk Heatmap)
* **On-Screen Visual**: Split cards comparing the top repeating bugs (SSO login failures, AD sync lag, S3 timeouts) against prioritized feature requests (custom compliance templates, bulk deprovisioning, proactive billing alerts).
* **Timing**: 2.5 Minutes
* **Speaking Script**:
  > "Product managers often struggle to prioritize their backlog because they lack quantitative data on what is affecting customers most.
  > 
  > ConverSight solves this by categorizing issues into a **Product Risk Heatmap**. The database indexes all transcript sentences and flags words like 'fail', 'error', 'bug', or 'timeout'.
  > 
  > Looking at the data, **SSO Login Failures** is the single most repeating bug, appearing in 12 separate customer meetings. In addition, customers are asking for **Custom Compliance Templates** (15 mentions) and a **Bulk Deprovisioning Tool** (11 mentions). By cross-referencing these feature requests with account sizes, product teams can align their roadmap directly with revenue impact, focusing engineering efforts where they matter most."
* **Transition**: *"Next, let's explore how we track our position in the market using competitor mentions."*

---

## Slide 6: Insight 3 - Competitive Intelligence (Competitor Win-Loss Metrics)
* **On-Screen Visual**: Three cards summarizing competitor mentions:
  * *Okta Market Threat* (30 Mentions): Focus on active migrations and SSO.
  * *Entra & AD Integrations*: Microsoft Entra integration lag is a key blocker.
  * *Duo / Ping Configuration*: Setup friction during multi-factor authentication (MFA).
* **Timing**: 2.5 Minutes
* **Speaking Script**:
  > "In B2B SaaS, sales teams need to know exactly which competitors are appearing in client discussions.
  > 
  > Our ingestion pipeline runs entity extraction for key competitors—Okta, Duo, Ping, and Entra—across all transcripts.
  > 
  > The data shows that **Okta** is our primary threat, mentioned 30 times. Customers are actively discussing Okta migrations and asking for tighter SSO integrations. We also see repeated mentions of **Microsoft Entra** and **Duo** in relation to MFA setup friction. This intelligence tells our marketing and product teams that our integration with Microsoft and Okta is a high-priority win-loss driver. If we improve these connectors, we directly eliminate our competitors' foothold."
* **Transition**: *"Now, let's move from passive insights to active accountability with the Action Items Center."*

---

## Slide 7: Action Items Center (Automated Action Items Center)
* **On-Screen Visual**: Three sections detailing the Action Items system: Extraction Heuristics (splitting task/owner), State Management (Open, Closed, Blocked statuses), and Deadline Mapping (parsing timeframes like 'before Friday billing').
* **Timing**: 2 Minutes
* **Speaking Script**:
  > "Insights are only useful if they lead to action. To ensure client promises are kept, we built an automated **Action Items Center**.
  > 
  > During ingestion, we parse meeting action items, extract the task description, and attribute ownership using email address lookups. If a transcript says 'Sarah Chen: Submit billing adjustment before Friday', our ETL engine automatically splits the owner 'Sarah Chen', maps the task, and extracts the deadline 'Friday'.
  > 
  > More importantly, this is fully interactive. Users can update task statuses between **Open**, **Closed**, and **Blocked** directly on the UI dashboard. The frontend dispatches a PUT request to the backend, updating DuckDB in real-time. This provides a single source of truth for all customer-facing action items."
* **Transition**: *"To visualize all these moving parts—meetings, clients, products, and competitors—we map them into a relational network."*

---

## Slide 8: Knowledge Graph (Relational Knowledge Graph)
* **On-Screen Visual**: Highlights of the Relational Schema (Meetings, Speakers, Products, Competitors, Topics) and the 2D Force Physics Simulation Engine running on HTML5 Canvas.
* **Timing**: 2.5 Minutes
* **Speaking Script**:
  > "To help users explore complex connections, we built an interactive **Knowledge Graph Explorer**. 
  > 
  > Rather than querying raw SQL, users can view a visual map of nodes—like Meetings, Speakers, Products, and Topics—and their edges, representing relations like `Speaker DISCUSSES Topic` or `Meeting MENTIONS Competitor`.
  > 
  > This explorer is rendered on an HTML5 Canvas and runs a custom **2D particle physics engine**. The simulation uses Coulomb’s Law for node repulsion to prevent label overlaps, Hooke’s Law for edge attraction to group related items, and friction factors to bring the graph to a stable, readable layout. Users can click any node to open the inspector sidebar and explore its 1-degree neighborhood."
* **Transition**: *"But what if an executive wants to ask a direct, natural-language question instead of navigating graphs? That is where our AI Copilot comes in."*

---

## Slide 9: AI Copilot (RAG-Powered AI Copilot)
* **On-Screen Visual**: Details of the RAG architecture: Hybrid retrieval (BM25 + vector similarity), Gemini LLM Integration (1.5 Flash REST payloads), and Offline Fallback Heuristics.
* **Timing**: 3 Minutes
* **Speaking Script**:
  > "For instant answers, we built a **RAG-Powered AI Copilot**.
  > 
  > When a user enters a question, the backend runs a **hybrid retrieval strategy**. It executes a BM25 Full-Text Search over DuckDB to find matching transcript segments and constructs a prompt containing these segments.
  > 
  > If a `GEMINI_API_KEY` is present, it calls the **Gemini 1.5 Flash** API via a lightweight HTTPS REST call. The system prompt forces the model to base its answer *only* on the provided meeting context and include bracketed citations like `[Support Case #9279]`. If the API key is absent, the backend routes the query to an **offline fallback engine** that returns structured summaries from our cached database tables, ensuring the system is always responsive and secure."
* **Transition**: *"To wrap up, let's look at the strategic value this platform delivers to our leadership team."*

---

## Slide 10: Value Recommendations (Unlocking Strategic Value)
* **On-Screen Visual**: Three columns detailing next steps: Churn Prevention (scheduling calls with Summit Trust/Northstar), Backlog Alignment (SSO and compliance templates), and Sales Enablement (competitive battlecards).
* **Timing**: 3 Minutes
* **Speaking Script**:
  > "In conclusion, ConverSight AI is not just a dashboard; it is a strategic tool that drives business outcomes across three main areas:
  > 
  > 1. **Churn Prevention**: We recommend customer success immediately schedule review calls with Summit Trust to resolve their invoice dispute, and Northstar Pharma to address SLA downtime.
  > 2. **Engineering Backlog Alignment**: Product teams should prioritize fixing SSO login failures to eliminate our highest support volume driver.
  > 3. **Sales Enablement**: Enable our account managers with competitive battlecards specifically focused on Okta SSO integrations, helping them address competitor threats in active sales cycles.
  > 
  > By transforming raw conversation text into structured, relational business intelligence, we give our leadership team a clear, data-driven path to increase retention, align product development, and win more deals. 
  > 
  > Thank you, and I would be happy to open the floor to any questions."
* **Transition**: *"I'll now transition to the Q&A session."*
