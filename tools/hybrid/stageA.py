import sys, os, numpy as np, bpy, math
args = sys.argv[sys.argv.index("--")+1:]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import lib
src, out = args[:2]
d = lib.load(src); ext, _ = lib.exterior(d)
cls, xs, zf = lib.classify(d, ext)
print("CLS", {k: int((cls == k).sum()) for k in (-1, 0, 1, 2, 3)})
print("ZF+", np.round(zf[1][::4], 1)); print("ZF-", np.round(zf[-1][::4], 1))
uvt = d['uv'][np.stack([d['ls'], d['ls'] + 1, d['ls'] + 2], 1)]
np.savez(out, cls=cls, uvt=uvt, ext=ext)
if len(args) > 3 and args[3] == 'nodebug':
    sys.exit(0)
# debug render: flat class colours
me = d['me']; o = d['o']; me.materials.clear()
for nm, c in (("x", (1, 0, 1)), ("out", (0.02, 0.02, 0.02)), ("mid", (0.9, 0.6, 0.1)), ("clip", (0.1, 0.3, 1)), ("upper", (0.85, 0.85, 0.85))):
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
cam = bpy.data.cameras.new("c"); cam.lens = 60; co = bpy.data.objects.new("c", cam); S.collection.objects.link(co); track(co); S.camera = co
S.render.engine = "CYCLES"; S.cycles.device = "CPU"; S.cycles.samples = 8
S.render.resolution_x, S.render.resolution_y = 800, 520
for nm, loc in (("a", (40, -42, 20)), ("b", (-40, 40, 22)), ("c", (0, -4, 70))):
    co.location = loc; S.render.filepath = os.path.join(args[2], f"cls-{nm}.png"); bpy.ops.render.render(write_still=True)
