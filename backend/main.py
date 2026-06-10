import os
import json
import duckdb
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import redis

from ingestion.ingest import run_ingestion
from rag.search import rag_query, search_meetings

app = FastAPI(title="ConverSight AI Conversation Intelligence Platform", version="1.0.0")

# CORS middleware config to allow frontend Next.js app to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "conversight.db")

# Redis Cache setup
REDIS_HOST = os.environ.get("REDIS_HOST", None)
redis_client = None

def get_redis_client():
    global redis_client
    if redis_client:
        try:
            redis_client.ping()
            return redis_client
        except Exception:
            redis_client = None
            
    if REDIS_HOST:
        try:
            r = redis.Redis(host=REDIS_HOST, port=6379, db=0, socket_timeout=1.0)
            r.ping()
            redis_client = r
            print("Connected to Redis cache at", REDIS_HOST)
            return redis_client
        except Exception:
            pass
    return None

class StatusResponse(BaseModel):
    status: str
    message: str

class QueryRequest(BaseModel):
    query: str

class ActionItemUpdate(BaseModel):
    status: str

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Server is running"}

@app.post("/api/ingestion/run", response_model=StatusResponse)
def trigger_ingestion():
    try:
        run_ingestion()
        # Flush Redis Cache
        r_client = get_redis_client()
        if r_client:
            try:
                r_client.flushall()
                print("Redis Cache Flushed.")
            except Exception as ce:
                print("Warning: Failed to flush Redis:", ce)
        return {"status": "success", "message": "Ingestion process completed successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/meetings")
def list_meetings(
    search: Optional[str] = None,
    call_type: Optional[str] = None,
    sentiment: Optional[str] = None,
    customer: Optional[str] = None,
    limit: int = 12,
    offset: int = 0
):
    conn = duckdb.connect(DB_PATH)
    
    # Base query
    query = """
        SELECT meeting_id, title, organizer_email, host, start_time, end_time, duration, summary, overall_sentiment, sentiment_score, call_type 
        FROM meetings
        WHERE 1=1
    """
    params = []
    
    if search:
        query += " AND (title ILIKE ? OR summary ILIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    if call_type:
        query += " AND call_type = ?"
        params.append(call_type)
    if sentiment:
        query += " AND overall_sentiment = ?"
        params.append(sentiment)
        
    # Heuristic for customer matching in title
    if customer:
        query += " AND title ILIKE ?"
        params.append(f"%{customer}%")
        
    query += " ORDER BY start_time DESC"
    
    # Get total count before pagination
    count_query = f"SELECT COUNT(*) FROM ({query})"
    total_count = conn.execute(count_query, params).fetchone()[0]
    
    # Apply limit and offset
    query += " LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    rows = conn.execute(query, params).fetchall()
    conn.close()
    
    meetings = []
    for r in rows:
        meetings.append({
            "meeting_id": r[0],
            "title": r[1],
            "organizer_email": r[2],
            "host": r[3],
            "start_time": r[4],
            "end_time": r[5],
            "duration": r[6],
            "summary": r[7],
            "overall_sentiment": r[8],
            "sentiment_score": r[9],
            "call_type": r[10]
        })
        
    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "meetings": meetings
    }

@app.get("/api/meetings/{meeting_id}")
def get_meeting_details(meeting_id: str):
    conn = duckdb.connect(DB_PATH)
    
    # 1. Fetch meeting record
    m = conn.execute("SELECT * FROM meetings WHERE meeting_id = ?", (meeting_id,)).fetchone()
    if not m:
        conn.close()
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    # Get columns of meetings table:
    # meeting_id, title, organizer_email, host, start_time, end_time, duration, summary, overall_sentiment, sentiment_score, call_type
    meeting_data = {
        "meeting_id": m[0],
        "title": m[1],
        "organizer_email": m[2],
        "host": m[3],
        "start_time": m[4],
        "end_time": m[5],
        "duration": m[6],
        "summary": m[7],
        "overall_sentiment": m[8],
        "sentiment_score": m[9],
        "call_type": m[10]
    }
    
    # 2. Fetch transcript segments
    t_rows = conn.execute("""
        SELECT speaker_name, speaker_role, sentence, sentiment_type, time, end_time, average_confidence, turn_index
        FROM transcript_segments
        WHERE meeting_id = ?
        ORDER BY turn_index ASC
    """, (meeting_id,)).fetchall()
    
    transcripts = []
    for t in t_rows:
        transcripts.append({
            "speaker_name": t[0],
            "speaker_role": t[1],
            "sentence": t[2],
            "sentiment_type": t[3],
            "time": t[4],
            "end_time": t[5],
            "average_confidence": t[6],
            "turn_index": t[7]
        })
        
    # 3. Fetch Action Items
    ai_rows = conn.execute("""
        SELECT id, task, owner, deadline, status
        FROM action_items
        WHERE meeting_id = ?
    """, (meeting_id,)).fetchall()
    
    action_items = []
    for ai in ai_rows:
        action_items.append({
            "id": ai[0],
            "task": ai[1],
            "owner": ai[2],
            "deadline": ai[3],
            "status": ai[4]
        })
        
    # 4. Fetch Topics
    top_rows = conn.execute("""
        SELECT topic
        FROM topics
        WHERE meeting_id = ?
    """, (meeting_id,)).fetchall()
    topics = [t[0] for t in top_rows]
    
    # 5. Fetch Key Moments
    km_rows = conn.execute("""
        SELECT time, text, type, speaker
        FROM key_moments
        WHERE meeting_id = ?
        ORDER BY time ASC
    """, (meeting_id,)).fetchall()
    
    key_moments = []
    for km in km_rows:
        key_moments.append({
            "time": km[0],
            "text": km[1],
            "type": km[2],
            "speaker": km[3]
        })
        
    # 6. Fetch Entities
    ent_rows = conn.execute("""
        SELECT entity_name, entity_type
        FROM entities
        WHERE meeting_id = ?
    """, (meeting_id,)).fetchall()
    
    entities = []
    for ent in ent_rows:
        entities.append({
            "name": ent[0],
            "type": ent[1]
        })
        
    conn.close()
    
    return {
        "meeting": meeting_data,
        "transcript": transcripts,
        "action_items": action_items,
        "topics": topics,
        "key_moments": key_moments,
        "entities": entities
    }

@app.get("/api/analytics/dashboard")
def get_dashboard_analytics():
    r_client = get_redis_client()
    if r_client:
        try:
            cached = r_client.get("conversight:dashboard")
            if cached:
                return json.loads(cached)
        except Exception as e:
            print("Warning: Redis read failed:", e)

    conn = duckdb.connect(DB_PATH)
    
    # 1. Total KPI metrics
    kpis = conn.execute("""
        SELECT 
            COUNT(*) as total_meetings,
            ROUND(AVG(sentiment_score), 2) as avg_sentiment,
            ROUND(SUM(duration)/60.0, 1) as total_hours
        FROM meetings
    """).fetchone()
    
    # 2. Call Type Breakdown
    call_types = conn.execute("""
        SELECT call_type, COUNT(*) as count
        FROM meetings
        GROUP BY call_type
    """).fetchall()
    call_type_breakdown = {ct: count for ct, count in call_types}
    
    # 3. Sentiment Distribution
    sentiments = conn.execute("""
        SELECT overall_sentiment, COUNT(*) as count
        FROM meetings
        GROUP BY overall_sentiment
    """).fetchall()
    sentiment_breakdown = {s: count for s, count in sentiments}
    
    # 4. Customer Churn Risk Scores
    # We analyze risk for customers mentioned in the title
    meetings_rows = conn.execute("SELECT meeting_id, title, overall_sentiment, sentiment_score, call_type FROM meetings").fetchall()
    
    # Map meetings to customer names
    customer_meetings = {}
    from ingestion.ingest import KNOWN_CUSTOMERS, extract_customer
    
    for row in meetings_rows:
        m_id, title, sentiment, score, call_type = row
        # Run customer extraction
        cust = extract_customer(title, [])
        if cust != "Unknown Customer":
            if cust not in customer_meetings:
                customer_meetings[cust] = []
            customer_meetings[cust].append({
                "sentiment_score": score,
                "call_type": call_type
            })
            
    # Calculate risk category per customer
    customer_risk_list = []
    for cust, meetings in customer_meetings.items():
        avg_score = sum(m["sentiment_score"] for m in meetings) / len(meetings)
        support_count = sum(1 for m in meetings if m["call_type"] == "Support")
        total_calls = len(meetings)
        
        # Risk logic
        if avg_score < 2.6 or support_count >= 3:
            risk = "High"
        elif avg_score < 3.4 or support_count >= 1:
            risk = "Medium"
        else:
            risk = "Low"
            
        customer_risk_list.append({
            "customer": cust,
            "risk": risk,
            "avg_sentiment": round(avg_score, 2),
            "support_calls": support_count,
            "total_calls": total_calls
        })
        
    # Sort customer risks (High first, then Medium, then Low)
    risk_order = {"High": 0, "Medium": 1, "Low": 2}
    customer_risk_list = sorted(customer_risk_list, key=lambda x: (risk_order[x["risk"]], x["avg_sentiment"]))
    
    # 5. Product Risk Heatmap
    # Group issues by product and count them
    # Let us scan the topics matching product bugs or complaints
    product_issues = conn.execute("""
        SELECT topic, COUNT(*) as count
        FROM topics
        WHERE topic LIKE '%error%' OR topic LIKE '%failure%' OR topic LIKE '%outage%' OR topic LIKE '%bug%' OR topic LIKE '%latency%' OR topic LIKE '%delay%' OR topic LIKE '%dispute%'
        GROUP BY topic
        ORDER BY count DESC
        LIMIT 10
    """).fetchall()
    
    # Feature requests prioritization
    feature_requests = conn.execute("""
        SELECT topic, COUNT(*) as count
        FROM topics
        WHERE topic LIKE '%request%' OR topic LIKE '%integration%' OR topic LIKE '%template%' OR topic LIKE '%upgrade%' OR topic LIKE '%automation%'
        GROUP BY topic
        ORDER BY count DESC
        LIMIT 10
    """).fetchall()
    
    # 6. Sentiment Timeline (grouped by week/date)
    # Since duckdb date functions vary, we can fetch start times and format in python
    timeline_rows = conn.execute("SELECT CAST(start_time AS DATE) as m_date, AVG(sentiment_score) as avg_score, COUNT(*) as count FROM meetings GROUP BY m_date ORDER BY m_date").fetchall()
    timeline = [{"date": str(r[0]), "sentiment": round(r[1], 2), "count": r[2]} for r in timeline_rows]
    
    conn.close()
    
    dashboard_res = {
        "kpis": {
            "total_meetings": kpis[0],
            "average_sentiment": kpis[1],
            "total_hours": kpis[2]
        },
        "call_type_breakdown": call_type_breakdown,
        "sentiment_breakdown": sentiment_breakdown,
        "customer_risk": customer_risk_list[:12],
        "product_risk": [{"issue": r[0], "volume": r[1]} for r in product_issues],
        "feature_requests": [{"feature": r[0], "volume": r[1]} for r in feature_requests],
        "sentiment_timeline": timeline[-30:] # return last 30 active days
    }
    
    r_client = get_redis_client()
    if r_client:
        try:
            r_client.setex("conversight:dashboard", 300, json.dumps(dashboard_res))
        except Exception as e:
            print("Warning: Redis write failed:", e)
            
    return dashboard_res

@app.get("/api/analytics/competitors")
def get_competitor_analytics():
    conn = duckdb.connect(DB_PATH)
    
    # Count of mentions in entities
    mentions = conn.execute("""
        SELECT entity_name, COUNT(*) as count
        FROM entities
        WHERE entity_type = 'Competitor'
        GROUP BY entity_name
        ORDER BY count DESC
    """).fetchall()
    
    # Detailed list of competitor mentions in meetings
    mentions_details = []
    for comp_row in mentions:
        comp_name = comp_row[0]
        count = comp_row[1]
        
        # Get meetings where competitor is mentioned
        meetings = conn.execute("""
            SELECT m.meeting_id, m.title, m.overall_sentiment, m.sentiment_score, m.call_type, m.start_time
            FROM entities e
            JOIN meetings m ON e.meeting_id = m.meeting_id
            WHERE e.entity_name = ? AND e.entity_type = 'Competitor'
            ORDER BY m.start_time DESC
        """, (comp_name,)).fetchall()
        
        m_list = []
        for m in meetings:
            m_list.append({
                "meeting_id": m[0],
                "title": m[1],
                "sentiment": m[2],
                "sentiment_score": m[3],
                "call_type": m[4],
                "start_time": m[5]
            })
            
        mentions_details.append({
            "competitor": comp_name,
            "mentions": count,
            "meetings": m_list
        })
        
    conn.close()
    return mentions_details

@app.get("/api/analytics/action-items")
def get_action_items(status: Optional[str] = None):
    conn = duckdb.connect(DB_PATH)
    query = """
        SELECT a.id, a.meeting_id, m.title, a.task, a.owner, a.deadline, a.status
        FROM action_items a
        JOIN meetings m ON a.meeting_id = m.meeting_id
    """
    params = []
    if status:
        query += " WHERE a.status = ?"
        params.append(status)
        
    query += " ORDER BY m.start_time DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    
    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "meeting_id": r[1],
            "meeting_title": r[2],
            "task": r[3],
            "owner": r[4],
            "deadline": r[5],
            "status": r[6]
        })
    return items

@app.put("/api/action-items/{item_id}", response_model=StatusResponse)
def update_action_item_status(item_id: str, payload: ActionItemUpdate):
    if payload.status not in ["Open", "Closed", "Blocked"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be Open, Closed, or Blocked")
        
    conn = duckdb.connect(DB_PATH)
    # Verify existence
    exists = conn.execute("SELECT 1 FROM action_items WHERE id = ?", (item_id,)).fetchone()
    if not exists:
        conn.close()
        raise HTTPException(status_code=404, detail="Action item not found")
        
    conn.execute("UPDATE action_items SET status = ? WHERE id = ?", (payload.status, item_id))
    conn.close()
    return {"status": "success", "message": f"Action item updated to {payload.status}"}

@app.post("/api/rag/query")
def execute_rag(payload: QueryRequest):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    cache_key = f"conversight:rag:{payload.query.strip()}"
    r_client = get_redis_client()
    if r_client:
        try:
            cached = r_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            print("Warning: Redis read failed:", e)

    try:
        result = rag_query(payload.query)
        r_client = get_redis_client()
        if r_client:
            try:
                r_client.setex(cache_key, 3600, json.dumps(result))
            except Exception as e:
                print("Warning: Redis write failed:", e)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/graph")
def get_knowledge_graph(search: Optional[str] = None):
    conn = duckdb.connect(DB_PATH)
    
    # 1. Fetch nodes
    if search:
        # Get matching node and its neighbors
        node_rows = conn.execute("SELECT id, label, type FROM graph_nodes WHERE label ILIKE ?", (f"%{search}%",)).fetchall()
        node_ids = [n[0] for n in node_rows]
        
        if not node_ids:
            conn.close()
            return {"nodes": [], "edges": []}
            
        # Get edges connected to these nodes (1-degree neighborhood)
        edge_rows = conn.execute("""
            SELECT source, target, relation 
            FROM graph_edges 
            WHERE source IN ({seq}) OR target IN ({seq})
        """.format(seq=",".join(["?"] * len(node_ids))), node_ids + node_ids).fetchall()
        
        # Collect neighbor IDs
        neighbor_ids = set(node_ids)
        for e in edge_rows:
            neighbor_ids.add(e[0])
            neighbor_ids.add(e[1])
            
        # Fetch all neighbor nodes
        all_nodes_rows = conn.execute("""
            SELECT id, label, type 
            FROM graph_nodes 
            WHERE id IN ({seq})
        """.format(seq=",".join(["?"] * len(neighbor_ids))), list(neighbor_ids)).fetchall()
        
    else:
        # Default: return a density-controlled subset of nodes (e.g. limit to 80 nodes to ensure smooth rendering)
        # We prioritize Meetings, Products, and Competitors, and some Speakers/Topics
        all_nodes_rows = conn.execute("""
            SELECT id, label, type FROM graph_nodes 
            ORDER BY CASE type WHEN 'Product' THEN 0 WHEN 'Competitor' THEN 1 WHEN 'Meeting' THEN 2 WHEN 'Customer' THEN 3 ELSE 4 END ASC
            LIMIT 120
        """).fetchall()
        
        node_ids = [n[0] for n in all_nodes_rows]
        
        # Get edges between these nodes
        edge_rows = conn.execute("""
            SELECT source, target, relation 
            FROM graph_edges 
            WHERE source IN ({seq}) AND target IN ({seq})
        """.format(seq=",".join(["?"] * len(node_ids))), node_ids + node_ids).fetchall()
        
    conn.close()
    
    nodes = [{"id": n[0], "label": n[1], "type": n[2]} for n in all_nodes_rows]
    edges = [{"source": e[0], "target": e[1], "relation": e[2]} for e in edge_rows]
    
    return {
        "nodes": nodes,
        "edges": edges
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
