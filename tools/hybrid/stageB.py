# Hybrid Runner 01: TRELLIS body split into named parts, recolourable detail texture.
import sys, os, math, numpy as np, bpy, bmesh
args = sys.argv[sys.argv.index("--")+1:]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import lib
src, out, work = args[:3]
PREVIEW = len(args) > 3
d = lib.load(src); o, me = d['o'], d['me']
cls = np.load(os.path.join(work, 'cls2.npz'))['cls'].copy(); cls[cls == 5] = 3
import json; WH = json.load(open(os.path.join(work, 'white.json')))
cen0, nrm0 = d['cen'], d['nrm']
detail = bpy.data.images.load(os.path.join(work, 'detail.jpg'))
me.materials.clear()
NAMES = [("outMat", "outsole"), ("midMat", "midsole"), ("clipMat", "clip"), ("upperMat", "upper"), ("liningMat", "upper")]
for mn, _ in NAMES:
    m = bpy.data.materials.new(mn); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = detail
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = 0.8
    me.materials.append(m)
me.polygons.foreach_set('material_index', np.maximum(cls, 0).astype('i')); me.update()
bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[f for f, c in zip(bm.faces, cls) if c < 0], context='FACES')
bm.to_mesh(me); bm.free(); me.update()
bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
parts = {}
objs = [x for x in bpy.context.scene.objects if x.type == 'MESH']
def join(obs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs: ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1: bpy.ops.object.join()
    obs[0].name = obs[0].data.name = name; return obs[0]
by = {}
for ob in objs:
    used = {p.material_index for p in ob.data.polygons}
    mname = ob.data.materials[min(used)].name
    by.setdefault(dict(NAMES)[mname], []).append(ob)
for pn, obs in by.items(): parts[pn] = join(obs, pn)
print("PARTS", {k: len(v.data.polygons) for k, v in parts.items()})
# solid cores so the sole parts read as solid when pulled apart
x, y, z = cen0[:, 0], cen0[:, 1], cen0[:, 2]
def core(pn, k, mat, inset, top_drop, bot_lift):
    rings = []
    for xs in np.arange(-14.5, 14.51, 0.5):
        m = (cls == k) & (np.abs(x - xs) < 0.4)
        if m.sum() < 30: continue
        y0, y1 = np.percentile(y[m], [3, 97]); z0, z1 = np.percentile(z[m], [3, 92])
        z1 -= top_drop; z0 += bot_lift
        if k == 1:
            ins = (cls >= 3) & (np.abs(x - xs) < 0.4) & (nrm0[:, 2] > 0.7) & (np.abs(y) < 2) & (z < 6)
            if ins.sum() > 5: z1 = min(z1, np.percentile(z[ins], 10) - 0.3)
        y0 += inset; y1 -= inset
        if y1 - y0 < 0.4 or z1 - z0 < 0.08: continue
        rings.append((xs, y0, y1, z0, z1))
    bm = bmesh.new(); vs = []
    for xs, y0, y1, z0, z1 in rings:
        vs.append([bm.verts.new((xs, a, b)) for a, b in ((y0, z0), (y1, z0), (y1, z1), (y0, z1))])
    for r0, r1 in zip(vs, vs[1:]):
        for i in range(4): bm.faces.new((r0[i], r0[(i + 1) % 4], r1[(i + 1) % 4], r1[i]))
    bm.faces.new(vs[0]); bm.faces.new(vs[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    m2 = bpy.data.meshes.new(pn + "Core"); bm.to_mesh(m2); bm.free()
    uvl = m2.uv_layers.new(name=parts[pn].data.uv_layers[0].name)
    for l in uvl.data: l.uv = (WH['u'], WH['v'])
    m2.materials.append(bpy.data.materials[mat])
    ob = bpy.data.objects.new(pn + "Core", m2); bpy.context.scene.collection.objects.link(ob)
    parts[pn] = join([parts[pn], ob], pn); print("CORE", pn, len(rings))
core("midsole", 1, "midMat", 0.35, 0.6, 0.15)
core("outsole", 0, "outMat", 0.3, 0.05, 0.2)
for pn, ob in parts.items():
    md = ob.modifiers.new("dec", "DECIMATE"); md.ratio = {"upper": 0.42, "clip": 0.6}.get(pn, 0.45)
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier="dec")
    for p in ob.data.polygons: p.use_smooth = True
    print("DEC", pn, len(ob.data.polygons))
bpy.ops.object.select_all(action='DESELECT')
for ob in parts.values(): ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_image_format='JPEG', export_jpeg_quality=85)
print("GLB_DONE", os.path.getsize(out))
if PREVIEW:
    S = bpy.context.scene
    for pn, dz in (("outsole", -5), ("midsole", 0), ("clip", 3), ("upper", 6)):
        parts[pn].location.z += dz
        if pn == "clip": parts[pn].location.x -= 6
    tgt = bpy.data.objects.new("t", None); tgt.location = (0, 0, 6); S.collection.objects.link(tgt)
    def track(ob):
        c = ob.constraints.new("TRACK_TO"); c.target, c.track_axis, c.up_axis = tgt, "TRACK_NEGATIVE_Z", "UP_Y"
    for loc, p in (((20, -30, 30), 9000), ((-28, 24, 20), 5000), ((0, 30, 8), 3000)):
        ld = bpy.data.lights.new("l", "AREA"); ld.energy, ld.size = p, 30
        lo = bpy.data.objects.new("l", ld); lo.location = loc; S.collection.objects.link(lo); track(lo)
    cam = bpy.data.cameras.new("c"); cam.lens = 50; co = bpy.data.objects.new("c", cam); S.collection.objects.link(co); track(co); S.camera = co
    S.render.engine = "CYCLES"; S.cycles.device = "CPU"; S.cycles.samples = 12
    S.render.resolution_x, S.render.resolution_y = 900, 700
    co.location = (42, -50, 30); S.render.filepath = os.path.join(work, "split.png"); bpy.ops.render.render(write_still=True)
