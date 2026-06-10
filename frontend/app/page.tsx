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

interface Meeting {
  meeting_id: string;
  title: string;
  organizer_email: string;
  host: string;
  start_time: string;
  end_time: string;
  duration: number;
  summary: string;
  overall_sentiment: string;
  sentiment_score: number;
  call_type: string;
}

interface TranscriptTurn {
  speaker_name: string;
  speaker_role: string;
  sentence: string;
  sentiment_type: string;
  time: number;
  end_time: number;
  average_confidence: number;
  turn_index: number;
}

interface KeyMoment {
  time: number;
  text: string;
  type: string;
  speaker: string;
}

interface Entity {
  name: string;
  type: string;
}

interface MeetingDetail {
  meeting: Meeting;
  transcript: TranscriptTurn[];
  action_items: ActionItem[];
  topics: string[];
  key_moments: KeyMoment[];
  entities: Entity[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Interactive modal states
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRisk | null>(null);
  const [customerMeetings, setCustomerMeetings] = useState<Meeting[]>([]);
  const [loadingCustomerMeetings, setLoadingCustomerMeetings] = useState(false);
  
  const [selectedIssue, setSelectedIssue] = useState<{ name: string; type: "bug" | "feature"; volume: number } | null>(null);
  const [issueMeetings, setIssueMeetings] = useState<Meeting[]>([]);
  const [loadingIssueMeetings, setLoadingIssueMeetings] = useState(false);

  const [selectedDatePoint, setSelectedDatePoint] = useState<{ date: string; sentiment: number; count: number } | null>(null);
  const [dateMeetings, setDateMeetings] = useState<Meeting[]>([]);
  const [loadingDateMeetings, setLoadingDateMeetings] = useState(false);

  // Detail drawer states
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [meetingDetail, setMeetingDetail] = useState<MeetingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Interactive Timeline hover state
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Customer Churn List search, filtering and sorting state
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerRiskFilter, setCustomerRiskFilter] = useState("All");
  const [customerSortKey, setCustomerSortKey] = useState<keyof CustomerRisk | null>("risk"); // Default sort by Risk
  const [customerSortDirection, setCustomerSortDirection] = useState<"asc" | "desc">("desc");

  // Product Priorities category tabs and search
  const [productTab, setProductTab] = useState<"all" | "bug" | "feature">("all");
  const [productSearch, setProductSearch] = useState("");
  
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

  // Click handlers for interactive overlays
  const handleCustomerClick = async (cr: CustomerRisk) => {
    setSelectedCustomer(cr);
    try {
      setLoadingCustomerMeetings(true);
      const res = await fetch(`http://localhost:8000/api/meetings?customer=${encodeURIComponent(cr.customer)}&limit=20`);
      if (res.ok) {
        const json = await res.json();
        setCustomerMeetings(json.meetings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCustomerMeetings(false);
    }
  };

  const handleIssueClick = async (name: string, type: "bug" | "feature", volume: number) => {
    setSelectedIssue({ name, type, volume });
    try {
      setLoadingIssueMeetings(true);
      // Clean query search term (first two words)
      const query = name.split(" ").slice(0, 2).join(" ");
      const res = await fetch(`http://localhost:8000/api/meetings?search=${encodeURIComponent(query)}&limit=20`);
      if (res.ok) {
        const json = await res.json();
        setIssueMeetings(json.meetings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingIssueMeetings(false);
    }
  };

  const handleDateClick = async (point: { date: string; sentiment: number; count: number }) => {
    setSelectedDatePoint(point);
    try {
      setLoadingDateMeetings(true);
      const res = await fetch(`http://localhost:8000/api/meetings?limit=100`);
      if (res.ok) {
        const json = await res.json();
        const filtered = json.meetings.filter((m: Meeting) => m.start_time.startsWith(point.date));
        setDateMeetings(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDateMeetings(false);
    }
  };

  const handleMeetingClick = async (id: string) => {
    setSelectedMeetingId(id);
    try {
      setLoadingDetail(true);
      const res = await fetch(`http://localhost:8000/api/meetings/${id}`);
      if (res.ok) {
        const json = await res.json();
        setMeetingDetail(json);
      }
    } catch (err) {
      console.error(err);
      setSelectedMeetingId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Customer sorting logic
  const handleCustomerSort = (key: keyof CustomerRisk) => {
    if (customerSortKey === key) {
      setCustomerSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setCustomerSortKey(key);
      setCustomerSortDirection(key === "customer" ? "asc" : "desc");
    }
  };

  // Get filtered and sorted customer churn risks
  const getFilteredAndSortedCustomers = () => {
    if (!data || !data.customer_risk) return [];
    return data.customer_risk
      .filter(cr => {
        const matchesSearch = cr.customer.toLowerCase().includes(customerSearch.toLowerCase());
        const matchesRisk = customerRiskFilter === "All" || cr.risk === customerRiskFilter;
        return matchesSearch && matchesRisk;
      })
      .sort((a, b) => {
        if (!customerSortKey) return 0;
        const valA = a[customerSortKey];
        const valB = b[customerSortKey];

        if (typeof valA === "string" && typeof valB === "string") {
          return customerSortDirection === "asc" 
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        } else if (typeof valA === "number" && typeof valB === "number") {
          return customerSortDirection === "asc"
            ? valA - valB
            : valB - valA;
        }
        return 0;
      });
  };

  // Product Priorities combined priorities list
  const getFilteredPriorities = () => {
    if (!data) return [];
    const combined = [
      ...(data.product_risk || []).map(pr => ({ name: pr.issue, type: "bug" as const, volume: pr.volume })),
      ...(data.feature_requests || []).map(fr => ({ name: fr.feature, type: "feature" as const, volume: fr.volume }))
    ];
    
    // Sort initially by volume to find maximum volume
    const sorted = combined.sort((a, b) => b.volume - a.volume);
    const maxVolume = sorted.length > 0 ? sorted[0].volume : 1;

    return sorted
      .map(p => ({ ...p, maxVal: maxVolume }))
      .filter(p => {
        const matchesTab = productTab === "all" || p.type === productTab;
        const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
        return matchesTab && matchesSearch;
      });
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

    const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const svgX = (clientX / rect.width) * width;
      
      let nearestIdx = 0;
      let minDiff = Infinity;
      
      points.forEach((p, idx) => {
        const x = getX(idx);
        const diff = Math.abs(x - svgX);
        if (diff < minDiff) {
          minDiff = diff;
          nearestIdx = idx;
        }
      });
      
      setHoveredPointIdx(nearestIdx);
      setTooltipPos({
        x: getX(nearestIdx),
        y: getY(points[nearestIdx].sentiment) - 12
      });
    };

    const handleSvgMouseLeave = () => {
      setHoveredPointIdx(null);
      setTooltipPos(null);
    };

    return (
      <div className="relative w-full">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto overflow-visible select-none"
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={handleSvgMouseLeave}
        >
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
          <path d={areaD} fill="url(#chartGrad)" opacity={0.12} />

          {/* Line Path with Drawing Animation */}
          <path 
            d={pathD} 
            fill="none" 
            stroke="#6366f1" 
            strokeWidth={2.5} 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="animate-draw-path"
          />

          {/* Vertical Tracking Line */}
          {hoveredPointIdx !== null && (
            <line 
              x1={getX(hoveredPointIdx)} 
              y1={padding} 
              x2={getX(hoveredPointIdx)} 
              y2={height - padding} 
              stroke="rgba(99, 102, 241, 0.35)" 
              strokeWidth={1.5} 
              strokeDasharray="3 3"
              className="pointer-events-none"
            />
          )}

          {/* Pulsing Active Dot Glow */}
          {hoveredPointIdx !== null && (
            <circle
              cx={getX(hoveredPointIdx)}
              cy={getY(points[hoveredPointIdx].sentiment)}
              r={9}
              className="fill-indigo-500/25 stroke-indigo-400/30 stroke-[1.5] animate-ping pointer-events-none"
            />
          )}

          {/* Interaction Dots */}
          {points.map((p, idx) => {
            const isHovered = hoveredPointIdx === idx;
            const isSelected = selectedDatePoint?.date === p.date;
            return (
              <circle
                key={idx}
                cx={getX(idx)}
                cy={getY(p.sentiment)}
                r={isHovered ? 6.5 : isSelected ? 5.5 : 4}
                onClick={() => handleDateClick(p)}
                className={`cursor-pointer transition-all duration-150 ${
                  isHovered 
                    ? "fill-teal-400 stroke-[#090d16] stroke-2 shadow-lg" 
                    : isSelected 
                      ? "fill-indigo-400 stroke-teal-400 stroke-2" 
                      : "fill-indigo-500 stroke-[#090d16] stroke-1.5 hover:fill-teal-400"
                }`}
              />
            );
          })}

          {/* Gradients */}
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Hover Tooltip Overlay */}
        {tooltipPos && hoveredPointIdx !== null && (
          <div 
            className="absolute pointer-events-none bg-[#090d16]/95 border border-indigo-500/40 rounded-xl p-2.5 shadow-2xl z-30 text-[10px] flex flex-col space-y-0.5 backdrop-blur-md transition-all duration-75 text-left min-w-[125px]"
            style={{
              left: `${(tooltipPos.x / width) * 100}%`,
              top: `${(tooltipPos.y / height) * 100}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-bold text-slate-200">🗓️ {points[hoveredPointIdx].date}</div>
            <div className="flex items-center space-x-1.5 mt-1">
              <span className="text-slate-400">Sentiment:</span>
              <span className={`font-extrabold ${
                points[hoveredPointIdx].sentiment >= 4.0 ? "text-emerald-400" :
                points[hoveredPointIdx].sentiment >= 3.2 ? "text-blue-400" :
                points[hoveredPointIdx].sentiment >= 2.8 ? "text-amber-400" :
                "text-rose-400"
              }`}>
                {points[hoveredPointIdx].sentiment.toFixed(2)}
              </span>
            </div>
            <div className="text-indigo-400 font-semibold">{points[hoveredPointIdx].count} meetings</div>
            <div className="text-[8px] text-slate-500 font-bold border-t border-slate-800/80 pt-1 mt-1 text-center">Click to drill down</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 relative">
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
            <p className="text-xs text-slate-500 mt-1">Calculated platform-wide average sentiment values. Click nodes to inspect daily calls.</p>
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
        <div className="glass-panel p-6 flex flex-col justify-between min-h-[440px]">
          <div className="shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Customer Churn Risk List</h3>
              <span className="text-[10px] text-indigo-400 font-semibold px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full w-fit">
                {getFilteredAndSortedCustomers().length} Accounts
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 mb-4">Accounts classified by CS calls. Click customer to explore profile.</p>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  placeholder="Search accounts..." 
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all"
                />
                {customerSearch && (
                  <button 
                    onClick={() => setCustomerSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
              <select
                value={customerRiskFilter}
                onChange={(e) => setCustomerRiskFilter(e.target.value)}
                className="bg-slate-955 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer"
              >
                <option value="All">All Risks</option>
                <option value="High">High Risk</option>
                <option value="Medium">Medium Risk</option>
                <option value="Low">Low Risk</option>
              </select>
            </div>
          </div>

          <div className="mt-2 flex-1 overflow-y-auto max-h-[280px] pr-1">
            {getFilteredAndSortedCustomers().length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <span className="text-xl">🔍</span>
                <p className="text-xs mt-2">No matching accounts found.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs table-fixed">
                <thead className="sticky top-0 bg-[#090d16] z-10">
                  <tr className="border-b border-slate-850 text-slate-400 font-semibold">
                    <th 
                      onClick={() => handleCustomerSort("customer")}
                      className="py-2.5 cursor-pointer hover:text-white transition-colors w-[35%]"
                    >
                      Account {customerSortKey === "customer" ? (customerSortDirection === "asc" ? "▴" : "▾") : ""}
                    </th>
                    <th 
                      onClick={() => handleCustomerSort("risk")}
                      className="py-2.5 cursor-pointer hover:text-white transition-colors w-[22%]"
                    >
                      Risk {customerSortKey === "risk" ? (customerSortDirection === "asc" ? "▴" : "▾") : ""}
                    </th>
                    <th 
                      onClick={() => handleCustomerSort("avg_sentiment")}
                      className="py-2.5 cursor-pointer hover:text-white transition-colors w-[25%]"
                    >
                      Sentiment {customerSortKey === "avg_sentiment" ? (customerSortDirection === "asc" ? "▴" : "▾") : ""}
                    </th>
                    <th 
                      onClick={() => handleCustomerSort("support_calls")}
                      className="py-2.5 cursor-pointer hover:text-white transition-colors text-right w-[18%]"
                    >
                      CS/Total {customerSortKey === "support_calls" ? (customerSortDirection === "asc" ? "▴" : "▾") : ""}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {getFilteredAndSortedCustomers().map(cr => {
                    const sentimentPct = (cr.avg_sentiment / 5.0) * 100;
                    const barColor = cr.avg_sentiment >= 4.0 ? "bg-emerald-500" :
                                     cr.avg_sentiment >= 3.2 ? "bg-blue-500" :
                                     cr.avg_sentiment >= 2.8 ? "bg-amber-500" :
                                     "bg-rose-500";
                    return (
                      <tr 
                        key={cr.customer} 
                        onClick={() => handleCustomerClick(cr)}
                        className="hover-row-shift cursor-pointer border-b border-slate-850/30 transition-all active:scale-[0.995]"
                      >
                        <td className="py-3 font-bold text-slate-200 truncate pr-2">{cr.customer}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            cr.risk === "High" ? "text-rose-400 bg-rose-500/10 border border-rose-500/20" :
                            cr.risk === "Medium" ? "text-amber-400 bg-amber-500/10 border border-amber-500/20" :
                            "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                          }`}>
                            {cr.risk}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-300">{cr.avg_sentiment.toFixed(2)}</span>
                            <div className="w-16 bg-slate-950 rounded-full h-1 overflow-hidden mt-1 border border-slate-900">
                              <div className={`${barColor} h-full rounded-full`} style={{ width: `${sentimentPct}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-right text-slate-400 font-bold pr-1">{cr.support_calls} / {cr.total_calls}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Product Feedback & Feature Requests Heatmap */}
        <div className="glass-panel p-6 flex flex-col justify-between min-h-[440px]">
          <div className="shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Product Intelligence & Priorities</h3>
              {/* Category tabs */}
              <div className="flex bg-slate-950 border border-slate-800 p-0.5 rounded-xl text-[10px]">
                {(["all", "bug", "feature"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setProductTab(tab)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer capitalize ${
                      productTab === tab 
                        ? "bg-indigo-600 text-white" 
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab === "all" ? "All" : tab === "bug" ? "Bugs" : "Features"}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1 mb-4">Common issues and features. Click cards to view discussed meetings.</p>

            {/* Priorities search */}
            <div className="relative mb-4 shrink-0">
              <input 
                type="text" 
                placeholder="Search topics, bugs, or feature requests..." 
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full bg-slate-955 border border-slate-800 rounded-xl px-3.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
              {productSearch && (
                <button 
                  onClick={() => setProductSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 flex-1 overflow-y-auto max-h-[280px] pr-1">
            {getFilteredPriorities().length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <span className="text-xl">🔍</span>
                <p className="text-xs mt-2">No matching topics found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
                {getFilteredPriorities().map(p => {
                  const relativePct = (p.volume / p.maxVal) * 100;
                  const isBug = p.type === "bug";
                  return (
                    <div 
                      key={p.name} 
                      onClick={() => handleIssueClick(p.name, p.type, p.volume)}
                      className={`p-3 rounded-xl text-left cursor-pointer transition-all active:scale-[0.99] flex flex-col justify-between min-h-[90px] border ${
                        isBug 
                          ? "bg-rose-500/5 border-rose-500/10 hover-glow-rose hover:bg-rose-500/10" 
                          : "bg-indigo-500/5 border-indigo-500/10 hover-glow-indigo hover:bg-indigo-500/10"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={`text-[8px] px-1.5 py-0.5 font-bold uppercase tracking-wider rounded ${
                            isBug ? "text-rose-400 bg-rose-500/15" : "text-indigo-400 bg-indigo-500/15"
                          }`}>
                            {isBug ? "Bug" : "Feature"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">{p.volume} calls</span>
                        </div>
                        <div className="text-slate-200 text-xs font-bold mt-2 truncate pr-1" title={p.name}>
                          {p.name}
                        </div>
                      </div>
                      <div className="w-full mt-2.5">
                        <div className="w-full bg-slate-950/80 rounded-full h-1 overflow-hidden border border-slate-900">
                          <div 
                            className={`h-full rounded-full ${isBug ? "bg-rose-500" : "bg-indigo-500"}`} 
                            style={{ width: `${relativePct}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

      {/* ===========================================
          INTERACTIVE OVERLAY MODALS & DRAWERS
          =========================================== */}

      {/* 1. Customer Health Profile Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#090d16] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Customer Health Profile</span>
                <h3 className="font-bold text-lg text-white mt-1">{selectedCustomer.customer}</h3>
              </div>
              <button 
                onClick={() => { setSelectedCustomer(null); setCustomerMeetings([]); }}
                className="text-slate-400 hover:text-white font-bold text-xs bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl cursor-pointer hover:bg-slate-800"
              >
                Close Profile
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Customer Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Risk Level</div>
                  <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedCustomer.risk === "High" ? "text-rose-400 bg-rose-500/10" :
                    selectedCustomer.risk === "Medium" ? "text-amber-400 bg-amber-500/10" :
                    "text-emerald-400 bg-emerald-500/10"
                  }`}>
                    {selectedCustomer.risk}
                  </span>
                </div>
                <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Avg Sentiment</div>
                  <div className="text-xl font-bold text-white mt-1">{selectedCustomer.avg_sentiment.toFixed(2)} / 5.0</div>
                </div>
                <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Support Calls</div>
                  <div className="text-xl font-bold text-white mt-1">{selectedCustomer.support_calls} of {selectedCustomer.total_calls}</div>
                </div>
              </div>

              {/* Customer Meetings List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Associated Conversations</h4>
                {loadingCustomerMeetings ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : customerMeetings.length === 0 ? (
                  <p className="text-slate-500 text-xs py-4 text-center">No associated conversations found.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {customerMeetings.map(m => (
                      <div 
                        key={m.meeting_id}
                        onClick={() => handleMeetingClick(m.meeting_id)}
                        className="bg-slate-900/40 hover:bg-slate-800/30 border border-slate-850 p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-200 truncate">{m.title}</div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            🗓️ {new Date(m.start_time).toLocaleDateString()} • ⏳ {m.duration.toFixed(1)}m • Type: {m.call_type}
                          </div>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 font-bold rounded border ${formatSentiment(m.sentiment_score).color}`}>
                          {m.overall_sentiment}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Product Issue/Feature Details Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#090d16] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Product Intelligence Details ({selectedIssue.type === "bug" ? "Bug / Complaint" : "Feature Request"})
                </span>
                <h3 className="font-bold text-lg text-white mt-1">{selectedIssue.name}</h3>
              </div>
              <button 
                onClick={() => { setSelectedIssue(null); setIssueMeetings([]); }}
                className="text-slate-400 hover:text-white font-bold text-xs bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl cursor-pointer hover:bg-slate-800"
              >
                Close View
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="bg-indigo-950/10 border border-indigo-900/20 p-4.5 rounded-xl text-xs text-slate-300 leading-relaxed">
                This {selectedIssue.type} was mentioned and discussed across <b>{selectedIssue.volume} meetings</b> in the ingested transcripts database.
              </div>

              {/* Issue Meetings List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Meetings Discussing This Topic</h4>
                {loadingIssueMeetings ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : issueMeetings.length === 0 ? (
                  <p className="text-slate-500 text-xs py-4 text-center">No matching meetings found.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {issueMeetings.map(m => (
                      <div 
                        key={m.meeting_id}
                        onClick={() => handleMeetingClick(m.meeting_id)}
                        className="bg-slate-900/40 hover:bg-slate-800/30 border border-slate-850 p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-200 truncate">{m.title}</div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            🗓️ {new Date(m.start_time).toLocaleDateString()} • Type: {m.call_type}
                          </div>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 font-bold rounded border ${formatSentiment(m.sentiment_score).color}`}>
                          {m.overall_sentiment}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Daily Timeline Drilldown Modal */}
      {selectedDatePoint && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#090d16] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Daily Timeline Drilldown</span>
                <h3 className="font-bold text-lg text-white mt-1">Date: {selectedDatePoint.date}</h3>
              </div>
              <button 
                onClick={() => { setSelectedDatePoint(null); setDateMeetings([]); }}
                className="text-slate-400 hover:text-white font-bold text-xs bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl cursor-pointer hover:bg-slate-800"
              >
                Close View
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Date Summary Card */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Average Sentiment</div>
                  <div className="text-xl font-bold text-white mt-1">{selectedDatePoint.sentiment.toFixed(2)} / 5.0</div>
                </div>
                <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl text-center">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Meetings Held</div>
                  <div className="text-xl font-bold text-white mt-1">{selectedDatePoint.count} calls</div>
                </div>
              </div>

              {/* Date Meetings List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Meetings on this Day</h4>
                {loadingDateMeetings ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : dateMeetings.length === 0 ? (
                  <p className="text-slate-500 text-xs py-4 text-center">No meetings held on this date.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {dateMeetings.map(m => (
                      <div 
                        key={m.meeting_id}
                        onClick={() => handleMeetingClick(m.meeting_id)}
                        className="bg-slate-900/40 hover:bg-slate-800/30 border border-slate-850 p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-200 truncate">{m.title}</div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            ⏳ {m.duration.toFixed(1)}m • Type: {m.call_type}
                          </div>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 font-bold rounded border ${formatSentiment(m.sentiment_score).color}`}>
                          {m.overall_sentiment}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Sliding Meeting Detail Drawer */}
      {selectedMeetingId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-4xl bg-[#090d16] border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl relative">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              {loadingDetail || !meetingDetail ? (
                <div className="h-6 w-48 bg-slate-800 animate-pulse rounded"></div>
              ) : (
                <div>
                  <h3 className="font-bold text-base text-white">{meetingDetail.meeting.title}</h3>
                  <div className="flex items-center space-x-3 mt-1.5 text-xs text-slate-400">
                    <span className="font-semibold text-indigo-400">📞 {meetingDetail.meeting.call_type}</span>
                    <span>•</span>
                    <span>⏳ {meetingDetail.meeting.duration.toFixed(1)} mins</span>
                    <span>•</span>
                    <span>🗓️ {new Date(meetingDetail.meeting.start_time).toLocaleString()}</span>
                  </div>
                </div>
              )}
              <button
                onClick={() => { setSelectedMeetingId(null); setMeetingDetail(null); }}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-slate-800 transition-all text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetail || !meetingDetail ? (
                <div className="space-y-4">
                  <div className="h-24 bg-slate-900 animate-pulse rounded-xl"></div>
                  <div className="h-32 bg-slate-900 animate-pulse rounded-xl"></div>
                  <div className="h-48 bg-slate-900 animate-pulse rounded-xl"></div>
                </div>
              ) : (
                <>
                  {/* Summary & Topics */}
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Meeting Executive Summary</h4>
                    <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl text-xs leading-relaxed text-slate-300">
                      {meetingDetail.meeting.summary}
                    </div>
                    {meetingDetail.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {meetingDetail.topics.map(t => (
                          <span key={t} className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-900 border border-slate-800 text-slate-400">
                            🏷️ {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Grid: Action Items & Key Moments */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Action Items */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Action Items</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {meetingDetail.action_items.length === 0 ? (
                          <p className="text-slate-500 text-[11px]">No action items defined.</p>
                        ) : (
                          meetingDetail.action_items.map(ai => (
                            <div key={ai.id} className="bg-slate-900/40 border border-slate-850 p-3 rounded-xl flex flex-col">
                              <span className="text-xs font-semibold text-slate-200">{ai.task}</span>
                              <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-medium">
                                <span>👤 {ai.owner}</span>
                                <span>🗓️ {ai.deadline}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Key Moments */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Timeline Highlights</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {meetingDetail.key_moments.length === 0 ? (
                          <p className="text-slate-500 text-[11px]">No highlights extracted.</p>
                        ) : (
                          meetingDetail.key_moments.map((km, idx) => (
                            <div key={idx} className="bg-slate-900/40 border border-slate-850 p-3 rounded-xl">
                              <div className="flex justify-between items-start">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                  km.type === "concern" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                                  km.type === "positive_pivot" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                  "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                }`}>
                                  {km.type.replace("_", " ")}
                                </span>
                                <span className="text-[10px] text-slate-500 font-semibold">{km.time.toFixed(0)}s</span>
                              </div>
                              <p className="text-xs text-slate-300 mt-2 leading-relaxed">{km.text}</p>
                              <span className="text-[10px] text-slate-500 mt-1 block">Said by: {km.speaker}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Transcript Feed */}
                  <div className="space-y-3 border-t border-slate-800/60 pt-6">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Interactive Transcript Log</h4>
                    <div className="space-y-3 bg-slate-950/40 border border-slate-850 p-4 rounded-2xl max-h-[300px] overflow-y-auto">
                      {meetingDetail.transcript.map((turn) => {
                        const isEmployee = ["Support Agent", "Account Manager", "Engineer"].includes(turn.speaker_role);
                        return (
                          <div 
                            key={turn.turn_index} 
                            className={`flex flex-col max-w-[80%] ${isEmployee ? "ml-auto items-end" : "mr-auto items-start"}`}
                          >
                            <div className="flex items-baseline space-x-2 text-[10px] text-slate-500 mb-1">
                              <span className="font-semibold text-slate-400">{turn.speaker_name}</span>
                              <span>•</span>
                              <span>{turn.speaker_role}</span>
                              <span>•</span>
                              <span>{turn.time.toFixed(0)}s</span>
                            </div>
                            <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                              isEmployee 
                                ? "bg-indigo-600 text-white rounded-tr-none" 
                                : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none"
                            }`}>
                              {turn.sentence}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Drawer Drawer Footer */}
            <div className="p-4 border-t border-slate-800 bg-[#090d16] flex justify-end shrink-0">
              <button
                onClick={() => { setSelectedMeetingId(null); setMeetingDetail(null); }}
                className="px-5 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
