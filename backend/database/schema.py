import os
import duckdb

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "conversight.db")

def init_db(db_path=DB_PATH):
    # Ensure data directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    conn = duckdb.connect(db_path)
    
    # Enable FTS extension (Full Text Search) for search capability
    try:
        conn.execute("INSTALL fts; LOAD fts;")
    except Exception as e:
        print(f"Warning: Could not install/load FTS extension: {e}")
        
    # Create tables
    conn.execute("""
    CREATE TABLE IF NOT EXISTS meetings (
        meeting_id VARCHAR PRIMARY KEY,
        title VARCHAR,
        organizer_email VARCHAR,
        host VARCHAR,
        start_time TIMESTAMP,
        end_time TIMESTAMP,
        duration DOUBLE,
        summary VARCHAR,
        overall_sentiment VARCHAR,
        sentiment_score DOUBLE,
        call_type VARCHAR
    );
    """)
    
    conn.execute("""
    CREATE TABLE IF NOT EXISTS transcript_segments (
        id VARCHAR PRIMARY KEY,
        meeting_id VARCHAR,
        sentence VARCHAR,
        speaker_name VARCHAR,
        speaker_role VARCHAR,
        sentiment_type VARCHAR,
        time DOUBLE,
        end_time DOUBLE,
        average_confidence DOUBLE,
        turn_index INTEGER
    );
    """)
    
    conn.execute("""
    CREATE TABLE IF NOT EXISTS action_items (
        id VARCHAR PRIMARY KEY,
        meeting_id VARCHAR,
        task VARCHAR,
        owner VARCHAR,
        deadline VARCHAR,
        status VARCHAR
    );
    """)
    
    conn.execute("""
    CREATE TABLE IF NOT EXISTS topics (
        meeting_id VARCHAR,
        topic VARCHAR,
        PRIMARY KEY (meeting_id, topic)
    );
    """)
    
    conn.execute("""
    CREATE TABLE IF NOT EXISTS key_moments (
        id VARCHAR PRIMARY KEY,
        meeting_id VARCHAR,
        time DOUBLE,
        text VARCHAR,
        type VARCHAR,
        speaker VARCHAR
    );
    """)
    
    conn.execute("""
    CREATE TABLE IF NOT EXISTS entities (
        meeting_id VARCHAR,
        entity_name VARCHAR,
        entity_type VARCHAR,
        PRIMARY KEY (meeting_id, entity_name, entity_type)
    );
    """)
    
    conn.execute("""
    CREATE TABLE IF NOT EXISTS graph_nodes (
        id VARCHAR PRIMARY KEY,
        label VARCHAR,
        type VARCHAR
    );
    """)
    
    conn.execute("""
    CREATE TABLE IF NOT EXISTS graph_edges (
        source VARCHAR,
        target VARCHAR,
        relation VARCHAR,
        PRIMARY KEY (source, target, relation)
    );
    """)
    
    conn.close()
    print("Database initialized successfully at", db_path)

if __name__ == "__main__":
    init_db()
