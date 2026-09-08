import sqlite3, re, os, json, datetime

DB = r'D:\School\PROJECT\anakot-agent-home\state.db'
con = sqlite3.connect(f'file:{DB}?mode=ro&timeout=60', uri=True)
cur = con.cursor()

cur.execute("""
  SELECT id, title, message_count, started_at FROM sessions
  WHERE message_count >= 1 AND (archived IS NULL OR archived = 0)
  ORDER BY started_at DESC LIMIT 30
""")
sessions = cur.fetchall()
print('SESSIONS SCANNED:', len(sessions))

image_exts = {'.png','.jpg','.jpeg','.gif','.webp','.bmp','.svg','.tiff','.ico'}
audio_exts = {'.mp3','.wav','.ogg','.m4a','.flac','.aac'}
doc_exts = {'.pdf','.doc','.docx','.txt','.md','.csv','.xlsx','.json','.yaml','.yml','.py','.ts','.js','.html','.css','.pptx','.zip','.log'}
video_exts = {'.mp4','.mov','.webm','.mkv','.avi'}

def ext_of(p):
    _, e = os.path.splitext(p)
    return e.lower()

def classify(value):
    v = value.strip().strip('"\'`')
    if not v:
        return None
    if v.startswith('data:image/'):
        return ('image', v)
    e = ext_of(v)
    if e in image_exts:
        return ('image', v)
    if e in audio_exts or e in doc_exts or e in video_exts:
        return ('file', v)
    if v.startswith('http://') or v.startswith('https://'):
        return ('link', v)
    if re.match(r'^[A-Za-z]:\\', v) or v.startswith('\\\\') or v.startswith('/'):
        if e in image_exts:
            return ('image', v)
        return ('file', v)
    return None

md_re = re.compile(r'!?\[[^\]]*\]\((https?://\S+|\/[^)\s]+|data:image/[a-zA-Z0-9/+]+;base64,[^)\s]+)\)')
path_like_re = re.compile(r'(?:[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*|\/(?:[^\\/:*?"<>|\r\n]+\/)*[^\\/:*?"<>|\r\n]*)|(?:\\[^\\/:*?"<>|\r\n]+\\[^\\/:*?"<>|\r\n]+)')
link_re = re.compile(r'https?://[^\s\'"<>()]+')

def walk_json(o, seen):
    if isinstance(o, str):
        seen.append(o)
    elif isinstance(o, dict):
        for k, v in o.items():
            if k in ('name', 'type', 'id'):
                continue
            walk_json(v, seen)
    elif isinstance(o, list):
        for v in o:
            walk_json(v, seen)

results = []
for sid, title, mcount, started in sessions:
    cur.execute(
        "SELECT role, content, tool_calls FROM messages "
        "WHERE session_id=? AND role IN ('assistant','tool') AND active=1 "
        "AND (content LIKE '%:%' OR content LIKE '%http%' OR content LIKE '%data:image%' "
        "     OR tool_calls LIKE '%:%' OR tool_calls LIKE '%http%')",
        (sid,))
    for role, content, tool_calls in cur.fetchall():
        texts = []
        if content:
            texts.append(content)
        if tool_calls:
            try:
                tc = json.loads(tool_calls)
                seen = []
                walk_json(tc, seen)
                texts.extend(seen)
            except Exception:
                pass
        for t in texts:
            if not t:
                continue
            for m in md_re.finditer(t):
                c = classify(m.group(1))
                if c:
                    results.append((sid, title, role, c[0], m.group(1)))
            for m in path_like_re.finditer(t):
                c = classify(m.group(0))
                if c:
                    results.append((sid, title, role, c[0], m.group(0)))
            for m in link_re.finditer(t):
                c = classify(m.group(0))
                if c:
                    results.append((sid, title, role, c[0], m.group(0)))

seen = set()
uniq = []
for r in results:
    key = (r[0], r[4].strip())
    if key in seen:
        continue
    seen.add(key)
    uniq.append(r)

# map session -> started_at for sorting old-first
smap = {s[0]: s[3] for s in sessions}
uniq.sort(key=lambda r: smap.get(r[0], 0))

print('TOTAL ARTIFACTS FOUND:', len(uniq))
print()
for i, (sid, title, role, kind, val) in enumerate(uniq):
    st = smap.get(sid)
    dstr = datetime.datetime.fromtimestamp(st).strftime('%Y-%m-%d') if st else '?'
    print(f'{i+1:3}. [{kind:5}] {dstr}  session="{title}"')
    print(f'      id={sid}  role={role}')
    print(f'      {val[:140]}')
con.close()
