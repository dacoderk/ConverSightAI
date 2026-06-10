import os
import json
import re
from datetime import datetime
import duckdb

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "conversight.db")
DATASET_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "interview-assignment", "dataset")

KNOWN_CUSTOMERS = [
    'Steelpoint Manufacturing', 'Vanta Health Systems', 'Crestline Wealth Group', 'Crestline Wealth', 'Coastal Living Co', 
    'Maplewood Goods', 'Helix Data', 'Redwood Clinical', 'Quantum Edge', 'Trailhead Marketplace', 
    'Axiom Labs', 'Keystone Health', 'Northstar Pharma', 'Summit Trust', 'Brightpath Commerce', 
    'Ridgeline Logistics', 'Bridgeport Health', 'Clearwater Medical', 'Blackridge Investments', 
    'Ironworks Corp', 'Harborview Banking', 'Nimbus Platform', 'Cobalt Software', 'Pinnacle Insurance', 
    'Pineridge Systems', 'Silverline Brands', 'Forge Industries', 'Meridian Capital', 'Atlas Precision', 
    'Ironclad Financial', 'Frostbyte AI', 'Stratos Cloud', 'Nova Retail Group'
]

COMPETITORS = ['Okta', 'Duo', 'Ping', 'Entra']
PRODUCTS = ['Aegis Identity', 'Aegis Detect', 'Aegis Comply', 'Aegis Protect', 'Aegis Sentinel', 'Aegis Compliance']

def extract_customer(title, emails):
    # Try title matching
    for cust in KNOWN_CUSTOMERS:
        if cust.lower() in title.lower():
            return cust
    
    # Try email domains
    for email in emails:
        if "@" in email:
            domain = email.split("@")[1].split(".")[0]
            if domain not in ["aegiscloud", "aegis", "gmail", "outlook", "hotmail", "yahoo"]:
                # Capitalize words
                return domain.replace("corp", "Corp").replace("inc", "Inc").title()
                
    return "Unknown Customer"

def parse_date(date_str):
    if not date_str:
        return None
    try:
        # standard ISO format: 2026-02-06T09:15:00.000Z
        return date_str.replace("Z", "+00:00")
    except Exception:
        return date_str

def clean_action_item(item_str):
    # Action items often look like: "Sarah Chen: Submit billing adjustment..."
    # We want to split the owner and the task
    parts = item_str.split(":", 1)
    if len(parts) == 2:
        owner = parts[0].strip()
        task = parts[1].strip()
    else:
        owner = "Unassigned"
        task = item_str.strip()
    
    # Check for potential deadline keywords
    deadline = "N/A"
    deadline_matches = [
        (r"this week", "End of Week"),
        (r"by friday", "Friday"),
        (r"next week", "Next Week"),
        (r"within (\d+)\s*(business\s*)?days", r"In \1 days"),
        (r"before the (\w+)\s*billing", r"Before \1 billing"),
    ]
    for pattern, label in deadline_matches:
        match = re.search(pattern, task, re.IGNORECASE)
        if match:
            if r"\1" in label:
                deadline = label.replace(r"\1", match.group(1))
            else:
                deadline = label
            break
            
    return owner, task, deadline

def run_ingestion(dataset_path=DATASET_PATH, db_path=DB_PATH):
    print(f"Reading dataset from {dataset_path}...")
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset path {dataset_path} does not exist.")
        return
        
    conn = duckdb.connect(db_path)
    
    # Empty existing data to ensure clean load
    conn.execute("DELETE FROM meetings;")
    conn.execute("DELETE FROM transcript_segments;")
    conn.execute("DELETE FROM action_items;")
    conn.execute("DELETE FROM topics;")
    conn.execute("DELETE FROM key_moments;")
    conn.execute("DELETE FROM entities;")
    conn.execute("DELETE FROM graph_nodes;")
    conn.execute("DELETE FROM graph_edges;")
    
    dirs = [d for d in os.listdir(dataset_path) if os.path.isdir(os.path.join(dataset_path, d))]
    processed = 0
    errors = []
    
    # We will accumulate nodes and edges in sets to avoid duplicates
    nodes_to_insert = {} # id -> (label, type)
    edges_to_insert = set() # (source, target, relation)
    
    # Add core system nodes
    for prod in PRODUCTS:
        nodes_to_insert[prod] = (prod, 'Product')
    for comp in COMPETITORS:
        nodes_to_insert[comp] = (comp, 'Competitor')
        
    for d in dirs:
        dir_path = os.path.join(dataset_path, d)
        files = os.listdir(dir_path)
        required = ["summary.json", "meeting-info.json", "speakers.json", "events.json", "speaker-meta.json", "transcript.json"]
        
        # Validation checks
        corrupt = False
        for req in required:
            if req not in files:
                errors.append(f"Missing file {req} in {d}")
                corrupt = True
                break
        if corrupt:
            continue
            
        try:
            # Load JSONs
            with open(os.path.join(dir_path, "meeting-info.json")) as f:
                meeting_info = json.load(f)
            with open(os.path.join(dir_path, "summary.json")) as f:
                summary = json.load(f)
            with open(os.path.join(dir_path, "transcript.json")) as f:
                transcript = json.load(f)
            with open(os.path.join(dir_path, "speakers.json")) as f:
                speakers = json.load(f)
            with open(os.path.join(dir_path, "speaker-meta.json")) as f:
                speaker_meta = json.load(f)
            with open(os.path.join(dir_path, "events.json")) as f:
                events = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(f"JSON Decode Error in {d}: {e}")
            continue
        except Exception as e:
            errors.append(f"Read Error in {d}: {e}")
            continue
            
        meeting_id = meeting_info.get("meetingId")
        title = meeting_info.get("title", "Untitled Meeting")
        
        # Call type detection
        call_type = "External"
        t_lower = title.lower()
        if "support case #" in t_lower or "support case" in t_lower:
            call_type = "Support"
        elif any(k in t_lower for k in ["sprint planning", "all hands", "team sync", "internal", "soc 2", "audit prep", "planning discussion", "wrap"]):
            call_type = "Internal"
        elif not meeting_info.get("invitees") or len(meeting_info.get("invitees")) <= 1:
            call_type = "Internal"
            
        # Determine customer name
        customer = extract_customer(title, meeting_info.get("allEmails", []))
        
        # Insert Meeting
        conn.execute("""
        INSERT INTO meetings (meeting_id, title, organizer_email, host, start_time, end_time, duration, summary, overall_sentiment, sentiment_score, call_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            meeting_id,
            title,
            meeting_info.get("organizerEmail"),
            meeting_info.get("host"),
            parse_date(meeting_info.get("startTime")),
            parse_date(meeting_info.get("endTime")),
            meeting_info.get("duration"),
            summary.get("summary"),
            summary.get("overallSentiment"),
            summary.get("sentimentScore"),
            call_type
        ))
        
        # Graph node for Meeting and Customer
        nodes_to_insert[meeting_id] = (title, 'Meeting')
        if call_type != "Internal" and customer != "Unknown Customer":
            nodes_to_insert[customer] = (customer, 'Customer')
            edges_to_insert.add((meeting_id, customer, 'AFFECTS'))
            
        # Insert Action Items
        for i, ai in enumerate(summary.get("actionItems", [])):
            owner, task, deadline = clean_action_item(ai)
            ai_id = f"{meeting_id}_ai_{i}"
            conn.execute("""
            INSERT INTO action_items (id, meeting_id, task, owner, deadline, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (ai_id, meeting_id, task, owner, deadline, "Open"))
            
            # Action item graph relationships
            nodes_to_insert[ai_id] = (task[:40] + "...", 'ActionItem')
            edges_to_insert.add((meeting_id, ai_id, 'HAS_ACTION_ITEM'))
            if owner != "Unassigned":
                nodes_to_insert[owner] = (owner, 'Speaker')
                edges_to_insert.add((owner, ai_id, 'OWNS'))
                
        # Insert Topics
        for t in summary.get("topics", []):
            conn.execute("""
            INSERT INTO topics (meeting_id, topic)
            VALUES (?, ?)
            ON CONFLICT DO NOTHING
            """, (meeting_id, t))
            
            # Topic graph relationships
            nodes_to_insert[t] = (t, 'Topic')
            edges_to_insert.add((meeting_id, t, 'DISCUSSES_TOPIC'))
            
        # Insert Key Moments
        for i, km in enumerate(summary.get("keyMoments", [])):
            km_id = f"{meeting_id}_km_{i}"
            conn.execute("""
            INSERT INTO key_moments (id, meeting_id, time, text, type, speaker)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (
                km_id,
                meeting_id,
                km.get("time"),
                km.get("text"),
                km.get("type"),
                km.get("speaker")
            ))
            
        # Extract Competitor & Product Mentions from transcript turns
        mentioned_competitors = set()
        mentioned_products = set()
        
        # Insert Transcript turns
        for idx, turn in enumerate(transcript.get("data", [])):
            sentence = turn.get("sentence", "")
            speaker = turn.get("speaker_name", "Unknown")
            
            # Determine speaker role (heuristics)
            role = "Customer"
            s_lower = speaker.lower()
            h_domain = ""
            host_email = meeting_info.get("host", "")
            if "@" in host_email:
                h_domain = host_email.split("@")[1]
            
            # Check if this speaker matches the host email domain or domain of organizer
            speaker_emails = [email for email in meeting_info.get("allEmails", []) if email.split("@")[0].replace(".", " ").lower() in s_lower or s_lower in email.split("@")[0].lower()]
            
            if any(h_domain in email for email in speaker_emails) or any(d in s_lower for d in ["sarah chen", "support agent", "engineer", "account manager"]):
                if call_type == "Support":
                    role = "Support Agent"
                elif call_type == "Internal":
                    role = "Engineer"
                else:
                    role = "Account Manager"
            elif call_type == "Internal":
                role = "Engineer"
                
            turn_id = f"{meeting_id}_t_{idx}"
            
            conn.execute("""
            INSERT INTO transcript_segments (id, meeting_id, sentence, speaker_name, speaker_role, sentiment_type, time, end_time, average_confidence, turn_index)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                turn_id,
                meeting_id,
                sentence,
                speaker,
                role,
                turn.get("sentimentType"),
                turn.get("time"),
                turn.get("endTime"),
                turn.get("averageConfidence"),
                turn.get("index")
            ))
            
            # Graph Speaker
            nodes_to_insert[speaker] = (speaker, 'Speaker')
            edges_to_insert.add((meeting_id, speaker, 'HAS_SPEAKER'))
            
            # Look for Competitors
            s_text = sentence.lower()
            for comp in COMPETITORS:
                if re.search(rf"\b{comp.lower()}\b", s_text):
                    mentioned_competitors.add(comp)
                    edges_to_insert.add((speaker, comp, 'MENTIONS'))
                    
            # Look for Products
            for prod in PRODUCTS:
                prod_short = prod.replace("Aegis ", "").lower()
                if re.search(rf"\b{prod_short}\b", s_text) or re.search(rf"\b{prod.lower()}\b", s_text):
                    mentioned_products.add(prod)
                    edges_to_insert.add((speaker, prod, 'DISCUSSES'))
                    
        # Insert unique entities found
        for comp in mentioned_competitors:
            conn.execute("""
            INSERT INTO entities (meeting_id, entity_name, entity_type)
            VALUES (?, ?, ?)
            ON CONFLICT DO NOTHING
            """, (meeting_id, comp, 'Competitor'))
            edges_to_insert.add((meeting_id, comp, 'MENTIONS_COMPETITOR'))
            
        for prod in mentioned_products:
            conn.execute("""
            INSERT INTO entities (meeting_id, entity_name, entity_type)
            VALUES (?, ?, ?)
            ON CONFLICT DO NOTHING
            """, (meeting_id, prod, 'Product'))
            edges_to_insert.add((meeting_id, prod, 'DISCUSSES_PRODUCT'))
            
        # Connect speakers to topics they discussed
        for t in summary.get("topics", []):
            for speaker in speaker_meta.values():
                edges_to_insert.add((speaker, t, 'DISCUSSES_TOPIC'))
                
        processed += 1
        
    # Batch Insert Graph Nodes & Edges
    print(f"Loading {len(nodes_to_insert)} nodes and {len(edges_to_insert)} edges into DuckDB Graph tables...")
    for nid, (label, ntype) in nodes_to_insert.items():
        conn.execute("""
        INSERT INTO graph_nodes (id, label, type)
        VALUES (?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET label = excluded.label, type = excluded.type
        """, (nid, label, ntype))
        
    for src, tgt, rel in edges_to_insert:
        conn.execute("""
        INSERT INTO graph_edges (source, target, relation)
        VALUES (?, ?, ?)
        ON CONFLICT DO NOTHING
        """, (src, tgt, rel))
        
    conn.close()
    print(f"Ingestion completed! Processed {processed} meetings successfully.")
    if errors:
        print(f"Encountered {len(errors)} validation warnings/errors:")
        for err in errors[:5]:
            print(f"- {err}")
            
if __name__ == "__main__":
    run_ingestion()
