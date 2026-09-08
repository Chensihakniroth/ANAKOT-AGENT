import sqlite3, os

DB = r'D:\School\PROJECT\anakot-agent-home\state.db'
print('EXISTS:', os.path.exists(DB), 'SIZE:', os.path.getsize(DB) if os.path.exists(DB) else 'NA')
wal = DB + '-wal'
shm = DB + '-shm'
print('WAL EXISTS:', os.path.exists(wal), 'SHM EXISTS:', os.path.exists(shm))

con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
cur = con.cursor()
cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name")
rows = cur.fetchall()
for name, sql in rows:
    print('===' + name + '===')
    print(sql)
    print()
print('TOTAL TABLES:', len(rows))
con.close()
