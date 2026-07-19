#!/usr/bin/env python3
"""Check Railway state: profile dirs, state.db files, and root state.db sessions."""
import os
import sqlite3
import json

VOLUME = "/data"
PROFILES_DIR = os.path.join(VOLUME, "profiles")
ROOT_DB = os.path.join(VOLUME, "state.db")
UP_JSON = os.path.join(VOLUME, "user-profiles.json")

print("=== VOLUME MOUNT ===")
print(f"Volume exists: {os.path.isdir(VOLUME)}")
print(f"Root state.db: {os.path.isfile(ROOT_DB)} ({os.path.getsize(ROOT_DB)} bytes)" if os.path.isfile(ROOT_DB) else "Root state.db: NOT FOUND")
print(f"user-profiles.json: {os.path.isfile(UP_JSON)}")

if os.path.isfile(UP_JSON):
    with open(UP_JSON) as f:
        profiles = json.load(f)
    print(f"\n=== USER-PROFILES ({len(profiles)} entries) ===")
else:
    profiles = {}

print(f"\n=== PROFILES ON DISK ({PROFILES_DIR}) ===")
if os.path.isdir(PROFILES_DIR):
    dirs = sorted(os.listdir(PROFILES_DIR))
    for d in dirs:
        sdb = os.path.join(PROFILES_DIR, d, "state.db")
        sz = os.path.getsize(sdb) if os.path.isfile(sdb) else "---"
        print(f"  {d:25s}  state.db: {'YES' if os.path.isfile(sdb) else 'NO '}  ({sz})")
else:
    print(f"  PROFILES_DIR not found!")

# Check root state.db for users/sessions
if os.path.isfile(ROOT_DB):
    try:
        conn = sqlite3.connect(ROOT_DB)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # List tables
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r["name"] for r in cur.fetchall()]
        print(f"\n=== ROOT DB TABLES: {tables} ===")
        
        if "sessions" in tables:
            cur.execute("SELECT id, title, user_id, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT 20")
            rows = cur.fetchall()
            print(f"\n=== SESSIONS IN ROOT DB ({len(rows)} shown) ===")
            for r in rows:
                d = dict(r)
                print(f"  id={d['id']:>4}  user_id={d.get('user_id','?')!s:>25}  title={d.get('title','?')!s:>30}  updated={d.get('updated_at','?')}")
        conn.close()
    except Exception as e:
        print(f"Error querying root DB: {e}")
else:
    print("\nNo root state.db to query")

# Check a specific profile state.db
TARGET = os.path.join(PROFILES_DIR, "chensihakniroth")
print(f"\n=== chensihakniroth profile dir ===")
print(f"  Exists: {os.path.isdir(TARGET)}")
if os.path.isdir(TARGET):
    print(f"  Contents: {os.listdir(TARGET)}")

# Check niroth (has directory but no state.db previously)
TARGET2 = os.path.join(PROFILES_DIR, "niroth")
print(f"\n=== niroth profile dir ===")
print(f"  Exists: {os.path.isdir(TARGET2)}")
if os.path.isdir(TARGET2):
    print(f"  Contents: {os.listdir(TARGET2)}")
    sdb = os.path.join(TARGET2, "state.db")
    if os.path.isfile(sdb):
        print(f"  state.db: {os.path.getsize(sdb)} bytes")

# Check callmemo099 sessions
TARGET3 = os.path.join(PROFILES_DIR, "callmemo099", "state.db")
if os.path.isfile(TARGET3):
    try:
        conn = sqlite3.connect(TARGET3)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r["name"] for r in cur.fetchall()]
        print(f"\n=== callmemo099 DB TABLES: {tables} ===")
        if "sessions" in tables:
            cur.execute("SELECT COUNT(*) as c FROM sessions")
            count = cur.fetchone()["c"]
            print(f"  Session count: {count}")
            cur.execute("SELECT id, title, user_id, created_at FROM sessions ORDER BY updated_at DESC LIMIT 10")
            for r in cur.fetchall():
                d = dict(r)
                print(f"  id={d['id']:>4}  user_id={d.get('user_id','?')!s:>25}  title={d.get('title','?')!s:>30}")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

print("\n=== DONE ===")
