"""Спрайты ВОНСАН-67 из простых моделей Blender: тун-шейдинг (манхва) и «3/4» как в GORKY-67.

Игровые спрайты — в двойном разрешении (SPRITE_SCALE=2), в игре показываются с масштабом ½ (SPRITES в config.js).
Крупный просмотр одного спрайта — SPRITE_SCALE=6 и другая папка вывода.

Запуск (Blender 4.2+):
  "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe" -b --factory-startup --python tools/blender/make_sprites.py -- public/sprites [ключ ...]

Как в GORKY-67: камера смотрит строго сверху, а модель скашивается Y' = Y + K·Z — высота уходит вверх
по экрану, земля не сжимается, поэтому раскладка уровней (вид сверху) остаётся прежней.
Аниме-вид: материал — освещённость, разложенная лесенкой на 3 ровных тона (тень / основной / блик),
плюс тёмная обводка по силуэту после рендера (Freestyle обводил каждую деталь и всё темнил — GORKY-67).
1 единица Blender = 1 px спрайта. Точка опоры (ноги) — (0, 0, 0). В sprites.json пишется, где она в кадре.
"""
import json
import math
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(argv[0] if argv else "sprites_out")
ONLY = set(argv[1:])
SS = 4          # суперсэмплинг
PS = int(os.environ.get("SPRITE_SCALE", "1"))  # крупный пробный рендер: SPRITE_SCALE=6
K = 0.85        # скос высоты для построек (как «наклон камеры»), земля не сжимается
CHAR_TILT = 58  # фигуры — настоящей камерой под углом от вертикали: лица видно
os.makedirs(OUT, exist_ok=True)
MANIFEST = os.path.join(OUT, "sprites.json")
manifest = json.load(open(MANIFEST, encoding="utf-8")) if os.path.exists(MANIFEST) else {}


def lin(h):
    r, g, b = ((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255
    return (r ** 2.2, g ** 2.2, b ** 2.2, 1.0)


SHADOW_TINT = 0x3c3070  # фиолетовая тень
LIGHT_TINT = 0xfff0d2   # тёплый закатный блик


def shade(h, k):
    """Цвет темнее/светлее в манхва-палитре (docs/art-style.md): тень уходит в фиолетово-синий
    (SHADOW_TINT), блик — в тёплый закатный (LIGHT_TINT), как на обложке 1967 года."""
    r, g, b = (h >> 16) & 255, (h >> 8) & 255, h & 255
    if k < 1:
        tr, tg, tb = (SHADOW_TINT >> 16) & 255, (SHADOW_TINT >> 8) & 255, SHADOW_TINT & 255
        m = 0.38
        r, g, b = r * k * (1 - m) + tr * m, g * k * (1 - m) + tg * m, b * k * (1 - m) + tb * m
    else:
        tr, tg, tb = (LIGHT_TINT >> 16) & 255, (LIGHT_TINT >> 8) & 255, LIGHT_TINT & 255
        q = k - 1
        r, g, b = r + (tr - r) * q, g + (tg - g) * q, b + (tb - b) * q
    return (int(min(255, r)) << 16) | (int(min(255, g)) << 8) | int(min(255, b))


_mats = {}


def toon(name, color, dark=0.55, light=1.28, glow=0.0):
    """Тун-материал: Diffuse(белый) → Shader to RGB → ч/б → лесенка из 3 тонов → Emission."""
    key = (name, color)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    s2r = nt.nodes.new("ShaderNodeShaderToRGB")
    bw = nt.nodes.new("ShaderNodeRGBToBW")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    els = ramp.color_ramp.elements
    els[0].position = 0.0
    els[0].color = lin(shade(color, dark))
    els[1].position = 0.32
    els[1].color = lin(color)
    hi = els.new(0.78)
    hi.color = lin(shade(color, light))
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 1.0 + glow
    nt.links.new(diff.outputs["BSDF"], s2r.inputs["Shader"])
    nt.links.new(s2r.outputs["Color"], bw.inputs["Color"])
    nt.links.new(bw.outputs["Val"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    _mats[key] = m
    return m


def flat(name, color):
    """Ровный цвет без светотени (глаза, блики, окна)."""
    key = ("flat", name, color)
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    nt.nodes.remove(p)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = lin(color)
    nt.links.new(e.outputs["Emission"], nt.nodes["Material Output"].inputs["Surface"])
    _mats[key] = m
    return m


def put(o, m, smooth=True):
    o.data.materials.append(m)
    if smooth:
        bpy.ops.object.shade_smooth()
    return o


def box(size, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    return put(o, m, smooth=False)


def ball(size, loc, m, segs=24, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=segs // 2, radius=0.5, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    return put(o, m)


def cyl(r, depth, loc, m, axis="z", verts=20, rot=None):
    rr = rot or {"z": (0, 0, 0), "x": (0, math.pi / 2, 0), "y": (math.pi / 2, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rr)
    return put(bpy.context.object, m)


def cone(r1, r2, depth, loc, m, rot=(0, 0, 0), verts=16):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    return put(bpy.context.object, m)


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def setup_scene(w, h, cam_x, cam_y, tilt=0.0, foot=(0.5, 0.5)):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.render.resolution_x, sc.render.resolution_y = w * SS * PS, h * SS * PS
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.5, 0.5, 0.55, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = max(w, h)
    cam.clip_end = 4000
    co = bpy.data.objects.new("cam", cam)
    if tilt:
        # Наклонная камера (фигуры): смотрит вниз и вперёд под углом tilt от вертикали.
        # Центр кадра C выбираем так, чтобы точка опоры (0,0,0) попала в foot кадра.
        t = math.radians(tilt)
        up = (0, math.cos(t), math.sin(t))
        dx = (foot[0] - 0.5) * w
        dy = (0.5 - foot[1]) * h
        cx, cy, cz = -dx, -up[1] * dy, -up[2] * dy
        back = (0, -math.sin(t), math.cos(t))
        co.location = (cx + back[0] * 1500, cy + back[1] * 1500, cz + back[2] * 1500)
        co.rotation_euler = (t, 0, 0)
    else:
        co.location = (cam_x, cam_y, 1500)
    sc.collection.objects.link(co)
    sc.camera = co
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 3.0
    sun.angle = math.radians(8)
    so = bpy.data.objects.new("sun", sun)
    # свет слева-сверху-спереди: у фигур освещены лицо и левый бок, тень справа
    so.rotation_euler = (math.radians(50), math.radians(-35), math.radians(-20))
    sc.collection.objects.link(so)


def oblique(k=K):
    from mathutils import Matrix
    S = Matrix(((1, 0, 0, 0), (0, 1, k, 0), (0, 0, 1, 0), (0, 0, 0, 1)))
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            o.matrix_world = S @ o.matrix_world


def outline(img, w, h, width=1, color=(0.06, 0.05, 0.08)):
    """Обводка силуэта снаружи, width px — «тушь» манхвы."""
    import numpy as np
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    solid = px[..., 3] > 0.35
    grown = solid.copy()
    for _ in range(width):
        pad = np.pad(grown, 1)
        near = np.zeros_like(grown)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            near |= pad[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
        grown = near
    ring = grown & ~solid
    px[ring, :3] = color
    px[ring, 3] = 1.0
    img.pixels[:] = px.ravel()


def render(key, w, h, build, foot=(0.5, 0.85), skew=True, line=1, rot_z=0.0, tilt=0.0):
    """foot — где в кадре точка опоры (доли ширины/высоты от левого верхнего угла)."""
    if ONLY and key not in ONLY and key.split("_")[0] not in ONLY:
        return
    clear()
    # камера сдвинута так, чтобы точка опоры (0,0) попала в foot кадра (у Blender +Y — вверх по экрану)
    cam_x = (0.5 - foot[0]) * w
    cam_y = (foot[1] - 0.5) * h
    setup_scene(w, h, cam_x, cam_y, tilt, foot)
    build()
    if rot_z:
        for o in bpy.context.scene.objects:
            if o.type == "MESH":
                o.rotation_euler.z += rot_z
                o.location.rotate(__import__("mathutils").Euler((0, 0, rot_z)))
    if skew and not tilt:
        oblique()
    path = os.path.join(OUT, f"{key}.png")
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    img.scale(w * PS, h * PS)
    outline(img, w * PS, h * PS, line * PS)
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    manifest[key] = {"w": w, "h": h, "ox": foot[0], "oy": foot[1], "scale": PS}
    print("sprite", key, w, h)


# ---------- палитра (как в игре: config.js UNITS/PROPS) ----------
GOBLIN = 0x6cc44a
GOBLIN_DARK = 0x4f9a36
RAG = 0x6b5236
SKIN = 0xe2bf9c
EYE = 0x161212
WHITE = 0xffffff


def eyes(x, z, y_sep, size, iris=EYE, glint=True, y=0):
    """Аниме-глаза: крупные тёмные с белым бликом. x — вперёд (к зрителю после скоса — вниз)."""
    for s in (-1, 1):
        ball((size * 0.5, size, size * 1.2), (x, y + s * y_sep, z), flat("eye", iris), segs=16)
        if glint:
            ball((size * 0.3, size * 0.35, size * 0.35), (x + size * 0.15, y + s * y_sep + size * 0.2, z + size * 0.3), flat("glint", WHITE), segs=10)


# Фигуры смотрят «на зрителя-вправо»: лицо в сторону -Y (вниз по экрану, к зрителю) и +X (вправо).
# В игре разворот влево — flipX.

# Оси: X — вправо по экрану, −Y — к зрителю (вниз по экрану), Z — высота (после скоса уходит вверх).
# Лицо на −Y, взгляд чуть вправо (+X): в игре разворот влево — flipX.

def face(x, z, y_front, sep, ew, eh, iris=EYE, glint=0xffffff):
    """Аниме-глаза на передней стороне головы: крупные, с бликом."""
    for s in (-1, 1):
        ball((ew, 1.2, eh), (x + s * sep, y_front, z), flat("eye", iris), segs=12)
        ball((ew * 0.38, 0.6, eh * 0.32), (x + s * sep + ew * 0.18, y_front - 0.5, z + eh * 0.22), flat("glint", glint), segs=8)


def brows(x, z, y_front, sep, w, angry=True):
    for sgn in (-1, 1):
        box((w, 0.8, 1.0), (x + sgn * sep, y_front - 0.3, z), flat("brow", 0x161212), rot=(0, -sgn * (0.45 if angry else -0.15), 0))


def goblin():
    body, dark, rag = toon("gob", GOBLIN), toon("gobd", GOBLIN_DARK), toon("rag", RAG)
    for s in (-1, 1):
        cyl(1.8, 6, (s * 2.6, 0, 3), dark, verts=8)                                   # ноги
    ball((11, 9, 10), (0, 0, 8), rag)                                                  # туловище в лохмотьях
    for s in (-1, 1):
        cyl(1.6, 8, (s * 5.5, -3.5, 10), body, axis="y", verts=8)                     # руки вперёд
    ball((15, 13, 13), (0, 0, 19), body)                                               # большая голова (чиби)
    for s in (-1, 1):
        cone(3.4, 0.3, 12, (s * 10.5, 1, 22), dark, rot=(0, s * math.radians(70), 0))  # уши в стороны
    face(1.2, 19.5, -6.3, 3.2, 3.2, 3.8, glint=0xfff2a0)                              # большие глаза, жёлтый блик
    brows(1.2, 22.6, -6.0, 3.2, 3.4)
    box((5, 1, 1.2), (1.2, -6.2, 15), flat("mouth", 0x3a1414))                        # оскал
    for s in (-1, 1):
        cone(0.6, 0, 1.6, (1.2 + s * 1.5, -6.8, 14.6), flat("tooth", WHITE), rot=(math.pi, 0, 0), verts=6)


SPEAR_BODY = 0x3f8a3a
HELM = 0x6a6e72
SHIELD = 0x7a5232


def spearman():
    body, armor, helm = toon("spb", SPEAR_BODY), toon("arm", 0x4a5a3a), toon("helm", HELM)
    shield, wood, steel = toon("shield", SHIELD), toon("wood", 0x9c7a4c), toon("steel", 0xc8ccd0, light=1.4)
    for s in (-1, 1):
        cyl(2.2, 8, (s * 3.2, 0, 4), armor, verts=8)                                   # ноги
    ball((14, 11, 14), (0, 0, 13), armor)                                              # доспех
    ball((14, 12, 13), (0, 0, 25), body)                                               # голова
    ball((15.5, 13.5, 9), (0, 0.5, 29), helm)                                          # шлем
    cone(1.6, 0.2, 7, (0, 0.5, 35), helm)                                              # шип шлема
    face(1.0, 25, -6.0, 3.0, 2.8, 3.2, glint=0xfff2a0)
    brows(1.0, 27.8, -5.8, 3.0, 3.0)
    # круглый щит на левой руке (к зрителю), копьё в правой — остриём вперёд-вверх
    cyl(7.5, 1.6, (-7.5, -5, 13), shield, axis="y", verts=24)
    cyl(2.2, 1.8, (-7.5, -6, 13), steel, axis="y", verts=12)
    cyl(0.9, 40, (9, -3, 18), wood, rot=(0, math.radians(35), 0), verts=8)            # древко наискось
    cone(2.0, 0, 6, (20.5, -3, 34.5), steel, rot=(0, math.radians(35), 0), verts=8)   # наконечник


BERS = 0xc4432c
BERS_DARK = 0x5a2418


def berserker():
    body, mane, horn = toon("bers", BERS), toon("mane", BERS_DARK), toon("horn", 0xe8dcc0, light=1.2)
    wood, steel = toon("axew", 0x6a4a2c), toon("axe", 0x9aa0a6, light=1.45)
    for s in (-1, 1):
        cyl(3.2, 9, (s * 4.5, 0, 4.5), mane, verts=10)                                  # ноги
    ball((22, 16, 18), (0, 0, 17), body)                                               # могучий торс
    ball((12, 10, 6), (0, -2, 11), toon("belt", 0x3a2a1c))                             # пояс
    for s in (-1, 1):
        ball((7, 7, 7), (s * 11, -1, 22), body)                                        # плечи
    ball((15, 13, 13), (0, -1, 31), body)                                              # голова
    ball((17, 12, 10), (0, 3, 33), mane)                                               # грива
    for s in (-1, 1):
        cone(2.4, 0.3, 11, (s * 7.5, 0, 38.5), horn, rot=(0, s * math.radians(38), 0))
    face(0.8, 31.5, -7.4, 3.2, 3.0, 3.0, iris=0x2a0808, glint=0xffd23a)
    brows(0.8, 34.3, -7.1, 3.2, 3.6)
    box((6, 1, 1.4), (0.8, -7.2, 27.2), flat("mouth", 0x2a0808))
    # топор занесён над правым плечом
    cyl(1.2, 26, (13, -2, 30), wood, rot=(0, math.radians(-20), 0), verts=8)
    box((9, 2.2, 8), (17.5, -2, 41.5), steel, rot=(0, math.radians(-20), 0))


CLOTH = [0x4a6a8a, 0x8a5a3a, 0x7a3a3a]


def civilian(cloth):
    def build():
        c, pants, skin, hair = toon("cloth", cloth), toon("pants", 0x3a3a40), toon("skin", SKIN), toon("hair", 0x2a1d17)
        for s in (-1, 1):
            cyl(1.8, 8, (s * 2.4, 0, 4), pants, verts=8)
        ball((10, 8, 12), (0, 0, 13), c)                                               # пальто
        cyl(1.4, 9, (6.5, -1, 22), c, rot=(0, math.radians(20), 0), verts=8)          # рука поднята — машет
        ball((3, 3, 3), (8, -1, 26.5), skin)                                           # ладонь
        ball((11, 10, 11), (0, 0, 24), skin)                                           # голова
        ball((12, 11, 7), (0, 1, 27.5), hair)                                          # волосы
        face(0.6, 24, -4.9, 2.4, 2.4, 3.0)
        box((2.2, 0.8, 0.8), (0.6, -4.9, 20.6), flat("mouth", 0x6a2a2a))
    return build


def soldier():
    uni, helm, skin, gun = toon("uni", 0x5a6a3c), toon("shelm", 0x4a5a30), toon("skin", SKIN), toon("gun", 0x2a2a26)
    for s in (-1, 1):
        cyl(2.0, 8, (s * 2.6, 0, 4), uni, verts=8)
    ball((12, 9, 12), (0, 0, 13), uni)
    ball((11, 10, 11), (0, 0, 24), skin)
    ball((13, 12, 7), (0, 0.4, 27.5), helm)                                            # каска
    face(0.6, 23.5, -4.9, 2.4, 2.2, 2.6)
    box((16, 1.6, 1.6), (6, -5, 15), gun, rot=(0, math.radians(-12), 0))             # автомат вперёд-вправо


# ---------- вертолёт: вид строго сверху (в игре вращается), нос в +X ----------
HELI = 0x5f6b3e
HELI_DARK = 0x434d2c


def heli():
    body, dark = toon("hbody", HELI), toon("hdark", HELI_DARK)
    glass = toon("hglass", 0x9fc4d4, light=1.5)
    ball((64, 30, 22), (4, 0, 12), body)                     # фюзеляж
    ball((20, 20, 12), (31, 0, 15), glass)                   # остекление носа
    cyl(4.2, 40, (-44, 0, 14), body, axis="x", verts=12)     # хвостовая балка
    box((7, 3, 12), (-62, 0, 18), dark)                      # киль
    box((10, 20, 2), (-57, 0, 13), dark)                     # стабилизатор
    for s in (-1, 1):
        box((13, 1.4, 9), (2, s * 14.6, 11), dark)           # сдвижные двери
        cyl(3.4, 20, (-2, s * 13.5, 5), dark, axis="x", verts=10)   # подвесные баки
    cyl(3.6, 5, (4, 0, 25), dark, verts=12)                   # втулка (винт — в игре)
    ball((6, 6, 3), (-24, 0, 22), flat("mark", 0xc23a26))     # бортовой знак — красный кружок


# ---------- постройки: скос K, земля не сжимается ----------
def house(roof, roof_dark):
    def build():
        wall, base = toon("wall", 0xb0a898), toon("base", 0x7a7468)
        r, rd = toon("roof", roof), toon("roofd", roof_dark)
        win = flat("win", 0x2a3440)
        box((40, 28, 18), (0, 0, 9), wall)                                   # стены
        box((40.4, 28.4, 3), (0, 0, 1.5), base)                              # цоколь
        for s in (-1, 1):                                                    # двускатная крыша
            box((44, 17, 2), (0, s * 7.2, 22), r if s > 0 else rd, rot=(s * math.radians(-28), 0, 0))
        for i in (-12, 0, 12):
            box((6, 0.6, 6), (i, -14.2, 11), win)                            # окна на фасаде к зрителю
        box((5, 0.6, 9), (16, -14.2, 4.5), flat("door", 0x4a3424))
    return build


def tree(scale):
    def build():
        trunk, leaf, leaf2 = toon("trunk", 0x5a4030), toon("leaf", 0x3e6a32), toon("leaf2", 0x507a3c, light=1.35)
        cyl(2.2 * scale, 12 * scale, (0, 0, 6 * scale), trunk, verts=8)
        ball((24 * scale, 22 * scale, 18 * scale), (0, 0, 18 * scale), leaf)
        ball((16 * scale, 15 * scale, 13 * scale), (-3 * scale, -2 * scale, 25 * scale), leaf2)
        ball((14 * scale, 13 * scale, 11 * scale), (5 * scale, 2 * scale, 23 * scale), leaf)
    return build


def bunker():
    conc, conc_d, bag, bag_d = toon("conc", 0x9a9a92), toon("concd", 0x6a6a66), toon("bag", 0xb8a476), toon("bagd", 0x9c8a5e)
    box((104, 84, 22), (0, 0, 11), conc)                                       # бетонный короб
    box((96, 76, 3), (0, 0, 23.5), conc_d)                                     # плита крыши
    box((18, 1, 14), (0, -42.2, 7), flat("door", 0x15130f))                    # вход к зрителю
    box((10, 6, 6), (30, 10, 28), conc_d)                                      # вентиляция
    for i in range(9):                                                         # мешки вдоль фасада
        ball((13, 8, 7), (-48 + i * 12, -46, 3.5), bag if i % 2 else bag_d)
        if i < 8:
            ball((13, 8, 7), (-42 + i * 12, -46, 9.5), bag_d if i % 2 else bag)


def truck():
    cab, tent, dark = toon("cab", 0x3f5232), toon("tent", 0x6b7848), toon("tdark", 0x1c1c1a)
    glass = toon("tglass", 0x9fc4d4, light=1.5)
    for x in (-14, 6, 14):
        for s in (-1, 1):
            cyl(4, 3, (x, s * 11, 4), dark, axis="y", verts=14)                 # колёса
    box((14, 22, 14), (-21, 0, 11), cab)                                       # кабина (влево)
    box((1, 18, 6), (-28.2, 0, 14), glass)                                     # лобовое стекло
    box((36, 24, 4), (4, 0, 7), dark)                                          # рама
    ball((38, 24, 22), (4, 0, 14), tent)                                       # тент-полубочка
    box((38, 24, 6), (4, 0, 9), tent)


def nest():
    bag, bag_d, base = toon("bag", 0xb8a476), toon("bagd", 0x9c8a5e), toon("nbase", 0x4a4636)
    cyl(15, 3, (0, 0, 1.5), base, verts=24)
    n = 12
    for i in range(n):
        a = i / n * math.pi * 2
        ball((11, 8, 7), (math.cos(a) * 16, math.sin(a) * 16, 3.5), bag if i % 2 else bag_d, rot=(0, 0, a + math.pi / 2))
        if i % 3 != 1:
            ball((11, 8, 7), (math.cos(a + 0.26) * 16, math.sin(a + 0.26) * 16, 9.5), bag_d if i % 2 else bag, rot=(0, 0, a + math.pi / 2))
    cyl(4, 6, (0, 0, 8), toon("tripod", 0x2a2a26), verts=10)                  # станок (ствол — в игре)


def watchtower():
    wood, wood_d, roof = toon("twood", 0x8a6a46), toon("twoodd", 0x5a4430), toon("troof", 0x4a5a3a)
    steel, glass = toon("tsteel", 0x5a5e62), flat("lamp", 0xfff4c8)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(1.4, 44, (sx * 7, sy * 7, 22), wood, verts=8)                     # четыре ноги
    for z in (12, 28):
        for sy in (-1, 1):
            box((16, 1, 1.2), (0, sy * 7, z), wood_d)                             # перекладины
    box((22, 22, 2), (0, 0, 45), wood_d)                                          # площадка
    for sy in (-1, 1):
        box((22, 1, 6), (0, sy * 10.5, 49), wood)                                 # перила
        box((1, 22, 6), (sy * 10.5, 0, 49), wood)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(0.8, 12, (sx * 10, sy * 10, 56), wood_d, verts=6)                 # стойки крыши
    cone(17, 0.5, 8, (0, 0, 66), roof, rot=(0, 0, math.pi / 4), verts=4)          # крыша-пирамида
    cyl(2.4, 4, (7, -9, 52), steel, axis="y", verts=12)                           # прожектор
    cyl(1.8, 0.6, (7, -11.2, 52), glass, axis="y", verts=12)


def build_all():
    c = CHAR_TILT
    render("goblin", 44, 44, goblin, foot=(0.5, 0.92), tilt=c)
    render("spearman", 56, 60, spearman, foot=(0.42, 0.92), tilt=c)
    render("berserker", 64, 66, berserker, foot=(0.45, 0.93), tilt=c)
    for i, cl in enumerate(CLOTH):
        render(f"civ{i}", 32, 40, civilian(cl), foot=(0.45, 0.92), tilt=c)
    render("soldier", 40, 40, soldier, foot=(0.42, 0.92), tilt=c)
    render("heli", 150, 72, heli, foot=(0.6, 0.5), skew=False, line=1)
    # постройки — той же наклонной камерой, что и фигуры: один ракурс 3/4 на всё
    render("houseA", 64, 60, house(0x9a4a38, 0x6e3428), foot=(0.5, 0.8), tilt=c)
    render("houseB", 64, 60, house(0x6c7074, 0x4c5054), foot=(0.5, 0.8), tilt=c)
    render("treeA", 44, 50, tree(1.0), foot=(0.5, 0.86), tilt=c)
    render("treeB", 36, 42, tree(0.8), foot=(0.5, 0.86), tilt=c)
    render("bunker", 124, 96, bunker, foot=(0.5, 0.74), tilt=c)
    render("truck", 72, 48, truck, foot=(0.5, 0.72), tilt=c)
    render("nest", 52, 40, nest, foot=(0.5, 0.62), tilt=c)
    render("watchtower", 44, 84, watchtower, foot=(0.5, 0.9), tilt=c)


build_all()
json.dump(manifest, open(MANIFEST, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("done", OUT)
