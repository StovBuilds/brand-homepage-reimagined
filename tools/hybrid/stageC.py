# refine classes: lining + laces, smooth ragged boundaries, remove small islands
import sys, os, numpy as np, bpy
args = sys.argv[sys.argv.index("--")+1:]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import lib
work = args[1]
d = lib.load(args[0]); z0 = np.load(os.path.join(work, 'cls.npz')); cls, ext, uvt = z0['cls'].copy(), z0['ext'], z0['uvt']
cen, nrm, co, tri = d['cen'], d['nrm'], d['co'], d['tri']; lum = d['col'] @ lib.LUM
x, y, z = cen[:, 0], cen[:, 1], cen[:, 2]
# lining: dark faces of the upper
cls[(cls == 3) & (lum < 0.14)] = 4
# laces: light faces sitting inside the (closed) dark tongue footprint
G = 0.25; gx = ((x + 2) / G).astype(int); gy = ((y + 6) / G).astype(int); NX, NY = int(12 / G), int(12 / G)
ok = (gx >= 0) & (gx < NX) & (gy >= 0) & (gy < NY)
top = ext & (nrm[:, 2] > 0.15) & (z > 4.5) & (x > -0.5) & (x < 8.6) & ok
mask = np.zeros((NX, NY), bool); dk = top & (cls == 4); mask[gx[dk], gy[dk]] = True
def dil(m, r):
    o = m.copy()
    for i in range(-r, r + 1):
        for j in range(-r, r + 1):
            if i * i + j * j <= r * r: o |= np.roll(np.roll(m, i, 0), j, 1)
    return o
mask = ~dil(~dil(mask, 4), 4)
lace = top & (cls == 3) & (lum > 0.3); lace[lace] = mask[gx[lace], gy[lace]]
cls[lace] = 5
# adjacency by welded position
_, vid = np.unique(np.round(co, 4), axis=0, return_inverse=True); t = vid.reshape(-1)[tri]
P = len(tri); e = np.concatenate([t[:, [0, 1]], t[:, [1, 2]], t[:, [2, 0]]]); e.sort(1)
key = e[:, 0].astype(np.int64) * (vid.max() + 1) + e[:, 1]; fid = np.tile(np.arange(P), 3); slot = np.repeat(np.arange(3), P)
o = np.argsort(key, kind='stable'); ks, fs, ss = key[o], fid[o], slot[o]
same = ks[1:] == ks[:-1]
nb = np.full((P, 3), -1, 'i'); a, b = np.where(same)[0], np.where(same)[0] + 1
nb[fs[a], ss[a]] = fs[b]; nb[fs[b], ss[b]] = fs[a]
def vote(cls, rounds, movable):
    for _ in range(rounds):
        n = np.where(nb >= 0, cls[np.clip(nb, 0, None)], -9)
        new = cls.copy()
        for i, j in ((0, 1), (0, 2), (1, 2)):
            m = (n[:, i] == n[:, j]) & (n[:, i] >= 0) & (n[:, i] != cls) & movable
            new[m] = n[m, i]
        cls = new
    return cls
cls = vote(cls, 12, cls >= 0)
# small islands -> absorbed by neighbours
comp = np.arange(P)
for _ in range(4000):
    n = np.where((nb >= 0) & (cls[np.clip(nb, 0, None)] == cls[:, None]), comp[np.clip(nb, 0, None)], P + 1)
    new = np.minimum(comp, n.min(1)); new = new[new]
    if (new == comp).all(): break
    comp = new
cnt = np.bincount(comp, minlength=P); small = (cnt[comp] < 400) & (cls >= 0)
print("SMALL", int(small.sum()))
lab = cls.copy(); lab[small] = -5
for _ in range(200):
    todo = lab == -5
    if not todo.any(): break
    n = np.where(nb >= 0, lab[np.clip(nb, 0, None)], -9); best = n.max(1)
    fill = todo & (best >= 0); lab[fill] = best[fill]
    if not fill.any(): break
lab[lab == -5] = -1
cls = vote(lab, 4, lab >= 0)
print("CLS2", {k: int((cls == k).sum()) for k in range(-1, 6)})
np.savez(os.path.join(work, 'cls2.npz'), cls=cls, uvt=uvt, ext=ext)
me = d['me']; me.materials.clear()
for nm, c in (("x", (1, 0, 1)), ("out", (0.02, 0.02, 0.02)), ("mid", (0.9, 0.6, 0.1)), ("clip", (0.1, 0.3, 1)), ("upper", (0.85, 0.85, 0.85)), ("lining", (0.1, 0.6, 0.2)), ("lace", (1, 0.1, 0.1))):
    m = bpy.data.materials.new(nm); m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*c, 1); me.materials.append(m)
me.polygons.foreach_set('material_index', (cls + 1).astype('i')); me.update()
S = bpy.context.scene
tgt = bpy.data.objects.new("t", None); tgt.location = (0, 0, 5); S.collection.objects.link(tgt)
def track(ob):
    c = ob.constraints.new("TRACK_TO"); c.target, c.track_axis, c.up_axis = tgt, "TRACK_NEGATIVE_Z", "UP_Y"
for loc, p in (((20, -30, 30), 9000), ((-28, 24, 20), 5000), ((0, 30, 8), 3000)):
    ld = bpy.data.lights.new("l", "AREA"); ld.energy, ld.size = p, 30
    lo = bpy.data.objects.new("l", ld); lo.location = loc; S.collection.objects.link(lo); track(lo)
cam = bpy.data.cameras.new("c"); cam.lens = 60; cob = bpy.data.objects.new("c", cam); S.collection.objects.link(cob); track(cob); S.camera = cob
S.render.engine = "CYCLES"; S.cycles.device = "CPU"; S.cycles.samples = 8
S.render.resolution_x, S.render.resolution_y = 800, 520
for nm, loc in (("a", (40, -42, 20)), ("b", (-40, 40, 22)), ("c", (0, -4, 70))):
    cob.location = loc; S.render.filepath = os.path.join(work, f"cls2-{nm}.png"); bpy.ops.render.render(write_still=True)
