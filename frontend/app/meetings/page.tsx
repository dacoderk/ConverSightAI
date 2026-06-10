"use client";

import { useEffect, useState, useTransition } from "react";

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

interface ActionItem {
  id: string;
  task: string;
  owner: string;
  deadline: string;
  status: string;
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

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [callType, setCallType] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MeetingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  const [isPending, startTransition] = useTransition();
  const limit = 12;

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      let url = `http://localhost:8000/api/meetings?limit=${limit}&offset=${offset}`;
      
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (callType) url += `&call_type=${encodeURIComponent(callType)}`;
      if (sentiment) url += `&sentiment=${encodeURIComponent(sentiment)}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch meetings");
      const json = await res.json();
      setMeetings(json.meetings);
      setTotal(json.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetingDetail = async (id: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`http://localhost:8000/api/meetings/${id}`);
      if (!res.ok) throw new Error("Failed to fetch meeting details");
      const json = await res.json();
      setDetail(json);
    } catch (err) {
      console.error(err);
      setSelectedMeetingId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [page, callType, sentiment]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMeetings();
  };

  const handleMeetingClick = (id: string) => {
    setSelectedMeetingId(id);
    fetchMeetingDetail(id);
  };

  const formatSentiment = (score: number) => {
    if (score >= 4.0) return "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";
    if (score >= 3.2) return "text-blue-400 bg-blue-500/10 border-blue-500/25";
    if (score >= 2.8) return "text-amber-400 bg-amber-500/10 border-amber-500/25";
    return "text-rose-400 bg-rose-500/10 border-rose-500/25";
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Meeting Records</h2>
          <p className="text-xs text-slate-500 mt-1">Browse and search call transcripts, summaries, and action items.</p>
        </div>
        
        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search transcripts, summaries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 md:w-64 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
          <button type="submit" className="glow-btn px-4 py-2 rounded-xl text-xs font-semibold text-white">
            Search
          </button>
        </form>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-900/40 p-4 border border-slate-800/80 rounded-2xl">
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mr-2">Filters:</span>
        
        <select
          value={callType}
          onChange={(e) => { setCallType(e.target.value); setPage(1); }}
          className="bg-slate-900 border border-slate-800/80 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
        >
          <option value="">All Call Types</option>
          <option value="Support">Support</option>
          <option value="External">External</option>
          <option value="Internal">Internal</option>
        </select>

        <select
          value={sentiment}
          onChange={(e) => { setSentiment(e.target.value); setPage(1); }}
          className="bg-slate-900 border border-slate-800/80 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
        >
          <option value="">All Sentiments</option>
          <option value="positive">Positive</option>
          <option value="very-positive">Very Positive</option>
          <option value="mixed-positive">Mixed Positive</option>
          <option value="neutral">Neutral</option>
          <option value="mixed-negative">Mixed Negative</option>
          <option value="negative">Negative</option>
          <option value="very-negative">Very Negative</option>
        </select>

        {(callType || sentiment || search) && (
          <button
            onClick={() => { setSearch(""); setCallType(""); setSentiment(""); setPage(1); }}
            className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Meeting Cards Grid */}
      {loading ? (
        <div className="flex-1 flex justify-center items-center py-24">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center py-24 text-center">
          <span className="text-3xl">📭</span>
          <h3 className="font-bold text-slate-300 text-sm mt-3">No Meetings Found</h3>
          <p className="text-xs text-slate-500 mt-1">Adjust your filters or query to find matches.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {meetings.map((m) => (
              <div
                key={m.meeting_id}
                onClick={() => handleMeetingClick(m.meeting_id)}
                className="glass-card p-5 cursor-pointer flex flex-col justify-between h-48"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      m.call_type === "Support" ? "text-rose-400 bg-rose-500/10" :
                      m.call_type === "Internal" ? "text-amber-400 bg-amber-500/10" :
                      "text-indigo-400 bg-indigo-500/10"
                    }`}>
                      {m.call_type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${formatSentiment(m.sentiment_score)}`}>
                      {m.overall_sentiment}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-white line-clamp-1 group-hover:text-indigo-400">
                    {m.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {m.summary}
                  </p>
                </div>

                <div className="border-t border-slate-800/60 pt-3 flex justify-between items-center text-[10px] text-slate-500">
                  <span>👤 {m.host.split("@")[0].split(".").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</span>
                  <span>⏳ {m.duration.toFixed(1)}m</span>
                  <span>🗓️ {new Date(m.start_time).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-800">
              <span className="text-xs text-slate-500">
                Showing page {page} of {totalPages} ({total} total meetings)
              </span>
              <div className="flex space-x-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-900 hover:bg-slate-850 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-900 hover:bg-slate-850 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Side Drawer for Meeting Detail */}
      {selectedMeetingId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full max-w-4xl bg-[#090d16] border-l border-slate-800 h-full flex flex-col justify-between shadow-2xl relative">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              {loadingDetail || !detail ? (
                <div className="h-6 w-48 bg-slate-800 animate-pulse rounded"></div>
              ) : (
                <div>
                  <h3 className="font-bold text-base text-white">{detail.meeting.title}</h3>
                  <div className="flex items-center space-x-3 mt-1.5 text-xs text-slate-400">
                    <span className="font-semibold text-indigo-400">📞 {detail.meeting.call_type}</span>
                    <span>•</span>
                    <span>⏳ {detail.meeting.duration.toFixed(1)} mins</span>
                    <span>•</span>
                    <span>🗓️ {new Date(detail.meeting.start_time).toLocaleString()}</span>
                  </div>
                </div>
              )}
              <button
                onClick={() => { setSelectedMeetingId(null); setDetail(null); }}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center hover:bg-slate-800 transition-all text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDetail || !detail ? (
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
                      {detail.meeting.summary}
                    </div>
                    {detail.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {detail.topics.map(t => (
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
                        {detail.action_items.length === 0 ? (
                          <p className="text-slate-500 text-[11px]">No action items defined.</p>
                        ) : (
                          detail.action_items.map(ai => (
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
                        {detail.key_moments.length === 0 ? (
                          <p className="text-slate-500 text-[11px]">No highlights extracted.</p>
                        ) : (
                          detail.key_moments.map((km, idx) => (
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
                    <div className="space-y-3 bg-slate-950/40 border border-slate-850 p-4 rounded-2xl max-h-[400px] overflow-y-auto">
                      {detail.transcript.map((turn) => {
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

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-800 bg-[#090d16] flex justify-end shrink-0">
              <button
                onClick={() => { setSelectedMeetingId(null); setDetail(null); }}
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
