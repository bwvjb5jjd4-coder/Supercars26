"""Minimal GLB reader for the VE Commodore pack (no textures; POSITION/NORMAL/indices)."""
import json, struct
import numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def load(path, use_rotation=False):
    with open(path, 'rb') as f:
        magic, ver, length = struct.unpack('<III', f.read(12))
        assert magic == 0x46546C67, 'not a GLB'
        l, t = struct.unpack('<II', f.read(8))
        j = json.loads(f.read(l))
        l2, t2 = struct.unpack('<II', f.read(8))
        bin_ = f.read(l2)
    def acc(i):
        a = j['accessors'][i]
        bv = j['bufferViews'][a['bufferView']]
        n = NC[a['type']]
        dt = np.dtype(CT[a['componentType']])
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = bv.get('byteStride', 0)
        if stride and stride != dt.itemsize * n:
            raw = np.frombuffer(bin_, np.uint8, count=stride * a['count'], offset=off).reshape(a['count'], stride)
            arr = raw[:, :dt.itemsize * n].copy().view(dt).reshape(a['count'], n)
        else:
            arr = np.frombuffer(bin_, dt, count=a['count'] * n, offset=off).reshape(a['count'], n)
        return arr if n > 1 else arr.ravel()
    cars = []
    for node in j['nodes']:
        m = j['meshes'][node['mesh']]
        q = node.get('rotation', [0, 0, 0, 1]) if use_rotation else [0, 0, 0, 1]
        # The pack's nodes carry a stray 0.75 deg pitch; the raw meshes sit level on y=0.
        x, y, z, w = q
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        prims = []
        for p in m['primitives']:
            mat = j['materials'][p['material']]
            name = mat['name'].split('.')[0]
            pos = acc(p['attributes']['POSITION']).astype(np.float64) @ R.T
            nor = acc(p['attributes']['NORMAL']).astype(np.float64) @ R.T
            idx = acc(p['indices']).astype(np.int64).reshape(-1, 3)
            col = mat.get('pbrMetallicRoughness', {}).get('baseColorFactor', [1, 1, 1, 1])
            prims.append({'mat': name, 'pos': pos, 'nor': nor, 'idx': idx, 'color': col, 'raw': mat})
        cars.append({'name': node['name'], 'prims': prims})
    return cars
