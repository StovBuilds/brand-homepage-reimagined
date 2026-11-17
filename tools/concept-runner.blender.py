# RUNNER 01 (v2) — an original parametric running trainer, modelled headless.
# Made for the brand-homepage-reimagined concept. Our own design: no brand marks,
# no copied silhouettes. Parts are separate named objects so the page can
# explode them: upper, tongue, laces, clip, midsole, plate, outsole.
#
# v2 adds what makes a product read as real rather than a toy: layered panels
# with thickness (mudguard, eyestay), a padded collar, stitching, eyelets, a
# sculpted midsole wall, edge-to-edge lugs, bevels, and ambient occlusion
# baked into vertex colours (COLOR_0) so creases and contact lines are dark.
#
#   blender -b -P tools/concept-runner.blender.py -- OUT.glb [preview-dir]
#   (RUNNER_BAKE=0 skips the AO bake for a fast draft. Blender exits 0 even when
#   a script raises, so check that OUT.glb was written and the log ends GLB_DONE.)
import bpy, bmesh, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else "public/models/runner.raw.glb")
PREVIEW = argv[1] if len(argv) > 1 else None
BAKE = os.environ.get("RUNNER_BAKE", "1") == "1"

bpy.ops.wm.read_factory_settings(use_empty=True)
S = bpy.context.scene
PI = math.pi

# ── Shape tables (cm). x: heel −14.5 → toe +14.5 ────────────────────────────
UPPER = [  # (x, half_width, crown height above footbed)
    (-14.5, 0.12, 2.6),
    (-14.3, 1.0, 6.8),
    (-13.6, 2.3, 9.4),
    (-12.0, 2.95, 8.7),
    (-9.5, 3.25, 7.4),
    (-6.5, 3.45, 7.7),
    (-3.5, 3.65, 8.9),
    (-0.5, 3.9, 7.8),
    (3.0, 4.2, 6.4),
    (6.5, 4.35, 5.2),
    (9.5, 4.1, 4.3),
    (12.0, 3.35, 3.5),
    (13.6, 2.15, 2.6),
    (14.3, 1.0, 1.5),
    (14.55, 0.22, 0.55),
]
N_AROUND = 24
HOLE_S = (3, 4, 5)
HOLE_LO, HOLE_HI = 7, 17      # around-indices bounding the collar opening
K = 0.72


def lerp(a, b, t):
    return a + (b - a) * t


def sstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def table(x):
    if x <= UPPER[0][0]:
        return UPPER[0][1], UPPER[0][2]
    for (x0, w0, h0), (x1, w1, h1) in zip(UPPER, UPPER[1:]):
        if x <= x1:
            t = sstep(0, 1, (x - x0) / (x1 - x0))
            return lerp(w0, w1, t), lerp(h0, h1, t)
    return UPPER[-1][1], UPPER[-1][2]


def rocker(x):
    u = (x + 14.5) / 29
    z = 0.0
    if u > 0.62:
        z += 2.3 * ((u - 0.62) / 0.38) ** 2
    if u < 0.16:
        z += 1.1 * ((0.16 - u) / 0.16) ** 2
    return z


def stack(x):
    u = (x + 14.5) / 29
    return lerp(4.1, 2.7, min(1, u / 0.7)) - 0.9 * max(0, (u - 0.8) / 0.2) ** 2


def footbed(x):
    return rocker(x) + stack(x)


def surf(x, a, off=1.0):
    hw, h = table(x)
    return (x, -math.cos(a) * hw * off, footbed(x) - 0.35 + (max(0.0, math.sin(a)) ** K) * h * off)


def normal_at(x, a):
    return (Vector(surf(x, a, 1.3)) - Vector(surf(x, a, 1.0))).normalized()


def midW(x):
    hw, _ = table(max(-14.35, min(14.45, x)))
    return hw * 1.12 + 0.35


def mat(name, rgb, rough=0.6, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


M_UPPER = mat("upperMat", (0.86, 0.85, 0.8), 0.9)
M_LINING = mat("liningMat", (0.02, 0.02, 0.025), 0.95)
M_RAIL = mat("railMat", (0.42, 0.43, 0.43), 0.55)
M_EYESTAY = mat("eyestayMat", (0.82, 0.81, 0.77), 0.6)
M_STITCH = mat("stitchMat", (0.9, 0.9, 0.88), 0.8)
M_EYELET = mat("eyeletMat", (0.03, 0.03, 0.035), 0.35)
M_TONGUE = mat("tongueMat", (0.03, 0.03, 0.035), 0.85)
M_LACE = mat("laceMat", (0.9, 0.9, 0.87), 0.8)
M_CLIP = mat("clipMat", (0.025, 0.025, 0.03), 0.3)
M_MID = mat("midMat", (0.88, 0.87, 0.82), 0.65)
M_PLATE = mat("plateMat", (0.02, 0.02, 0.025), 0.3)
M_OUT = mat("outMat", (0.03, 0.03, 0.035), 0.8)


def activate(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def outward(ob):
    activate(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def make(name, verts, faces, mats, uvs=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    if uvs:
        layer = me.uv_layers.new(name="UVMap")
        for loop in me.loops:
            layer.data[loop.index].uv = uvs[loop.vertex_index]
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    outward(ob)
    return ob


def grid(name, rows, mats, closed=False, skip=None, matfn=None, uvs=(0.1, 0.05)):
    n = len(rows[0])
    verts, uv, faces, fm = [], [], [], []
    for row in rows:
        for i, p in enumerate(row):
            verts.append(tuple(p))
            uv.append((p[0] * uvs[0], i * uvs[1]))
    span = n if closed else n - 1
    for s in range(len(rows) - 1):
        for i in range(span):
            if skip and skip(s, i):
                continue
            a, b = s * n + i, s * n + (i + 1) % n
            faces.append((a, b, b + n, a + n))
            fm.append(matfn(s, i) if matfn else 0)
    ob = make(name, verts, faces, mats, uv)
    for p, m in zip(ob.data.polygons, fm):
        p.material_index = m
    return ob


def subsurf(ob, levels=2):
    m = ob.modifiers.new("sub", "SUBSURF")
    m.levels = m.render_levels = levels


def solidify(ob, t, offset=-1.0, mat_off=0):
    m = ob.modifiers.new("solid", "SOLIDIFY")
    m.thickness, m.offset = t, offset
    m.material_offset = m.material_offset_rim = mat_off


def bake_mods(ob):
    activate(ob)
    bpy.ops.object.convert(target="MESH")
    return ob


def tube(name, path, r, mats, seg=8, closed_path=False):
    rows = []
    n = len(path)
    for k, p in enumerate(path):
        if closed_path:
            p0, p1 = Vector(path[(k - 1) % n]), Vector(path[(k + 1) % n])
        else:
            p0, p1 = Vector(path[max(0, k - 1)]), Vector(path[min(n - 1, k + 1)])
        t = (p1 - p0).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.95 else Vector((1, 0, 0))
        n1 = t.cross(up).normalized()
        n2 = t.cross(n1).normalized()
        rows.append([tuple(Vector(p) + (n1 * math.cos(2 * PI * j / seg) + n2 * math.sin(2 * PI * j / seg)) * r) for j in range(seg)])
    if closed_path:
        rows.append(rows[0])
    return grid(name, rows, mats, closed=True)


def join(name, obs):
    for o in obs:
        bake_mods(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    obs[0].name = obs[0].data.name = name
    return obs[0]


# ── Upper: knit sock with a real collar opening ─────────────────────────────
urows = [[surf(x, PI * i / N_AROUND) for i in range(N_AROUND + 1)] for (x, _, _) in UPPER]
shell = grid("upperShell", urows, [M_UPPER, M_LINING],
             skip=lambda s, i: s in HOLE_S and HOLE_LO <= i < HOLE_HI)
solidify(shell, 0.34, -1.0, 1)
subsurf(shell)
upper_bits = [shell]

# padded collar: a soft roll around the rim of the opening
rim = [urows[s][HOLE_LO] for s in range(HOLE_S[0], HOLE_S[-1] + 2)]
rim += [urows[HOLE_S[-1] + 1][i] for i in range(HOLE_LO + 1, HOLE_HI + 1)]
rim += [urows[s][HOLE_HI] for s in range(HOLE_S[-1], HOLE_S[0] - 1, -1)]
rim += [urows[HOLE_S[0]][i] for i in range(HOLE_HI - 1, HOLE_LO, -1)]
rim = [(p[0], p[1] * 0.97, p[2] - 0.12) for p in rim]
collar = tube("collar", rim, 0.5, [M_LINING], seg=10, closed_path=True)
subsurf(collar, 1)
upper_bits.append(collar)


# mudguard: a fused panel low on both sides that wraps the toe
def a_mud(x):
    side = 0.15 * PI + 0.028 * PI * math.sin((x + 2.0) * 0.5)
    return lerp(side, 0.5 * PI, sstep(8.5, 13.2, x))


MX = [-9.6 + 0.6 * k for k in range(41)]
mrows, AMX = [], []
for x in MX:
    x = min(x, 14.5)
    am = a_mud(x) * sstep(-10.2, -8.6, x) if x < -8.6 else a_mud(x)
    am = max(am, 0.03 * PI)
    AMX.append(am)
    mrows.append([surf(x, am * j / 6, 1.03) for j in range(7)] + [surf(x, PI - am * (6 - j) / 6, 1.03) for j in range(7)])
mud = grid("mudguard", mrows, [M_RAIL], skip=lambda s, i: i == 6 and (AMX[s] < 0.499 * PI or AMX[s + 1] < 0.499 * PI))
activate(mud)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.02)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")
solidify(mud, 0.16, 1.0)
subsurf(mud)
upper_bits.append(mud)

# eyestay: a U-shaped reinforcement around the lacing
A_IN, A_OUT = 0.415 * PI, 0.295 * PI
EX = [-3.4 + 0.75 * k for k in range(15)]
for side in (0, 1):
    rows = []
    for x in EX:
        row = [surf(x, lerp(A_OUT, A_IN, j / 3), 1.035) for j in range(4)]
        if side:
            row = [surf(x, PI - lerp(A_OUT, A_IN, j / 3), 1.035) for j in range(4)]
        rows.append(row)
    e = grid(f"eyestay{side}", rows, [M_EYESTAY])
    solidify(e, 0.16, 1.0)
    subsurf(e)
    upper_bits.append(e)
rows = [[surf(x, lerp(A_OUT, PI - A_OUT, j / 10), 1.035) for j in range(11)] for x in (7.0, 7.6, 8.2)]
bridge = grid("eyestayBridge", rows, [M_EYESTAY])
solidify(bridge, 0.16, 1.0)
subsurf(bridge)
upper_bits.append(bridge)


# stitching: real dashes along the panel edges
def stitches(name, pts, r=0.045, on=0.26, gap=0.2):
    obs, acc, k = [], 0.0, 0
    for p0, p1 in zip(pts, pts[1:]):
        v0, v1 = Vector(p0), Vector(p1)
        seg_len = (v1 - v0).length
        d = v1 - v0
        pos = -acc
        while pos < seg_len:
            a0, a1 = max(pos, 0.0), min(pos + on, seg_len)
            if a1 - a0 > on * 0.6:
                obs.append(tube(f"{name}{k}", [tuple(v0 + d * (a0 / seg_len)), tuple(v0 + d * (a1 / seg_len))], r, [M_STITCH], seg=4))
                k += 1
            pos += on + gap
        acc = (seg_len + acc) % (on + gap)
    return obs


stitch_obs = []
for side in (0, 1):
    flip = (lambda a: PI - a) if side else (lambda a: a)
    xs = [-8.4 + 0.3 * k for k in range(72)]
    stitch_obs += stitches(f"sm{side}_", [surf(x, flip(a_mud(x) - 0.03 * PI), 1.075) for x in xs if x < 12.6])
    xs = [-3.2 + 0.3 * k for k in range(34)]
    stitch_obs += stitches(f"se{side}_", [surf(x, flip(A_OUT + 0.022 * PI), 1.08) for x in xs])
    stitch_obs += stitches(f"si{side}_", [surf(x, flip(A_IN - 0.022 * PI), 1.08) for x in xs])
upper_bits += stitch_obs

# eyelets
LX = [-2.6, -0.8, 1.0, 2.8, 4.6, 6.3]
A_L, A_R = 0.355 * PI, 0.645 * PI
for x in LX:
    for a in (A_L, A_R):
        p = Vector(surf(x, a, 1.07))
        bpy.ops.mesh.primitive_torus_add(major_radius=0.3, minor_radius=0.095, major_segments=16, minor_segments=8, location=p)
        t = bpy.context.object
        t.rotation_euler = Vector((0, 0, 1)).rotation_difference(normal_at(x, a)).to_euler()
        t.data.materials.append(M_EYELET)
        for poly in t.data.polygons:
            poly.use_smooth = True
        upper_bits.append(t)

# heel pull loop
cx, cz = -13.75, footbed(-13.6) + 7.5
rows = [[(cx - 1.0 * math.sin(th), y, cz - 1.0 * math.cos(th)) for y in (-0.45, 0.45)] for th in [PI * k / 10 for k in range(11)]]
loop = grid("pull", rows, [M_LACE])
solidify(loop, 0.14, 0.0)
subsurf(loop, 1)
upper_bits.append(loop)

upper = join("upper", upper_bits)

# ── Tongue: padded ──────────────────────────────────────────────────────────
rows = []
for k in range(8):
    f = k / 7
    x = lerp(-0.6, -5.8, f)
    zc = footbed(x) + lerp(7.5, 10.9, f ** 0.8)
    hw = lerp(2.1, 2.7, f)
    rows.append([(x - 0.5 * f * (1 - abs(j - 3) / 3), (j - 3) / 3 * hw, zc - 0.6 * ((j - 3) / 3) ** 2 * (1 + f)) for j in range(7)])
tongue = grid("tongue", rows, [M_TONGUE])
solidify(tongue, 0.75, 0.0)
subsurf(tongue)
bake_mods(tongue)

# ── Laces: crossed through the eyelets ──────────────────────────────────────
def lace_path(x0, a0, x1, a1, n=14):
    pts = []
    for k in range(n + 1):
        t = k / n
        lift = 0.2 + 0.16 * math.sin(PI * t)
        p = Vector(surf(lerp(x0, x1, t), lerp(a0, a1, t), 1.05))
        pts.append(tuple(p + Vector((0, 0, lift))))
    return pts


lace_obs = []
for k in range(len(LX) - 1):
    lace_obs.append(tube(f"lace{k}a", lace_path(LX[k], A_L, LX[k + 1], A_R), 0.2, [M_LACE]))
    lace_obs.append(tube(f"lace{k}b", lace_path(LX[k], A_R, LX[k + 1], A_L), 0.2, [M_LACE]))
lace_obs.append(tube("laceEnd", lace_path(LX[-1], A_L, LX[-1], A_R), 0.2, [M_LACE]))
lace_obs.append(tube("laceTop", lace_path(LX[0], A_L, LX[0], A_R), 0.2, [M_LACE]))
for o in lace_obs:
    subsurf(o, 1)
laces = join("laces", lace_obs)

# ── Heel clip: moulded counter wrapping the back ────────────────────────────
XS = [-14.5, -14.3, -13.6, -12.9, -12.0, -11.0, -9.9, -8.8, -7.8]
rows, AM = [], []
for x in XS:
    f = (x - XS[0]) / (XS[-1] - XS[0])
    amax = 0.5 * PI if f < 0.14 else lerp(0.5 * PI, 0.06 * PI, ((f - 0.14) / 0.86) ** 0.62)
    AM.append(amax)
    rows.append([surf(x, amax * j / 6, 1.05) for j in range(7)] + [surf(x, PI - amax * (6 - j) / 6, 1.05) for j in range(7)])
clip = grid("clip", rows, [M_CLIP], skip=lambda s, i: i == 6 and (AM[s] < 0.499 * PI or AM[s + 1] < 0.499 * PI))
activate(clip)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.05)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")
solidify(clip, 0.32, 1.0)
subsurf(clip)
bake_mods(clip)

# ── Midsole: sculpted foam wall, groove for the plate line, rocker ──────────
XM = [-14.9, -14.45] + [-13.6 + 0.8 * k for k in range(35)] + [14.62, 15.0]
WALL = [(0.14, 1.03), (0.36, 1.085), (0.56, 1.06), (0.66, 1.0), (0.78, 1.045), (1.0, 1.0)]
rows = []
for x in XM:
    W = midW(x)
    if x < -14.4 or x > 14.5:
        W *= 0.45
    zb, fb = rocker(x), footbed(x)
    zt = fb + 0.8
    T = zt - zb
    facet = 0.035 * math.sin(x * 1.15) * sstep(4.0, -2.0, x)   # heel-side sculpting
    wall = [(lvl, w + (facet if 0.2 < lvl < 0.6 else 0.0)) for lvl, w in WALL]
    ring = [(x, -0.86 * W, zb), (x, -0.4 * W, zb), (x, 0.4 * W, zb), (x, 0.86 * W, zb)]
    ring += [(x, w * W, zb + lvl * T) for lvl, w in wall]
    ring += [(x, 0.8 * W, zt - 0.32), (x, 0, fb), (x, -0.8 * W, zt - 0.32)]
    ring += [(x, -w * W, zb + lvl * T) for lvl, w in reversed(wall)]
    rows.append(ring)
mid = grid("midsole", rows, [M_MID], closed=True, uvs=(0.08, 0.07))
n = len(rows[0])
bm = bmesh.new()
bm.from_mesh(mid.data)
bm.verts.ensure_lookup_table()
bm.faces.new([bm.verts[i] for i in reversed(range(n))])
bm.faces.new([bm.verts[(len(XM) - 1) * n + i] for i in range(n)])
bm.normal_update()
bm.to_mesh(mid.data)
bm.free()
for p in mid.data.polygons:
    p.use_smooth = True
outward(mid)
subsurf(mid)
bake_mods(mid)

# ── Plate line: inlaid in the wall groove ───────────────────────────────────
plate_obs = []
for sgn in (-1, 1):
    pts = []
    for k in range(33):
        x = lerp(-12.2, 10.2, k / 32)
        zb, fb = rocker(x), footbed(x)
        pts.append((x, sgn * 1.012 * midW(x), zb + (fb + 0.8 - zb) * 0.66))
    plate_obs.append(tube(f"plate{sgn}", pts, 0.17, [M_PLATE], seg=8))
plate = join("plate", plate_obs)

# ── Outsole: rubber skin that climbs the toe, lugs out to the edge ──────────
rows = []
for x in XM[1:-1]:
    W = midW(x) * 0.93
    zb = rocker(x)
    top = zb + 0.14 + 0.35 * sstep(11.6, 14.6, x)
    rows.append([(x, -W, zb - 0.4), (x, W, zb - 0.4), (x, W * 1.05, top), (x, -W * 1.05, top)])
skin = grid("outsoleSkin", rows, [M_OUT], closed=True)
out_obs = [skin]
lug_x = [-13.0, -11.2, -9.4, -7.6, 1.2, 3.0, 4.8, 6.6, 8.4, 10.2, 12.0, 13.4]
for r, x in enumerate(lug_x):
    W = midW(x) * 0.97
    cols = 4 if W > 4.6 else 3
    slope = math.atan2(rocker(x + 0.5) - rocker(x - 0.5), 1.0)
    for c in range(cols):
        y = lerp(-W, W, (c + 0.5) / cols)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x + (0.35 if c % 2 else -0.35), y, rocker(x) - 0.62))
        lug = bpy.context.object
        lug.scale = (1.15, 2 * W / cols * 0.8, 0.62)
        lug.rotation_euler = (0, -slope, math.radians(14 if (c + r) % 2 else -14))
        bv = lug.modifiers.new("bevel", "BEVEL")
        bv.width, bv.segments = 0.09, 2
        lug.data.materials.append(M_OUT)
        out_obs.append(lug)
outsole = join("outsole", out_obs)
activate(outsole)
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))

PARTS = [upper, tongue, laces, clip, mid, plate, outsole]
for ob in PARTS:
    activate(ob)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ── Ambient occlusion baked to vertex colours ───────────────────────────────
# Assembled-state AO with a short reach, floored so faces that only show when
# the shoe is pulled apart (footbed, under the upper) are shaded, not black.
if BAKE:
    S.render.engine = "CYCLES"
    S.cycles.device = "CPU"
    S.cycles.samples = 24
    world = bpy.data.worlds.new("w")
    S.world = world
    world.light_settings.distance = 2.2
    S.render.bake.target = "VERTEX_COLORS"
    for ob in PARTS:
        activate(ob)
        attr = ob.data.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
        ob.data.color_attributes.active_color = attr
        ob.data.color_attributes.render_color_index = ob.data.color_attributes.find("Col")
        bpy.ops.object.bake(type="AO")
        for d in attr.data:
            v = 0.3 + 0.7 * (d.color[0] ** 0.9)
            d.color = (v, v, v, 1.0)
    print("AO_BAKED")

# ── Export ──────────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
for ob in PARTS:
    ob.select_set(True)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
kw = dict(filepath=OUT, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
try:
    bpy.ops.export_scene.gltf(**kw, export_vertex_color="ACTIVE", export_all_vertex_colors=False)
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
tris = sum(len(p.vertices) - 2 for ob in PARTS for p in ob.data.polygons)
print("GLB_DONE", os.path.getsize(OUT), "tris", tris)

# ── Preview renders ─────────────────────────────────────────────────────────
if PREVIEW:
    if BAKE:  # show the baked AO in the preview the way the page multiplies it in
        for m in bpy.data.materials:
            nt = m.node_tree
            b = nt.nodes.get("Principled BSDF")
            if not b:
                continue
            col = nt.nodes.new("ShaderNodeVertexColor")
            col.layer_name = "Col"
            mix = nt.nodes.new("ShaderNodeMixRGB")
            mix.blend_type = "MULTIPLY"
            mix.inputs[0].default_value = 1.0
            mix.inputs[1].default_value = b.inputs["Base Color"].default_value
            nt.links.new(col.outputs["Color"], mix.inputs[2])
            nt.links.new(mix.outputs["Color"], b.inputs["Base Color"])
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, -1.05))
    bpy.context.object.data.materials.append(mat("floor", (0.62, 0.62, 0.62), 0.5))
    tgt = bpy.data.objects.new("tgt", None)
    tgt.location = (0, 0, 5.0)
    bpy.context.collection.objects.link(tgt)

    def track(o):
        tc = o.constraints.new("TRACK_TO")
        tc.target, tc.track_axis, tc.up_axis = tgt, "TRACK_NEGATIVE_Z", "UP_Y"

    for nm, loc, power in [("key", (20, -30, 30), 9000), ("rim", (-28, 24, 20), 5000), ("fill", (0, 30, 8), 1500)]:
        ld = bpy.data.lights.new(nm, "AREA")
        ld.energy, ld.size = power, 30
        lo = bpy.data.objects.new(nm, ld)
        lo.location = loc
        bpy.context.collection.objects.link(lo)
        track(lo)
    cam = bpy.data.cameras.new("cam")
    cam.lens = 60
    co = bpy.data.objects.new("cam", cam)
    bpy.context.collection.objects.link(co)
    track(co)
    S.camera = co
    S.render.engine = "CYCLES"
    S.cycles.samples = 24
    S.render.resolution_x, S.render.resolution_y = 900, 600
    for nm, loc in [("q34", (40, -42, 20)), ("side", (0, -62, 6)), ("back", (-40, 36, 22))]:
        co.location = loc
        S.render.filepath = os.path.join(PREVIEW, f"runner-{nm}.png")
        bpy.ops.render.render(write_still=True)
    print("RENDER_DONE")
