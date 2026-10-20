#!/usr/bin/env python3
"""Gera os ícones PNG do PWA sem dependências externas (zlib + struct)."""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")

TOP = (99, 102, 241)      # indigo
BOTTOM = (139, 92, 246)   # violeta
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sd_round_rect(px, py, x0, y0, w, h, r):
    """SDF de retângulo arredondado (IQ). Negativo = dentro."""
    cx, cy = x0 + w / 2.0, y0 + h / 2.0
    r = min(r, w / 2.0, h / 2.0)
    qx = abs(px - cx) - w / 2.0 + r
    qy = abs(py - cy) - h / 2.0 + r
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


def in_poly(x, y, pts):
    inside = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xint = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xint:
                inside = not inside
    return inside


def cap_shapes(size, scale=1.0):
    """Chapéu de formatura em coordenadas normalizadas (0..1), centralizado."""
    def sc(pts):
        out = []
        for x, y in pts:
            x = (x - 0.5) * scale + 0.5
            y = (y - 0.5) * scale + 0.5
            out.append((x * size, y * size))
        return out

    top = [(0.50, 0.27), (0.80, 0.41), (0.50, 0.55), (0.20, 0.41)]
    body = [(0.325, 0.455), (0.675, 0.455), (0.675, 0.60), (0.50, 0.675), (0.325, 0.60)]
    tassel = [(0.775, 0.42), (0.808, 0.42), (0.808, 0.685), (0.775, 0.685)]
    pom = []
    for i in range(48):
        a = 2 * math.pi * i / 48
        pom.append((0.7915 + 0.032 * math.cos(a), 0.715 + 0.032 * math.sin(a)))
    return [sc(p) for p in (top, body, tassel, pom)]


def render(size, maskable=False):
    px = bytearray()
    if maskable:
        inset, radius = 0.0, 0.0
        scale = 0.66
    else:
        inset, radius = size * 0.02, size * 0.23
        scale = 1.0

    shapes = cap_shapes(size, scale)
    x0 = y0 = inset
    side = size - 2 * inset

    for y in range(size):
        px.append(0)  # byte de filtro (None)
        for x in range(size):
            fx, fy = x + 0.5, y + 0.5
            if maskable:
                inside = True
            else:
                inside = sd_round_rect(fx, fy, x0, y0, side, side, radius) <= 0
            if not inside:
                px.extend((0, 0, 0, 0))
                continue

            color = lerp(TOP, BOTTOM, y / max(1, size - 1))
            for poly in shapes:
                if in_poly(fx, fy, poly):
                    color = WHITE
                    break
            px.extend((color[0], color[1], color[2], 255))

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(px), 9))
    png += chunk(b"IEND", b"")
    return png


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-180.png", 180, False),
        ("icon-maskable-512.png", 512, True),
    ]
    for name, size, maskable in jobs:
        path = os.path.join(OUT, name)
        with open(path, "wb") as f:
            f.write(render(size, maskable))
        print(f"{name}  {size}x{size}  {os.path.getsize(path)} bytes")


if __name__ == "__main__":
    main()
