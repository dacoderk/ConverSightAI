# Video Demo Script & Step-by-Step Testing Guide — ConverSight AI
This document is a director's script for your **5-to-10 minute screen recording demo**, coupled with a technical walkthrough to test each feature step-by-step.

---

## Part 1: Step-by-Step Manual Testing Walkthrough

Before recording, ensure your local environment is up and running. Follow these steps to spin up the services and verify they function.

### Step 1: Boot Up the Multi-Container Docker Stack
Open a terminal in the project root `/Users/nikola/Downloads/ConverSight AI` and run:
```bash
docker compose up --build -d
```
* **What this does**: Builds the frontend (Next.js), backend (FastAPI), and spins up the Redis cache container. On container start, the backend automatically runs migrations and ingests the raw transcript dataset.
* **Verification URL**: Open `http://localhost:8000/api/health` to confirm the backend is up. You should see `{"status": "ok", "message": "Server is running"}`.

### Step 2: Run Backend Tests
To verify the DuckDB data schema, search index, and analytics, run the unit test suite:
```bash
PYTHONPATH=backend ./venv/bin/pytest backend/tests/test_backend.py
```
* **Expected Result**: `10 passed` in under 1 second.

### Step 3: Verify Frontend Visuals
Open your browser and navigate to:
```
http://localhost:3000
```
* **Verify**: The dashboard should render a dark theme, displaying KPI numbers (Total Meetings = 100), the overall sentiment average, a sentiment timeline chart, and tables for Customer Risks, Product Risks, and Competitor Mentions.

---

## Part 2: 5-Minute Video Demo Script

Follow this script while recording your screen. Keep your voice confident, clear, and professional.

### Section 1: Introduction (0:00 - 0:45)
* **Screen Action**: Show the Next.js Executive Dashboard at `http://localhost:3000`. Hover over the KPI cards (Total Meetings, Overall Sentiment, Total Hours).
* **Narration**:
  > "Hello, everyone. Today, I'm excited to show you the **ConverSight AI Conversation Intelligence Platform** in action. 
  > 
  > What you see on screen is our executive-level web console, built on Next.js 16 and styled with a modern, responsive slate-dark glassmorphism theme. 
  > 
  > The dashboard provides a high-level summary of the raw transcript data of 100 customer and team meetings. We see our core KPI metrics: 100 total meetings parsed, an average sentiment score of 3.25 out of 5.0, and 95.8 total call hours analyzed. 
  > 
  > Underneath, we display a weekly sentiment timeline chart, a prioritized product risk heatmap, competitor mentions, and our customer churn risk center."

---

### Section 2: Ingestion & Verification (0:45 - 2:00)
* **Screen Action**: Switch window to the terminal. Highlight the Docker services running and execute the pytest command:
  `PYTHONPATH=backend ./venv/bin/pytest backend/tests/test_backend.py`
  Show the test output showing 10 passed tests.
* **Narration**:
  > "Before showing you the UI features, let's look at the data pipeline under the hood. 
  > 
  > The platform is fully containerized inside a multi-service Docker stack running Next.js, FastAPI, and Redis. On container boot, the ingestion pipeline cleans, normalizes, and indexes the raw JSON segments into a single embeddable **DuckDB analytical database** file.
  > 
  > To guarantee correctness, we maintain a comprehensive unit test suite covering health checks, database constraints, search indices, and API contracts. As you can see, all 10 tests are passing successfully, confirming database and server readiness."

---

### Section 3: Meetings & Detail Drawer (2:00 - 3:15)
* **Screen Action**: Switch back to the browser. Click on the "Meetings" tab. Type `billing` into the search bar. Click on the first meeting (e.g. "Support Case with Summit Trust"). Show the detail drawer slide out on the right with the raw transcript segments, entities (like Okta/Aegis), and action items.
* **Narration**:
  > "Let's navigate to the **Meetings Explorer**. Here, users can search and filter meetings by call type, sentiment, or client name.
  > 
  > If I search for 'billing', the app queries our DuckDB full-text index and returns matching records. 
  > 
  > When I click on a meeting, a detailed inspection drawer slides out. We can review the full meeting summary, inspect the time-stamped speaker turns, view extracted entities like products and competitors, and track meeting-specific action items."

---

### Section 4: Relational Knowledge Graph (3:15 - 4:15)
* **Screen Action**: Click on the "Knowledge Graph" tab. Drag some nodes around to show the physics simulation in action. Zoom in and out using the mouse wheel. Click on the node labeled `Okta`. Show the associated connections list in the side inspector pane.
* **Narration**:
  > "Next, let's explore the **Knowledge Graph**. The ingestion engine populates DuckDB tables representing nodes like Meetings, Speakers, Products, and Competitors, along with their linkages.
  > 
  > We render this on an interactive HTML5 Canvas driven by a **2D particle physics engine**. Nodes repel each other so text remains readable, and connected nodes pull together to show natural clustering.
  > 
  > If I click on the competitor node 'Okta', the inspector sidebar shows its connections: we see which customers mentioned Okta, and which meetings discussed Okta migrations. This visual tool lets analysts trace competitive threats and product requests instantly."

---

### Section 5: AI Copilot & Action Items (4:15 - 5:30)
* **Screen Action**: Click on the "AI Copilot" tab. Enter the query:
  `Who is Gregory Fisk and what is his issue?`
  Click Ask. Show the response stream and point to the bracketed citation links (e.g. `[Support Case #...]`). Show the "Action Items" page, click "Open" and change its status to "Closed".
* **Narration**:
  > "Finally, let's look at the **AI Copilot**. This interface uses Retrieval-Augmented Generation (RAG) to answer questions in natural language.
  > 
  > Let's ask: 'Who is Gregory Fisk and what is his issue?'
  > 
  > The backend queries our DuckDB search index, extracts the relevant segments, and passes them as grounding context to the Gemini 1.5 Flash API. 
  > 
  > The Copilot answers that Gregory Fisk represents Redwood Clinical and experienced a billing discrepancy after an overage charge. Notice that the response contains precise bracketed citations linking back to the source meetings. If our Gemini key is not configured, the copilot gracefully routes the query to an offline heuristic template database, keeping the app functional.
  > 
  > Over in our **Action Center**, users can view all extracted action items and check them off. When I mark a task as 'Closed', it dispatches a PUT request to the backend, updating the DuckDB status in real-time.
  > 
  > By combining OLAP analytics, relational graphs, and generative RAG search into a single product, ConverSight AI provides B2B leaders with a powerful tool to understand and act on their client conversations. 
  > 
  > Thank you for watching."
