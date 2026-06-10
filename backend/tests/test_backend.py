import os
import pytest
import duckdb
from fastapi.testclient import TestClient

from main import app, DB_PATH
from database.schema import init_db
from ingestion.ingest import run_ingestion
from rag.search import search_meetings, rag_query

client = TestClient(app)

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "Server is running"}

def test_database_and_ingestion():
    # Verify DB file exists
    assert os.path.exists(DB_PATH)
    
    conn = duckdb.connect(DB_PATH)
    
    # Assert tables are created and populated
    meetings_count = conn.execute("SELECT COUNT(*) FROM meetings").fetchone()[0]
    assert meetings_count > 0, "No meetings found in DB. Ingestion failed!"
    
    segments_count = conn.execute("SELECT COUNT(*) FROM transcript_segments").fetchone()[0]
    assert segments_count > 0, "No transcripts found in DB."
    
    action_items_count = conn.execute("SELECT COUNT(*) FROM action_items").fetchone()[0]
    assert action_items_count > 0, "No action items found in DB."
    
    graph_nodes_count = conn.execute("SELECT COUNT(*) FROM graph_nodes").fetchone()[0]
    assert graph_nodes_count > 0, "No graph nodes found in DB."
    
    conn.close()

def test_search():
    res = search_meetings("billing")
    assert "meetings" in res
    assert len(res["meetings"]) > 0
    assert any("billing" in m["title"].lower() or "billing" in m["summary"].lower() for m in res["meetings"])

def test_rag():
    res = rag_query("Who is Gregory Fisk and what is his issue?")
    assert "answer" in res
    assert len(res["answer"]) > 50
    assert "gregory" in res["answer"].lower()
    assert "discrepancy" in res["answer"].lower() or "billing" in res["answer"].lower()

def test_meetings_endpoint():
    response = client.get("/api/meetings?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "meetings" in data
    assert len(data["meetings"]) <= 5

def test_meeting_detail_endpoint():
    # Get first meeting ID
    response = client.get("/api/meetings?limit=1")
    assert response.status_code == 200
    meetings = response.json()["meetings"]
    assert len(meetings) > 0
    
    m_id = meetings[0]["meeting_id"]
    detail_response = client.get(f"/api/meetings/{m_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert "meeting" in detail
    assert "transcript" in detail
    assert "action_items" in detail
    assert "topics" in detail
    assert "key_moments" in detail
    assert "entities" in detail
    assert detail["meeting"]["meeting_id"] == m_id

def test_analytics_dashboard_endpoint():
    response = client.get("/api/analytics/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "kpis" in data
    assert "call_type_breakdown" in data
    assert "sentiment_breakdown" in data
    assert "customer_risk" in data
    assert "product_risk" in data
    assert "sentiment_timeline" in data

def test_analytics_competitors_endpoint():
    response = client.get("/api/analytics/competitors")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "competitor" in data[0]
    assert "mentions" in data[0]

def test_action_items_endpoints():
    # Fetch action items
    response = client.get("/api/analytics/action-items")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    
    # Update first action item to 'Closed'
    item_id = data[0]["id"]
    update_response = client.put(f"/api/action-items/{item_id}", json={"status": "Closed"})
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "success"
    
    # Confirm update
    conn = duckdb.connect(DB_PATH)
    status = conn.execute("SELECT status FROM action_items WHERE id = ?", (item_id,)).fetchone()[0]
    conn.close()
    assert status == "Closed"

def test_graph_endpoint():
    response = client.get("/api/graph")
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) > 0

if __name__ == "__main__":
    pytest.main(["-v", __file__])
