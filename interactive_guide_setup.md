# Building an Interactive Onboarding Guide — ConverSight AI

To provide users (and your interview panel) with a guided walkthrough of the dashboard, you can build an **interactive onboarding tour** directly into the frontend. 

Below are two approaches: **Option A** is a lightweight, zero-dependency, custom React tour component that matches the slate-dark glassmorphism styling of ConverSight AI. **Option B** outlines how to integrate standard libraries.

---

## Option A: Lightweight, Zero-Dependency React Tour (Recommended)

This approach creates an overlay that highlights different elements on the page (Dashboard KPIs, Churn risks, Knowledge Graph, AI Copilot) step-by-step.

### 1. Create the Tour Component
Create a new file at `frontend/app/components/OnboardingTour.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";

interface TourStep {
  target: string; // CSS Selector of the element to highlight
  title: string;
  content: string;
  position: "bottom" | "top" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "header",
    title: "Welcome to ConverSight AI",
    content: "This intelligence dashboard distills 100 raw customer support, renewals, and engineering transcripts into actionable analytics.",
    position: "bottom"
  },
  {
    target: ".grid-cols-1.md\\:grid-cols-3", // KPI cards
    title: "Executive KPIs",
    content: "Monitor high-level metrics including total meetings, platform-wide sentiment, and aggregate audio hours in real-time.",
    position: "bottom"
  },
  {
    target: "table", // Customer Risk table
    title: "Churn Prediction List",
    content: "Our custom algorithm scans sentiment scores and CS ticket frequencies to proactively flag clients at risk of churning (e.g. Summit Trust).",
    position: "top"
  },
  {
    target: ".grid-cols-2.gap-4", // Product risks columns
    title: "Product Priorities",
    content: "Bugs are automatically separated from feature requests. Focus developer backlogs on what affects customer experience most.",
    position: "top"
  },
  {
    target: "input[type='checkbox']", // Action items checkbox
    title: "Automated Action Items",
    content: "Action items are extracted during ingestion. Check off items directly here to sync status updates to the database in real-time.",
    position: "top"
  }
];

export default function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });

  useEffect(() => {
    // Check if the user has already completed the tour
    const completed = localStorage.getItem("conversight_tour_completed");
    if (!completed) {
      setTimeout(() => setActive(true), 1200); // Trigger tour after load
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const updatePosition = () => {
      const step = TOUR_STEPS[stepIdx];
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setCoords({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        });
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [active, stepIdx]);

  const handleNext = () => {
    if (stepIdx < TOUR_STEPS.length - 1) {
      setStepIdx(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (stepIdx > 0) {
      setStepIdx(prev => prev - 1);
    }
  };

  const handleClose = () => {
    setActive(false);
    localStorage.setItem("conversight_tour_completed", "true");
  };

  const restartTour = () => {
    setStepIdx(0);
    setActive(true);
  };

  if (!active) {
    return (
      <button
        onClick={restartTour}
        className="fixed bottom-6 right-6 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-full shadow-lg hover:shadow-indigo-500/25 transition-all z-40 cursor-pointer flex items-center space-x-1.5"
      >
        <span>💡</span>
        <span>Quick Dashboard Tour</span>
      </button>
    );
  }

  const currentStep = TOUR_STEPS[stepIdx];

  return (
    <>
      {/* Target Highlight Overlay Ring */}
      <div
        className="absolute border-2 border-indigo-400 rounded-2xl pointer-events-none transition-all duration-300 z-50 shadow-[0_0_0_9999px_rgba(3,7,18,0.7)]"
        style={{
          top: `${coords.top - 6}px`,
          left: `${coords.left - 6}px`,
          width: `${coords.width + 12}px`,
          height: `${coords.height + 12}px`
        }}
      />

      {/* Tour Dialog Card */}
      <div
        className="fixed bg-[#090d16] border border-slate-800 p-5 rounded-2xl w-80 shadow-2xl transition-all duration-300 z-50 text-left"
        style={{
          top: `${coords.top + coords.height + 16}px`,
          left: `${coords.left + coords.width / 2 - 160}px`
        }}
      >
        <div className="flex justify-between items-center mb-2.5">
          <h4 className="font-bold text-white text-sm">{currentStep.title}</h4>
          <span className="text-[10px] text-slate-500 font-bold">
            {stepIdx + 1} / {TOUR_STEPS.length}
          </span>
        </div>
        
        <p className="text-xs text-slate-300 leading-relaxed">
          {currentStep.content}
        </p>

        <div className="flex justify-between items-center mt-4 border-t border-slate-850 pt-3">
          <button
            onClick={handleClose}
            className="text-[10px] text-slate-500 hover:text-white underline cursor-pointer"
          >
            Skip Tour
          </button>
          
          <div className="flex space-x-2">
            <button
              disabled={stepIdx === 0}
              onClick={handlePrev}
              className="px-2.5 py-1 text-[10px] bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-100 rounded-lg disabled:opacity-40 disabled:hover:bg-slate-900 transition-all cursor-pointer"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              className="px-3 py-1 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-all cursor-pointer"
            >
              {stepIdx === TOUR_STEPS.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

### 2. Include the Guide on the Dashboard
Open `frontend/app/page.tsx` and import the onboarding guide component at the bottom of the page return block:

```tsx
// At the top imports in page.tsx
import OnboardingTour from "./components/OnboardingTour";

// Inside the Dashboard() component return:
return (
  <div className="space-y-8 relative">
    {/* Page Title & KPI Cards... */}
    
    {/* Mount the Guide Overlay */}
    <OnboardingTour />
  </div>
);
```

---

## Option B: Using a Library (React Joyride)

If you prefer a full-featured third-party library, **React Joyride** is the standard for React-based guided tours.

### 1. Install Dependency
Run the following in the `frontend` folder:
```bash
npm install react-joyride
```

### 2. Configure steps
Integrate the Joyride component into your main page:

```tsx
import Joyride, { Step } from "react-joyride";

const steps: Step[] = [
  {
    target: "header",
    content: "Welcome to the ConverSight intelligence platform.",
    placement: "bottom"
  },
  {
    target: ".glass-card",
    content: "These show key KPI metrics aggregated directly from the raw transcript database.",
    placement: "bottom"
  }
];

export default function Dashboard() {
  return (
    <div>
      <Joyride 
        steps={steps} 
        continuous 
        showSkipButton 
        styles={{
          options: {
            backgroundColor: '#090d16',
            textColor: '#94a3b8',
            primaryColor: '#6366f1',
            arrowColor: '#090d16',
          }
        }}
      />
      {/* Dashboard UI... */}
    </div>
  );
}
```

---

## Option C: Codebase Guide (Command-Line Walkthrough)

To give the panel an interactive guide *in the terminal* (useful during Q&A), you can document a set of quick query triggers:
1. Run local DuckDB query tests:
   ```bash
   ./venv/bin/python -c "import duckdb; conn = duckdb.connect('backend/data/conversight.db'); print(conn.execute('SELECT title, overall_sentiment FROM meetings LIMIT 3').fetchall())"
   ```
2. Trigger ingestion and watch cache flush logs:
   ```bash
   curl -X POST http://localhost:8000/api/ingestion/run
   ```
3. Query the RAG Copilot from the CLI:
   ```bash
   curl -X POST http://localhost:8000/api/rag/query -H "Content-Type: application/json" -d '{"query": "Who is Gregory Fisk?"}'
   ```
