# shared loader for the hybrid build: import TRELLIS glb, orient (toe +x, z up, 29 cm), exterior test
import bpy, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

def load(src):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    o = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = o.data
    n = len(me.vertices); co = np.empty(n * 3, 'f'); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    co[:, 0] *= -1; co[:, 1] *= -1; co *= 29.0
    co[:, 2] -= co[:, 2].min() + 1.0
    me.vertices.foreach_set('co', co.ravel()); me.update()
    img = [i for i in bpy.data.images if i.size[0] > 0][0]; W, H = img.size
    px = np.empty(W * H * 4, 'f'); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)[..., :3].copy()
    P = len(me.polygons)
    ls = np.empty(P, 'i'); me.polygons.foreach_get('loop_start', ls)
    vi = np.empty(len(me.loops), 'i'); me.loops.foreach_get('vertex_index', vi)
    uv = np.empty(len(me.loops) * 2, 'f'); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
    tri = np.stack([vi[ls], vi[ls + 1], vi[ls + 2]], 1)
    cen = co[tri].mean(1)
    nrm = np.cross(co[tri[:, 1]] - co[tri[:, 0]], co[tri[:, 2]] - co[tri[:, 0]])
    nrm /= (np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12)
    uvc = (uv[ls] + uv[ls + 1] + uv[ls + 2]) / 3
    col = px[np.clip((uvc[:, 1] * H).astype(int), 0, H - 1), np.clip((uvc[:, 0] * W).astype(int), 0, W - 1)]
    return dict(o=o, me=me, co=co, tri=tri, cen=cen, nrm=nrm, col=col, px=px, uv=uv, ls=ls, img=img)

def exterior(d):
    bvh = BVHTree.FromPolygons([tuple(v) for v in d['co']], [tuple(t) for t in d['tri']])
    ext = np.zeros(len(d['tri']), bool)
    extra = [Vector(v) for v in ((0, 0, 0), (1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1))]
    for i, (c, n) in enumerate(zip(d['cen'], d['nrm'])):
        nv = Vector(n); start = Vector(c) + nv * 0.03
        for e in extra:
            dv = (nv + e * 0.9).normalized()
            if dv.dot(nv) <= 0.05: continue
            if bvh.ray_cast(start, dv)[0] is None:
                ext[i] = True; break
    return ext, bvh

LUM = np.array([.2126, .7152, .0722])

def feather(d, ext):
    """Top of the midsole per x-slice and side: walk up the side wall from the sole
    through cream (allowing the thin black line) until grey/black/upper starts."""
    cen, nrm = d['cen'], d['nrm']; lum = d['col'] @ LUM
    xs = np.arange(-14.5, 14.51, 0.5); out = {}
    for sgn in (-1, 1):
        zf = np.full(len(xs), np.nan)
        for k, x in enumerate(xs):
            m = ext & (np.abs(cen[:, 0] - x) < 0.4) & (cen[:, 1] * sgn > 0) & (np.abs(nrm[:, 1]) > 0.35)
            cap = np.interp(x, [-14.5, 0, 14.5], [5.6, 4.4, 3.8])
            zb = np.arange(-1.0, cap, 0.25); prof = []
            for z in zb:
                mm = m & (cen[:, 2] >= z) & (cen[:, 2] < z + 0.25)
                prof.append(np.median(lum[mm]) if mm.sum() > 4 else np.nan)
            prof = np.array(prof); started = False; top = np.nan
            for i, v in enumerate(prof):
                if np.isnan(v): continue
                if not started:
                    if v > 0.55: started = True
                    continue
                if v < 0.55:
                    nxt = prof[i:i + 4]; nxt = nxt[~np.isnan(nxt)]
                    if len(nxt) >= 2 and (nxt < 0.55).mean() >= 0.75:
                        top = zb[i]; break
            zf[k] = top if not np.isnan(top) else cap
        # median smooth
        sm = np.array([np.nanmedian(zf[max(0, k - 2):k + 3]) for k in range(len(xs))])
        out[sgn] = sm
    return xs, out

def classify(d, ext):
    cen, nrm = d['cen'], d['nrm']; lum = d['col'] @ LUM
    xs, zf = feather(d, ext)
    x, y, z = cen[:, 0], cen[:, 1], cen[:, 2]
    zfx = np.where(y >= 0, np.interp(x, xs, zf[1]), np.interp(x, xs, zf[-1]))
    dark = lum < 0.14
    zo = 0.55 + 1.3 * np.clip((x - 11.0) / 2.5, 0, 1) + 0.8 * np.clip((-12.3 - x) / 1.5, 0, 1)
    cls = np.full(len(cen), 3, 'i')                                  # 3 upper (incl. lining + insole)
    wall = nrm[:, 2] < 0.5
    mid = (z < zfx) & (wall | (z < 0.4))
    cls[mid] = 1                                                     # 1 midsole
    cls[mid & dark & (z < zo)] = 0                                   # 0 outsole
    cls[(nrm[:, 2] < -0.6) & (z < 0.2) & dark] = 0
    outward = (nrm[:, 1] * np.sign(y) > 0.15) | (nrm[:, 0] < -0.5)
    cls[(z >= zfx) & dark & (x < -4.5) & (z < 8.8) & outward & wall & ext] = 2   # 2 clip
    cls[(~ext) & (z < zfx)] = -1                                     # hidden inside the sole: drop
    return cls, xs, zf
