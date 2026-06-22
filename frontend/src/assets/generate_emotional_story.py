"""Glass Devotion — canvas generation for the Emotional Story lifestyle slot.

Renders an atmospheric, glassmorphic composition (gradient + light blooms +
a single specular sweep + a frosted glass plate with a whispered label) in
the NexClean palette. No literal photography — light and reflection stand
in for the intimacy between an owner and their car.
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1600, 2000
FONT_DIR = "/Users/ujjawalmahawar/Desktop/Appzeto/NexClean/.claude/skills/canvas-design/canvas-fonts"

INK = (26, 31, 54)
BG = (247, 249, 252)
PRIMARY = (79, 124, 255)
SECONDARY = (110, 168, 255)
ACCENT = (0, 194, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vertical_gradient(size, stops):
    w, h = size
    col = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / (h - 1)
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]
            t1, c1 = stops[i + 1]
            if t0 <= t <= t1:
                local = 0 if t1 == t0 else (t - t0) / (t1 - t0)
                col.putpixel((0, y), lerp(c0, c1, local))
                break
        else:
            col.putpixel((0, y), stops[-1][1])
    return col.resize((w, h))


def soft_bloom(canvas_size, center, radius, color, opacity, blur):
    """Solid soft-edged disc, blurred — cleaner falloff than a per-pixel radial."""
    pad = blur * 3
    size = (radius * 2 + pad * 2, radius * 2 + pad * 2)
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = size[0] / 2, size[1] / 2
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(*color, opacity))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return layer, (int(center[0] - size[0] / 2), int(center[1] - size[1] / 2))


def rounded_rect_mask(size, radius):
    mask = Image.new("L", size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return mask


def main():
    # 1. Atmosphere — pale brand background easing into a deep, saturated indigo glow.
    base = vertical_gradient(
        (W, H),
        [
            (0.0, (248, 250, 253)),
            (0.30, (224, 233, 251)),
            (0.55, (171, 197, 248)),
            (0.80, (104, 145, 244)),
            (1.0, (61, 99, 224)),
        ],
    ).convert("RGBA")

    # 2. Faint structural grid — a deliberate, clinical texture beneath the atmosphere.
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    step = 80
    for x in range(0, W + 1, step):
        gd.line([(x, 0), (x, H)], fill=(255, 255, 255, 14))
    for y in range(0, H + 1, step):
        gd.line([(0, y), (W, y)], fill=(255, 255, 255, 14))
    base.alpha_composite(grid)

    # 3. Layered blooms — vivid, generously blurred, where attention gathers.
    blooms = [
        ((W * 0.74, H * 0.14), 280, ACCENT, 200, 150),
        ((W * 0.18, H * 0.32), 420, SECONDARY, 200, 130),
        ((W * 0.62, H * 0.55), 560, PRIMARY, 215, 150),
        ((W * 0.40, H * 0.86), 480, ACCENT, 190, 140),
    ]
    for center, radius, color, opacity, blur in blooms:
        layer, pos = soft_bloom((W, H), center, radius, color, opacity, blur)
        base.alpha_composite(layer, pos)

    # 4. A single specular sweep — one smooth curved highlight, like a reflection
    #    crossing a curved hood or windshield at the moment light catches it.
    sweep = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sweep)
    pts = []
    import math as _m
    for i in range(161):
        t = i / 160
        x = -120 + t * (W + 240)
        y = H * 0.40 + _m.sin(t * _m.pi) * -H * 0.16
        pts.append((x, y))
    sd.line(pts, fill=(255, 255, 255, 110), width=46, joint="curve")
    sweep = sweep.filter(ImageFilter.GaussianBlur(46))
    base.alpha_composite(sweep)

    # 5. Glass plate — the single intimate, precise gesture anchoring the lower third.
    plate_w, plate_h = 920, 320
    plate_x = (W - plate_w) // 2
    plate_y = int(H * 0.76)

    # drop shadow for lift
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh_mask = rounded_rect_mask((plate_w, plate_h), 26)
    sh_layer = Image.new("RGBA", (plate_w, plate_h), (20, 30, 70, 0))
    sh_layer.paste((20, 30, 70, 90), (0, 0), sh_mask)
    shadow.paste(sh_layer, (plate_x, plate_y + 26), sh_layer)
    shadow = shadow.filter(ImageFilter.GaussianBlur(36))
    base.alpha_composite(shadow)

    plate_mask = rounded_rect_mask((plate_w, plate_h), 26)
    plate_fill = Image.new("RGBA", (plate_w, plate_h), (255, 255, 255, 58))
    plate_rgba = Image.new("RGBA", (plate_w, plate_h), (0, 0, 0, 0))
    plate_rgba.paste(plate_fill, (0, 0), plate_mask)

    border = Image.new("RGBA", (plate_w, plate_h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(border)
    bd.rounded_rectangle(
        [1, 1, plate_w - 2, plate_h - 2], radius=26, outline=(255, 255, 255, 160), width=2
    )
    plate_rgba.alpha_composite(border)
    base.alpha_composite(plate_rgba, (plate_x, plate_y))

    # 6. Whispered typographic mark inside the plate — a coordinate, not a caption.
    draw = ImageDraw.Draw(base)
    try:
        label_font = ImageFont.truetype(f"{FONT_DIR}/Jura-Light.ttf", 32)
        mono_font = ImageFont.truetype(f"{FONT_DIR}/DMMono-Regular.ttf", 19)
    except OSError:
        label_font = ImageFont.load_default()
        mono_font = label_font

    label = "EVERY DRIVE, CARED FOR"
    tracked = " ".join(list(label))
    tb = draw.textbbox((0, 0), tracked, font=label_font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    lx = plate_x + (plate_w - tw) / 2
    ly = plate_y + plate_h * 0.40 - th / 2
    draw.text((lx, ly), tracked, font=label_font, fill=(26, 31, 54, 230))

    rule_y = plate_y + plate_h * 0.56
    draw.line(
        [(plate_x + 90, rule_y), (plate_x + plate_w - 90, rule_y)],
        fill=(26, 31, 54, 60),
        width=1,
    )

    coord = "NO. 04  —  DEVOTION, OBSERVED"
    cb = draw.textbbox((0, 0), coord, font=mono_font)
    cw = cb[2] - cb[0]
    cx_ = plate_x + (plate_w - cw) / 2
    cy_ = plate_y + plate_h * 0.66
    draw.text((cx_, cy_), coord, font=mono_font, fill=(79, 124, 255, 190))

    # 7. Flatten onto the brand background and export.
    final = Image.alpha_composite(Image.new("RGBA", base.size, (*BG, 255)), base).convert("RGB")

    out_dir = "/Users/ujjawalmahawar/Desktop/Appzeto/NexClean/frontend/src/assets"
    final.save(f"{out_dir}/emotional-story.png", "PNG")
    final.save(f"{out_dir}/emotional-story.webp", "WEBP", quality=88, method=6)
    print(f"saved emotional-story.png + emotional-story.webp ({final.size[0]}x{final.size[1]})")


if __name__ == "__main__":
    main()
