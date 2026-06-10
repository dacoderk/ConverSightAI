"use client";

import { useEffect, useRef, useState } from "react";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  pinned?: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

export default function KnowledgeGraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Transform settings
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const activeNodeRef = useRef<GraphNode | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const alphaRef = useRef(1.0);
  
  const fetchGraphData = async () => {
    try {
      setLoading(true);
      let url = "http://localhost:8000/api/graph";
      if (search.trim()) {
        url += `?search=${encodeURIComponent(search.trim())}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch graph data");
      const json = await res.json();
      
      // Initialize physics positions
      const initializedNodes = json.nodes.map((n: GraphNode) => ({
        ...n,
        x: n.x ?? (Math.random() - 0.5) * 400 + 400,
        y: n.y ?? (Math.random() - 0.5) * 300 + 300,
        vx: 0,
        vy: 0,
        pinned: false
      }));

      setNodes(initializedNodes);
      setEdges(json.edges);
      setSelectedNode(null);
      alphaRef.current = 1.0;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, [search]);

  // Color map for node types
  const getNodeColor = (type: string) => {
    switch (type) {
      case "Product": return "#6366f1"; // Indigo
      case "Competitor": return "#f97316"; // Orange
      case "Meeting": return "#0ea5e9"; // Sky blue
      case "Customer": return "#10b981"; // Emerald
      case "Speaker": return "#94a3b8"; // Slate
      case "Topic": return "#eab308"; // Yellow
      case "ActionItem": return "#f43f5e"; // Rose
      default: return "#ffffff";
    }
  };

  // Run physics and render loop
  useEffect(() => {
    if (loading || nodes.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set high-dpi canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);
    };
    resizeCanvas();

    // Physics parameters
    const repulsionStrength = 1500;
    const attractionStrength = 0.04;
    const friction = 0.85;
    const gravity = 0.05;

    const stepSimulation = () => {
      if (isPaused || alphaRef.current < 0.005) {
        return;
      }

      const w = canvas.width / 2;
      const h = canvas.height / 2;
      const center = { x: w / 2, y: h / 2 };

      // 1. Repulsion between nodes (Coulomb law)
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          
          const dx = n2.x! - n1.x!;
          const dy = n2.y! - n1.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          if (dist < 250) {
            const force = repulsionStrength / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            if (!n1.pinned) {
              n1.vx = n1.vx! - fx;
              n1.vy = n1.vy! - fy;
            }
            if (!n2.pinned) {
              n2.vx = n2.vx! + fx;
              n2.vy = n2.vy! + fy;
            }
          }
        }
      }

      // 2. Attraction along edges (Hooke's law)
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      edges.forEach(edge => {
        const nSource = nodeMap.get(edge.source);
        const nTarget = nodeMap.get(edge.target);
        
        if (nSource && nTarget) {
          const dx = nTarget.x! - nSource.x!;
          const dy = nTarget.y! - nSource.y!;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = attractionStrength * (dist - 100);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          if (!nSource.pinned) {
            nSource.vx = nSource.vx! + fx;
            nSource.vy = nSource.vy! + fy;
          }
          if (!nTarget.pinned) {
            nTarget.vx = nTarget.vx! - fx;
            nTarget.vy = nTarget.vy! - fy;
          }
        }
      });

      // 3. Gravity towards center & update positions
      nodes.forEach(n => {
        // Dragging node or pinned node locks it
        if (n === activeNodeRef.current || n.pinned) {
          n.vx = 0;
          n.vy = 0;
          return;
        }

        const gdx = center.x - n.x!;
        const gdy = center.y - n.y!;
        n.vx = n.vx! + gdx * gravity;
        n.vy = n.vy! + gdy * gravity;

        // Apply friction
        n.vx = n.vx! * friction;
        n.vy = n.vy! * friction;

        n.x = n.x! + n.vx!;
        n.y = n.y! + n.vy!;
      });

      // Apply cooling decay
      alphaRef.current *= 0.96;
    };

    const drawGraph = () => {
      const w = canvas.width / 2;
      const h = canvas.height / 2;
      ctx.clearRect(0, 0, w, h);

      // Save context state and apply transform
      ctx.save();
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.scale, transformRef.current.scale);

      // Draw Edges
      const nodeMap = new Map(nodes.map(n => [n.id, n]));
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      edges.forEach(edge => {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (src && tgt) {
          ctx.beginPath();
          ctx.moveTo(src.x!, src.y!);
          ctx.lineTo(tgt.x!, tgt.y!);
          ctx.stroke();
          
          // Draw relation text in center of edge if selected
          if (selectedNode && (src.id === selectedNode.id || tgt.id === selectedNode.id)) {
            ctx.save();
            ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
            ctx.font = "italic 6px sans-serif";
            ctx.fillText(edge.relation, (src.x! + tgt.x!) / 2, (src.y! + tgt.y!) / 2 - 3);
            ctx.restore();
          }
        }
      });

      // Draw Nodes
      nodes.forEach(n => {
        const color = getNodeColor(n.type);
        const radius = n.type === "Meeting" ? 8 : n.type === "Customer" || n.type === "Product" || n.type === "Competitor" ? 7 : 5;
        
        ctx.beginPath();
        ctx.arc(n.x!, n.y!, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color + "40";
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // Draw node outline if selected
        if (selectedNode && n.id === selectedNode.id) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }

        // Draw an inner white core if node is pinned
        if (n.pinned) {
          ctx.beginPath();
          ctx.arc(n.x!, n.y!, 2.2, 0, 2 * Math.PI);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        }

        // Draw Label Text
        ctx.fillStyle = selectedNode && n.id !== selectedNode.id ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.9)";
        ctx.font = n.type === "Meeting" ? "bold 8px sans-serif" : "6px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(n.label, n.x! + radius + 4, n.y! + 2.5);
      });

      ctx.restore();
    };

    const runLoop = () => {
      stepSimulation();
      drawGraph();
      animationFrameIdRef.current = requestAnimationFrame(runLoop);
    };

    runLoop();

    // Clean up
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [loading, nodes, edges, selectedNode, isPaused]);


  // Convert canvas event coordinate to world coordinates
  const getWorldCoords = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const worldX = (x - transformRef.current.x) / transformRef.current.scale;
    const worldY = (y - transformRef.current.y) / transformRef.current.scale;
    return { x: worldX, y: worldY };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getWorldCoords(e.clientX, e.clientY);
    
    // Find if clicked a node (radius detection)
    let clickedNode: GraphNode | null = null;
    for (const n of nodes) {
      const radius = 15; // margin of error
      const dx = n.x! - coords.x;
      const dy = n.y! - coords.y;
      if (dx * dx + dy * dy < radius * radius) {
        clickedNode = n;
        break;
      }
    }

    if (clickedNode) {
      activeNodeRef.current = clickedNode;
      setSelectedNode(clickedNode);
    } else {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeNodeRef.current) {
      const coords = getWorldCoords(e.clientX, e.clientY);
      activeNodeRef.current.x = coords.x;
      activeNodeRef.current.y = coords.y;
      activeNodeRef.current.vx = 0;
      activeNodeRef.current.vy = 0;
      alphaRef.current = 1.0; // Reheat simulation during dragging
    } else if (isDraggingRef.current) {
      transformRef.current = {
        ...transformRef.current,
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      };
    }
  };

  const handleMouseUp = () => {
    if (activeNodeRef.current) {
      activeNodeRef.current.pinned = true; // Pin node on drag release
      alphaRef.current = 1.0; // Settle neighbors
    }
    activeNodeRef.current = null;
    isDraggingRef.current = false;
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getWorldCoords(e.clientX, e.clientY);
    let clickedNode: GraphNode | null = null;
    for (const n of nodes) {
      const radius = 15;
      const dx = n.x! - coords.x;
      const dy = n.y! - coords.y;
      if (dx * dx + dy * dy < radius * radius) {
        clickedNode = n;
        break;
      }
    }
    if (clickedNode) {
      const nextPinned = !clickedNode.pinned;
      clickedNode.pinned = nextPinned;
      // Sync React state
      setNodes(prev => prev.map(n => n.id === clickedNode!.id ? { ...n, pinned: nextPinned } : n));
      if (selectedNode && selectedNode.id === clickedNode.id) {
        setSelectedNode(prev => prev ? { ...prev, pinned: nextPinned } : null);
      }
      alphaRef.current = 1.0; // Reheat
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const nextScale = e.deltaY < 0 
      ? transformRef.current.scale * scaleFactor 
      : transformRef.current.scale / scaleFactor;
    
    // Constraint zoom range
    transformRef.current.scale = Math.max(0.15, Math.min(nextScale, 4.0));
  };

  const resetZoom = () => {
    transformRef.current = { x: 0, y: 0, scale: 1.0 };
    // Trigger simulation reset positions
    setNodes(prev => prev.map(n => ({
      ...n,
      x: (Math.random() - 0.5) * 400 + 400,
      y: (Math.random() - 0.5) * 300 + 300,
      vx: 0,
      vy: 0,
      pinned: false
    })));
    alphaRef.current = 1.0;
  };

  const unpinAllNodes = () => {
    setNodes(prev => prev.map(n => ({ ...n, pinned: false })));
    if (selectedNode) {
      setSelectedNode(prev => prev ? { ...prev, pinned: false } : null);
    }
    alphaRef.current = 1.0;
  };

  const toggleNodePin = (node: GraphNode) => {
    const nextPinned = !node.pinned;
    setNodes(prev => prev.map(n => n.id === node.id ? { ...n, pinned: nextPinned } : n));
    setSelectedNode(prev => prev && prev.id === node.id ? { ...prev, pinned: nextPinned } : prev);
    alphaRef.current = 1.0;
  };

  return (
    <div className="space-y-6 relative h-full flex flex-col">
      {/* Title & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Knowledge Graph Explorer</h2>
          <p className="text-xs text-slate-500 mt-1">
            Map relationships between meetings, customers, competitors, products, and discussed topics.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Focus node (e.g. Okta, Aegis Identity)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 md:w-64 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
          <button 
            onClick={() => setIsPaused(prev => !prev)}
            className={`px-3 py-2 text-xs font-semibold border rounded-xl transition-all cursor-pointer ${
              isPaused 
                ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30" 
                : "bg-amber-600/20 border-amber-500/30 text-amber-400 hover:bg-amber-600/30"
            }`}
            title={isPaused ? "Resume physics simulation" : "Pause physics simulation"}
          >
            {isPaused ? "▶ Run Physics" : "⏸ Pause Physics"}
          </button>
          <button 
            onClick={unpinAllNodes}
            className="px-3 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            title="Release all pinned nodes"
          >
            📍 Unpin All
          </button>
          <button 
            onClick={resetZoom}
            className="px-3 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            Reset Graph
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 h-[550px]">
        {/* Canvas Explorer Pane */}
        <div className="lg:col-span-3 border border-slate-800/80 bg-[#070b12] rounded-2xl relative overflow-hidden flex flex-col h-full">
          {loading ? (
            <div className="flex-1 flex justify-center items-center">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onDoubleClick={handleDoubleClick}
              onWheel={handleWheel}
              className="flex-1 w-full h-full cursor-grab active:cursor-grabbing block"
            />
          )}

          {/* Graph Legend Overlay */}
          <div className="absolute bottom-4 left-4 bg-slate-950/80 border border-slate-850 p-3.5 rounded-xl flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-slate-400 font-semibold pointer-events-none select-none">
            <div className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#0ea5e9]"></span><span>Meeting</span></div>
            <div className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span><span>Customer</span></div>
            <div className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#6366f1]"></span><span>Product</span></div>
            <div className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f97316]"></span><span>Competitor</span></div>
            <div className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]"></span><span>Speaker</span></div>
            <div className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#eab308]"></span><span>Topic</span></div>
          </div>
          
          <div className="absolute top-4 left-4 text-[9px] text-slate-500 pointer-events-none select-none">
            🖱️ Drag nodes to organize (pins position) • Double-click node to Pin/Unpin • Scroll to Zoom
          </div>

        </div>

        {/* Node Inspector Sidebar */}
        <div className="border border-slate-800/80 bg-slate-900/20 p-5 rounded-2xl flex flex-col justify-between h-full overflow-y-auto">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              Node Inspector
            </h3>
            
            {!selectedNode ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Click any node in the graph to view relationships and extracted details.
              </div>
            ) : (
              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold`} style={{ backgroundColor: getNodeColor(selectedNode.type) + "20", color: getNodeColor(selectedNode.type) }}>
                    {selectedNode.type}
                  </span>
                  <h4 className="font-bold text-base text-white mt-2 leading-tight">
                    {selectedNode.label}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium mt-1">ID: {selectedNode.id}</p>
                  
                  {/* Pin/Unpin control in Inspector */}
                  <button
                    onClick={() => toggleNodePin(selectedNode)}
                    className={`mt-3 w-full py-1.5 px-3 border rounded-xl text-[10px] font-bold transition-all cursor-pointer text-center ${
                      selectedNode.pinned
                        ? "bg-amber-600/10 border-amber-500/20 text-amber-400 hover:bg-amber-600/20"
                        : "bg-indigo-600/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-600/20"
                    }`}
                  >
                    {selectedNode.pinned ? "📍 Pinned (Click to Unpin)" : "📌 Pin Node Position"}
                  </button>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-850">
                  <h5 className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Associated Connections</h5>
                  
                  {/* Find connections dynamically from edges list */}
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {edges
                      .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                      .map((e, idx) => {
                        const targetId = e.source === selectedNode.id ? e.target : e.source;
                        const targetNode = nodes.find(n => n.id === targetId);
                        if (!targetNode) return null;
                        
                        return (
                          <div 
                            key={idx} 
                            onClick={() => setSelectedNode(targetNode)}
                            className="bg-slate-900/60 hover:bg-slate-800/40 p-2.5 border border-slate-850 rounded-xl cursor-pointer text-left transition-all"
                          >
                            <span className="text-[9px] text-indigo-400 font-semibold uppercase">{e.relation}</span>
                            <div className="font-semibold text-slate-200 truncate mt-0.5">{targetNode.label}</div>
                            <span className="text-[8px] text-slate-500">{targetNode.type}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-500 pt-4 border-t border-slate-800">
            Platform mappings include <b>{nodes.length}</b> nodes and <b>{edges.length}</b> linkages.
          </div>
        </div>
      </div>
    </div>
  );
}
