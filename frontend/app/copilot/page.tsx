"use client";

import { useState } from "react";

interface Source {
  meeting_id: string;
  title: string;
}

interface Message {
  role: "user" | "copilot";
  content: string;
  sources?: Source[];
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "copilot",
      content: "Hello! I am your Antigravity Conversation Intelligence Copilot. Ask me anything about your customer feedback, churn risks, recurring bugs, competitor threats, or renewal discussions."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const suggestions = [
    "What are the top customer complaints?",
    "Which customers might churn?",
    "Which competitor appears most often?",
    "Summarize the Summit Trust billing discrepancy."
  ];

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text })
      });
      if (!res.ok) throw new Error("Failed to execute query");
      
      const data = await res.json();
      
      const copilotMessage: Message = {
        role: "copilot",
        content: data.answer,
        sources: data.sources
      };
      
      setMessages(prev => [...prev, copilotMessage]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: "copilot",
          content: "Sorry, I had trouble communicating with the database. Ensure the FastAPI backend server is running."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  return (
    <div className="space-y-6 relative h-[600px] flex flex-col justify-between">
      {/* Title */}
      <div className="shrink-0">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <span>✨</span>
          <span>Conversational AI Copilot</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Perform semantic retrieval over transcripts to synthesize insights and locate sources.
        </p>
      </div>

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto border border-slate-800/80 bg-[#070b12] rounded-2xl p-6 space-y-4 min-h-0">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div className="text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">
              {m.role === "user" ? "You" : "AI Copilot"}
            </div>
            
            <div className={`p-4 rounded-2xl text-xs leading-relaxed max-w-2xl text-left ${
              m.role === "user" 
                ? "bg-indigo-600 text-white rounded-tr-none" 
                : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none"
            }`}>
              {/* Render lists and linebreaks cleanly */}
              <p className="whitespace-pre-line">{m.content}</p>
              
              {/* Citations section */}
              {m.sources && m.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <span className="text-[9px] uppercase font-bold text-indigo-400 tracking-wider block mb-1.5">
                    Source Citations:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {m.sources.map(src => (
                      <span
                        key={src.meeting_id}
                        className="px-2.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-950 border border-slate-800 text-slate-400"
                        title={src.title}
                      >
                        📖 {src.title.split(" - ")[0]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start">
            <span className="text-[10px] text-slate-500 font-semibold mb-1 uppercase tracking-wider">AI Copilot</span>
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl rounded-tl-none flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      {messages.length === 1 && (
        <div className="shrink-0 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Try asking:</span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSendMessage(s)}
                className="px-4 py-2 text-xs border border-slate-800 bg-slate-900/60 rounded-xl hover:border-indigo-500/50 hover:bg-indigo-500/5 text-slate-300 hover:text-white transition-all text-left cursor-pointer"
              >
                💡 {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Panel */}
      <form onSubmit={handleFormSubmit} className="shrink-0 flex items-center space-x-3 bg-slate-900/40 p-4 border border-slate-800/80 rounded-2xl">
        <input
          type="text"
          placeholder="Ask a question about transcripts, feature requests, churn threat..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
        />
        <button 
          type="submit" 
          disabled={loading || !input.trim()}
          className="glow-btn px-6 py-3 rounded-xl text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
        >
          Ask Copilot
        </button>
      </form>
    </div>
  );
}
