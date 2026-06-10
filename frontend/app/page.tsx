"use client";

import { useEffect, useState } from "react";

interface KPI {
  total_meetings: number;
  average_sentiment: number;
  total_hours: number;
}

interface CustomerRisk {
  customer: string;
  risk: string;
  avg_sentiment: number;
  support_calls: number;
  total_calls: number;
}

interface ProductIssue {
  issue: string;
  volume: number;
}

interface FeatureRequest {
  feature: string;
  volume: number;
}

interface TimelinePoint {
  date: string;
  sentiment: number;
  count: number;
}

interface DashboardData {
  kpis: KPI;
  call_type_breakdown: Record<string, number>;
  sentiment_breakdown: Record<string, number>;
  customer_risk: CustomerRisk[];
  product_risk: ProductIssue[];
  feature_requests: FeatureRequest[];
  sentiment_timeline: TimelinePoint[];
}

interface ActionItem {
  id: string;
  meeting_id: string;
  meeting_title: string;
  task: string;
  owner: string;
  deadline: string;
  status: string;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:8000/api/analytics/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard analytics");
      const json = await res.json();
      setData(json);

      const aiRes = await fetch("http://localhost:8000/api/analytics/action-items");
      if (aiRes.ok) {
        const aiJson = await aiRes.json();
        setActionItems(aiJson);
      }
      setError(null);
    } catch (e: any) {
      setError(e.message || "Could not connect to backend server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleToggleActionItem = async (itemId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "Closed" ? "Open" : "Closed";
    try {
      // Optimistic UI update
      setActionItems(prev => prev.map(item => item.id === itemId ? { ...item, status: nextStatus } : item));
      
      const res = await fetch(`http://localhost:8000/api/action-items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) throw new Error("Failed to update status");
      
      // Refresh dashboard analytics to update health scores
      const statsRes = await fetch("http://localhost:8000/api/analytics/dashboard");
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        setData(statsJson);
      }
    } catch (e) {
      // Revert optimistic update
      setActionItems(prev => prev.map(item => item.id === itemId ? { ...item, status: currentStatus } : item));
      alert("Failed to update action item status");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm">Loading Conversational Analytics Warehouse...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4 max-w-md mx-auto text-center">
        <div className="text-red-500 text-4xl">⚠️</div>
        <h3 className="font-bold text-lg text-white">Connection Error</h3>
        <p className="text-slate-400 text-sm">{error || "Ensure the FastAPI server is running on localhost:8000."}</p>
        <button 
          onClick={fetchDashboardData}
          className="mt-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition-all"
        >
          Try Reconnecting
        </button>
      </div>
    );
  }

  // Sentiment score formatting (map 1-5 to percentage or rating)
  const formatSentiment = (score: number) => {
    if (score >= 4.0) return { label: "Excellent", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" };
    if (score >= 3.2) return { label: "Positive", color: "text-blue-400 bg-blue-500/10 border-blue-500/25" };
    if (score >= 2.8) return { label: "Mixed", color: "text-amber-400 bg-amber-500/10 border-amber-500/25" };
    return { label: "Negative", color: "text-rose-400 bg-rose-500/10 border-rose-500/25" };
  };

  // Render simple responsive timeline SVG chart
  const renderTimelineChart = () => {
    const points = data.sentiment_timeline;
    if (!points || points.length === 0) return null;

    const width = 600;
    const height = 150;
    const padding = 20;

    // Find min/max values
    const sentiments = points.map(p => p.sentiment);
    const minS = 1.0;
    const maxS = 5.0;

    const getX = (index: number) => padding + (index / (points.length - 1)) * (width - 2 * padding);
    const getY = (val: number) => height - padding - ((val - minS) / (maxS - minS)) * (height - 2 * padding);

    // Build SVG path
    let pathD = "";
    let areaD = "";
    
    points.forEach((p, idx) => {
      const x = getX(idx);
      const y = getY(p.sentiment);
      
      if (idx === 0) {
        pathD = `M ${x} ${y}`;
        areaD = `M ${x} ${height - padding} L ${x} ${y}`;
      } else {
        pathD += ` L ${x} ${y}`;
        areaD += ` L ${x} ${y}`;
      }
      if (idx === points.length - 1) {
        areaD += ` L ${x} ${height - padding} Z`;
      }
    });

    return (
      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Grids */}
          {[1, 2, 3, 4, 5].map(tick => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
                {tick % 2 === 1 && (
                  <text x={padding - 5} y={y + 3} fill="rgba(255,255,255,0.3)" fontSize={8} textAnchor="end">{tick}.0</text>
                )}
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill="url(#chartGrad)" opacity={0.15} />

          {/* Line Path */}
          <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Interaction Dots */}
          {points.map((p, idx) => (
            <circle
              key={idx}
              cx={getX(idx)}
              cy={getY(p.sentiment)}
              r={3}
              className="fill-indigo-400 stroke-[#090d16] stroke-2 cursor-pointer hover:r-5 transition-all"
            >
              <title>{`${p.date}: ${p.sentiment}`}</title>
            </circle>
          ))}

          {/* Gradients */}
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Executive Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">SaaS-grade business intelligence distilled from conversations.</p>
        </div>
        
        <button 
          onClick={fetchDashboardData}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800/80 transition-all text-slate-300"
        >
          🔄 Refresh Feed
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Meetings Ingested</span>
            <span className="text-indigo-400 text-lg">📞</span>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white">{data.kpis.total_meetings}</span>
            <span className="text-[10px] text-emerald-500 font-semibold px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">100% Ingested</span>
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Average Platform Sentiment</span>
            <span className="text-indigo-400 text-lg">✨</span>
          </div>
          <div className="mt-4 flex items-baseline space-x-3">
            <span className="text-3xl font-bold text-white">{data.kpis.average_sentiment}</span>
            <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${formatSentiment(data.kpis.average_sentiment).color}`}>
              {formatSentiment(data.kpis.average_sentiment).label}
            </span>
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Ingested Audio</span>
            <span className="text-indigo-400 text-lg">⏳</span>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white">{data.kpis.total_hours} hrs</span>
            <span className="text-[10px] text-slate-500">38.4 hours of conversation</span>
          </div>
        </div>
      </div>

      {/* Row 2: Sentiment Timeline & Call Types Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart widget */}
        <div className="glass-panel p-6 lg:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sentiment Timeline (Daily Average)</h3>
            <p className="text-xs text-slate-500 mt-1">Calculated platform-wide average sentiment values.</p>
          </div>
          <div className="mt-6 flex-1 flex items-center">
            {renderTimelineChart()}
          </div>
        </div>

        {/* Call Type donut breakdown */}
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Call Channels</h3>
            <p className="text-xs text-slate-500 mt-1">Transcripts categorized by context.</p>
          </div>
          <div className="mt-6 space-y-4">
            {Object.entries(data.call_type_breakdown).map(([type, val]) => {
              const pct = Math.round((val / data.kpis.total_meetings) * 100);
              const color = type === "Support" ? "bg-rose-500" : type === "Internal" ? "bg-amber-500" : "bg-indigo-500";
              return (
                <div key={type} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">{type} Calls</span>
                    <span className="text-slate-400">{val} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div className={`${color} h-full rounded-full`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Customer Churn Risks & Product Issues Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Churn Risk List */}
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Customer Churn Risk List</h3>
            <p className="text-xs text-slate-500 mt-1">Accounts classified by support escalations and call sentiments.</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5">Account / Company</th>
                  <th className="py-2.5">Risk Score</th>
                  <th className="py-2.5">Sentiment</th>
                  <th className="py-2.5 text-right">Support / Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data.customer_risk.map(cr => (
                  <tr key={cr.customer} className="hover:bg-slate-900/20 transition-all">
                    <td className="py-3 font-semibold text-slate-200">{cr.customer}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cr.risk === "High" ? "text-rose-400 bg-rose-500/10" :
                        cr.risk === "Medium" ? "text-amber-400 bg-amber-500/10" :
                        "text-emerald-400 bg-emerald-500/10"
                      }`}>
                        {cr.risk} Risk
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">{cr.avg_sentiment.toFixed(2)}</td>
                    <td className="py-3 text-right text-slate-400 font-semibold">{cr.support_calls} / {cr.total_calls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Product Feedback & Feature Requests Heatmap */}
        <div className="glass-panel p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Product Intelligence & Priorities</h3>
            <p className="text-xs text-slate-500 mt-1">Common issues and requested features ranked by frequency.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {/* Top Bugs */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Top Complaints & Bugs</h4>
              <div className="space-y-2">
                {data.product_risk.slice(0, 5).map((pr, idx) => (
                  <div key={pr.issue} className="bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-xl text-left">
                    <div className="text-slate-200 text-xs font-semibold truncate" title={pr.issue}>{pr.issue}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">Reported in {pr.volume} calls</div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Top Feature Requests */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Feature Requests</h4>
              <div className="space-y-2">
                {data.feature_requests.slice(0, 5).map((fr, idx) => (
                  <div key={fr.feature} className="bg-indigo-500/5 border border-indigo-500/10 p-2.5 rounded-xl text-left">
                    <div className="text-slate-200 text-xs font-semibold truncate" title={fr.feature}>{fr.feature}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">Requested in {fr.volume} calls</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Action Items Center */}
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Action Items Center</h3>
            <p className="text-xs text-slate-500 mt-1">Key tasks extracted from meetings. Click checkboxes to update status.</p>
          </div>
          <span className="text-xs font-semibold text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            Total Pending: {actionItems.filter(ai => ai.status !== "Closed").length}
          </span>
        </div>
        
        <div className="mt-4 max-h-96 overflow-y-auto space-y-2">
          {actionItems.length === 0 ? (
            <p className="text-slate-500 text-center py-6 text-sm">No action items found.</p>
          ) : (
            actionItems.map(ai => (
              <div 
                key={ai.id} 
                className={`p-3.5 border rounded-xl flex items-center justify-between transition-all ${
                  ai.status === "Closed" 
                    ? "bg-slate-900/30 border-slate-800/40 opacity-60" 
                    : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700/60"
                }`}
              >
                <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                  <input 
                    type="checkbox" 
                    checked={ai.status === "Closed"}
                    onChange={() => handleToggleActionItem(ai.id, ai.status)}
                    className="w-4.5 h-4.5 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-600 focus:ring-offset-slate-950 accent-indigo-500 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium text-slate-200 ${ai.status === "Closed" ? "line-through text-slate-500" : ""}`}>
                      {ai.task}
                    </p>
                    <div className="flex items-center space-x-3 mt-1.5 text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-400">👤 {ai.owner}</span>
                      <span>•</span>
                      <span>🗓️ {ai.deadline}</span>
                      <span>•</span>
                      <span className="truncate text-slate-400 max-w-[200px]" title={ai.meeting_title}>📞 {ai.meeting_title}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
