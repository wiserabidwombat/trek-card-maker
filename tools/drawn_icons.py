"""Icons drawn by hand rather than cut from a source card.

Second Edition never printed a Star Trek: Lower Decks show icon (the 2015 "Lower Decks" expansion only
has a logo on its pack art), so the icon is drawn here in the style of the other show icons: a picture
on a dark disc, in the cool hull tones of the Voyager icon. The ship is the U.S.S. Cerritos, a
California-class vessel: a broad saucer, a small engineering hull under it, and two warp nacelles slung
low and wide on down-swept pylons. It is drawn top-down at high resolution, tilted into a three-quarter
view from above and shaded from the upper left, then shrunk to the socket size.
"""

from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

DRAW_SIZE = 1024  # px, the canvas the ship is drawn on before it is shrunk
HULL = (178, 200, 224)
HULL_LIGHT = (214, 228, 242)
HULL_DARK = (104, 130, 164)
HULL_DEEP = (52, 70, 100)
STRIPE = (224, 138, 52)  # the California class wears an orange band on the saucer and nacelles
BUSSARD = (232, 84, 60)
WARP_GLOW = (120, 196, 255)
DEFLECTOR = (96, 176, 255)
VIEW_ROTATE = 34.0  # degrees counter-clockwise; the nose points to the upper left
VIEW_SQUASH = 0.74  # the vertical foreshortening of a view from well above
SHIP_SCALE = 0.78  # the tilted ship's width as a fraction of the disc, so the nacelles clear the rim


def _disc(size: int) -> Image.Image:
    """The dark navy socket disc, slightly lighter at the centre like the extracted ones."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = size / 2
    steps = max(2, size // 2)
    for i in range(steps, 0, -1):
        t = i / steps
        c = (int(2 + 12 * (1 - t)), int(4 + 18 * (1 - t)), int(14 + 44 * (1 - t)), 255)
        rr = r * t
        d.ellipse((r - rr, r - rr, r + rr, r + rr), fill=c)
    return img


def _ship_top_down(size: int) -> Image.Image:
    """The Cerritos seen from straight above, nose up, on a transparent canvas."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size / 1024.0
    cx, cy = 512 * s, 400 * s

    def P(x: float, y: float) -> tuple[float, float]:
        return (cx + x * s, cy + y * s)

    # nacelles first, so the pylons and saucer sit over them; their caps start just behind the saucer
    for sx in (-1, 1):
        x0 = sx * 300
        d.rounded_rectangle([P(x0 - 44, 110), P(x0 + 44, 600)], radius=44 * s, fill=HULL)
        d.rounded_rectangle([P(x0 - 44, 110), P(x0 + 44, 190)], radius=40 * s, fill=BUSSARD)
        d.rounded_rectangle([P(x0 - 44, 206), P(x0 + 44, 236)], radius=8 * s, fill=STRIPE)
        # the warp grille runs along the inboard side
        gx = x0 - sx * 30
        d.rounded_rectangle([P(gx - 10, 260), P(gx + 10, 560)], radius=10 * s, fill=WARP_GLOW)
        d.rounded_rectangle([P(x0 - 44, 580), P(x0 + 44, 600)], radius=8 * s, fill=HULL_DEEP)
    # pylons sweep back and out from the engineering hull to the nacelles
    for sx in (-1, 1):
        d.polygon([P(sx * 40, 300), P(sx * 265, 420), P(sx * 265, 480), P(sx * 40, 380)], fill=HULL_DARK)
    # engineering hull: a slim pod under the saucer with the deflector at its front
    d.rounded_rectangle([P(-78, 110), P(78, 480)], radius=70 * s, fill=HULL_DARK)
    d.rounded_rectangle([P(-50, 440), P(50, 480)], radius=16 * s, fill=HULL_DEEP)
    d.ellipse([P(-46, 120), P(46, 200)], fill=DEFLECTOR)
    # saucer: a broad ellipse cut flat at the back
    d.ellipse([P(-330, -300), P(330, 170)], fill=HULL)
    d.rectangle([P(-340, 90), P(340, 180)], fill=(0, 0, 0, 0))
    d.ellipse([P(-330, -300), P(330, 170)], fill=None)
    # re-cut the flat trailing edge as a shallow arc so it reads as a hull, not a crop
    d.chord([P(-330, -300), P(330, 170)], 180, 360, fill=HULL)
    d.pieslice([P(-330, -300), P(330, 170)], 0, 180, fill=HULL)
    d.rectangle([P(-340, 92), P(340, 180)], fill=(0, 0, 0, 0))
    # the orange band around the saucer rim, and the lighter inner saucer
    d.ellipse([P(-330, -300), P(330, 170)], outline=STRIPE, width=int(22 * s))
    d.rectangle([P(-340, 92), P(340, 180)], fill=(0, 0, 0, 0))
    d.ellipse([P(-262, -250), P(262, 120)], fill=HULL_LIGHT)
    d.rectangle([P(-340, 92), P(340, 180)], fill=(0, 0, 0, 0))
    d.rounded_rectangle([P(-330, 84), P(330, 96)], radius=6 * s, fill=HULL_DEEP)
    # bridge module and running lights
    d.ellipse([P(-40, -140), P(40, -60)], fill=HULL_DARK)
    d.ellipse([P(-26, -126), P(26, -74)], fill=HULL)
    d.ellipse([P(-300, -40), P(-272, -12)], fill=(236, 72, 72))
    d.ellipse([P(272, -40), P(300, -12)], fill=(72, 220, 128))
    return img


def _shade(img: Image.Image) -> Image.Image:
    """Light from the upper left: brighten towards it, darken away from it, within the ship's alpha."""
    arr = np.asarray(img).astype(np.float32)
    h, w = arr.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    t = (xs / w + ys / h) / 2  # 0 at the top-left corner, 1 at the bottom-right
    k = (1.18 - 0.42 * t)[..., None]
    rgb = np.clip(arr[..., :3] * k, 0, 255)
    return Image.fromarray(np.concatenate([rgb, arr[..., 3:4]], axis=2).astype(np.uint8), "RGBA")


def _tilt(img: Image.Image) -> Image.Image:
    """Rotate into a three-quarter heading and squash vertically for a view from above."""
    rot = img.rotate(VIEW_ROTATE, resample=Image.BICUBIC, expand=False)
    w, h = rot.size
    tilted = rot.resize((w, max(1, int(h * VIEW_SQUASH))), Image.LANCZOS)
    box = tilted.getbbox() or (0, 0, w, h)
    ship = tilted.crop(box)
    k = SHIP_SCALE * img.width / max(ship.width, ship.height)
    return ship.resize((max(1, int(ship.width * k)), max(1, int(ship.height * k))), Image.LANCZOS)


def lower_decks_disc(size: int) -> np.ndarray:
    """The Lower Decks show icon as an RGBA disc of ``size`` px: the Cerritos on the dark socket disc."""
    big = DRAW_SIZE
    disc = _disc(big)
    ship = _tilt(_shade(_ship_top_down(big)))
    # a soft shadow under the ship lifts it off the disc
    shadow = Image.new("RGBA", ship.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 150), (0, 0), ship.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(big * 0.012))
    ox = (big - ship.width) // 2
    oy = (big - ship.height) // 2
    disc.alpha_composite(shadow, (ox + int(big * 0.012), oy + int(big * 0.02)))
    disc.alpha_composite(ship, (ox, oy))
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    disc.putalpha(mask)
    small = disc.resize((size, size), Image.LANCZOS)
    return np.asarray(small).copy()


DRAWN_OTHER_ICONS = {"lower-decks": lower_decks_disc}
