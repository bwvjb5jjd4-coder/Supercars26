"""Centreline of the Sydney Olympic Park (Homebush) street circuit, 2009-2016 layout.
Traced from the Wikipedia track map (Homebush Street Circuit (Sydney, Australia) track map.svg,
data of 14 July 2009) that Riley supplied: corner vertices are map pixels on that 500x345 image,
fillet radii are metres. The world keeps the map's orientation (x right, z down the map),
which is about 13 degrees off true north. Anticlockwise: Australia Avenue northbound (pit
straight, start line at the chequered flag), T1 Coates Hire Corner into Kevin Coombs Avenue,
the T2-3-4 XXXX Gold Chicane at Olympic Boulevard, the sweep onto Edwin Flack Avenue,
T5 King Gee Sweep, the T6-7 Dick Smith / L&H jog, T8 Fuso Trucks Corner onto Dawn Fraser
Avenue, T9 Big Pond and T10 onto Murray Rose Avenue, T11 Sydney Corner and T12 Armor All
past the station, T13 Telstra Corner back onto Australia Avenue.
Prints JSON {length, count, points, map, px}; px converts map pixels to metres."""
import json, math
LENGTH = 3420.0
V = [  # (map x, map y, radius m, name)
 (391.5, 277.5, 18, 'T13'),
 (390.0, 194.0, 70, 'kink'),
 (382.5, 168.0, 70, 'kink2'),
 (379.0, 55.5, 16, 'T1'),
 (215.0, 55.5, 10, 'T2'),
 (205.0, 61.0, 10, 'T3'),
 (190.0, 61.0, 12, 'T4'),
 (169.0, 60.5, 45, 'sweep'),
 (87.5, 139.0, 30, 'T5'),
 (87.0, 176.0, 12, 'T6'),
 (79.5, 189.0, 12, 'T7'),
 (79.0, 280.0, 34, 'T8'),
 (261.0, 280.0, 12, 'T9'),
 (261.5, 256.0, 12, 'T10'),
 (358.5, 256.5, 12, 'T11'),
 (359.0, 277.5, 12, 'T12'),
]
START_Y = 207.0  # chequered flag on Australia Avenue
CX, CY = 235.0, 168.0  # map pixel that becomes the world origin

def build(s):
  P = [((x-CX)*s, (y-CY)*s, r, n) for x, y, r, n in V]
  def norm(v): l = math.hypot(*v); return (v[0]/l, v[1]/l)
  n = len(P); path = []
  for i in range(n):
    p0, p1, p2, r = P[i-1][:2], P[i][:2], P[(i+1)%n][:2], P[i][2]
    d0 = norm((p1[0]-p0[0], p1[1]-p0[1])); d1 = norm((p2[0]-p1[0], p2[1]-p1[1]))
    ang = math.acos(max(-1, min(1, d0[0]*d1[0]+d0[1]*d1[1])))
    t = r*math.tan(ang/2)
    a = (p1[0]-d0[0]*t, p1[1]-d0[1]*t); b = (p1[0]+d1[0]*t, p1[1]+d1[1]*t)
    cross = d0[0]*d1[1]-d0[1]*d1[0]
    nrm = (-d0[1], d0[0]) if cross > 0 else (d0[1], -d0[0])
    c = (a[0]+nrm[0]*r, a[1]+nrm[1]*r)
    a0 = math.atan2(a[1]-c[1], a[0]-c[0]); a1 = math.atan2(b[1]-c[1], b[0]-c[0]); da = a1-a0
    while da > math.pi: da -= 2*math.pi
    while da < -math.pi: da += 2*math.pi
    k = max(2, int(abs(da)*r/3)); path.append([(c[0]+math.cos(a0+da*j/k)*r, c[1]+math.sin(a0+da*j/k)*r) for j in range(k+1)])
  pts = []
  for i, arc in enumerate(path):
    pts.extend(arc); nxt = path[(i+1)%n][0]; e = arc[-1]; l = math.hypot(nxt[0]-e[0], nxt[1]-e[1]); k = max(1, int(l/6))
    pts.extend((e[0]+(nxt[0]-e[0])*j/k, e[1]+(nxt[1]-e[1])*j/k) for j in range(1, k))
  return pts

def length(pts): return sum(math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]) for i in range(len(pts)))
s = 3.3
for _ in range(6): s *= LENGTH/length(build(s))
pts = build(s)
zs = (START_Y-CY)*s
i0 = min(range(len(pts)), key=lambda i: abs(pts[i][1]-zs)+(0 if pts[i][0] > 100*s else 1e5))
pts = pts[i0:]+pts[:i0]
xs = [p[0] for p in pts]; zz = [p[1] for p in pts]
mx, Mx, mz, Mz = min(xs), max(xs), min(zz), max(zz); k = max(Mx-mx, Mz-mz)/.72
mp = [[round(.5+(p[0]-(mx+Mx)/2)/k, 3), round(.5+(p[1]-(mz+Mz)/2)/k, 3)] for p in pts[::14]]
print(json.dumps({'length': round(length(pts), 1), 'count': len(pts), 'px': s, 'points': [[round(x, 2), round(z, 2)] for x, z in pts], 'map': mp}))
