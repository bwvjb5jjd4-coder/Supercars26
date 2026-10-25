import re, sys, os, json, hashlib, base64
src, out = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()
EXT = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg','font/ttf':'ttf','font/woff2':'woff2','font/woff':'woff'}
seen = {}
def write(rel, data):
    p = os.path.join(out, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'wb').write(data)
def slug(t): return re.sub(r'[^a-z0-9]+','-',t.lower()).strip('-')[:40]

# 1. liveries JSON -> separate binary files
i = s.find('<script id="rf41-liveries" type="application/json">'); i2 = s.index('>', i)+1; j = s.index('</script>', i2)
liv = json.loads(s[i2:j]); newliv = {}
for k, row in liv.items():
    r = {}
    for f, ext in (('dds','dds.gz.bin'),('webp','webp')):
        rel = f'assets/liveries/{k}.{ext}'; write(rel, base64.b64decode(row[f])); r[f] = rel
    extra = set(row) - {'dds','webp'}
    assert not extra, extra
    newliv[k] = r
s = s[:i2] + json.dumps(newliv, separators=(',',':')) + s[j:]

# 2. 3D asset pack -> binary file
i = s.find('<script id="dc35-asset-pack" type="application/octet-stream">'); i2 = s.index('>', i)+1; j = s.index('</script>', i2)
write('assets/models.json.gz.bin', base64.b64decode(s[i2:j].strip()))
s = s[:i] + s[j+len('</script>'):].lstrip('\n')

# 3. every remaining data: URI -> file
def rep(m):
    mime, b64 = m.group(1), m.group(2)
    data = base64.b64decode(b64); h = hashlib.sha1(data).hexdigest()[:10]
    if h not in seen:
        ctx = s[max(0, m.start()-400):m.start()]
        names = re.findall(r'"(?:file|name)":"([^"]+)"', ctx)
        base = slug(os.path.splitext(names[-1])[0]) if names else ''
        folder = 'fonts' if mime.startswith('font/') else 'img'
        rel = f'assets/{folder}/{base+"-" if base else ""}{h}.{EXT[mime]}'
        write(rel, data); seen[h] = rel
    return seen[h]
s = re.sub(r'data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)', rep, s)

# 4. loader patches (fetch the split files instead of decoding inline base64)
old_models = "const bytes=Uint8Array.from(atob(document.getElementById('dc35-asset-pack').textContent.trim()),c=>c.charCodeAt(0));const stream=new Blob([bytes]).stream()"
new_models = "const res=await fetch('assets/models.json.gz.bin');if(!res.ok)throw Error('3D asset pack failed to load ('+res.status+')');const stream=new Blob([await res.arrayBuffer()]).stream()"
assert s.count(old_models) == 1; s = s.replace(old_models, new_models)
old_loop = " for(const [key,row]of Object.entries(data)){\n  let tex;\n  if(compressed){\n   const buf=Uint8Array.from(atob(row.dds),c=>c.charCodeAt(0));"
new_loop = (" const files=new Map(Object.entries(data).map(([key,row])=>[key,fetch(compressed?row.dds:row.webp).then(r=>{if(!r.ok)throw Error('Livery '+key+' failed to load ('+r.status+')');return r.arrayBuffer()})]));\n"
            " for(const [key,row]of Object.entries(data)){\n  let tex;\n  if(compressed){\n   const buf=new Uint8Array(await files.get(key));")
assert s.count(old_loop) == 1; s = s.replace(old_loop, new_loop)
old_webp = "new Blob([Uint8Array.from(atob(row.webp),c=>c.charCodeAt(0))],{type:'image/webp'})"
new_webp = "new Blob([await files.get(key)],{type:'image/webp'})"
assert s.count(old_webp) == 1; s = s.replace(old_webp, new_webp)
assert 'base64,' not in s
write('index.html', s.encode('utf-8'))
print('index.html', len(s.encode()), 'files', len(seen), 'liveries', len(liv))
