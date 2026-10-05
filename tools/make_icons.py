# -*- coding: utf-8 -*-
"""生成 PWA 图标（紫渐变背景 + 白色麦克风图形），无需第三方库。"""
import struct, zlib, math, os

def make_png(path, size):
    W = H = size
    s = size / 512.0
    cx, cy, r = 256 * s, 205 * s, 100 * s

    def bg(x, y):
        t = (x + y) / (2 * size)
        return (int(0x63 + (0xa8 - 0x63) * t), int(0x66 + (0x55 - 0x66) * t), int(0xf1 + (0xf7 - 0xf1) * t), 255)

    def circle(ccx, ccy, rr, x, y):
        return (x - ccx) ** 2 + (y - ccy) ** 2 <= rr * rr

    def rrect(x0, y0, x1, y1, rad, x, y):
        if x < x0 or x > x1 or y < y0 or y > y1:
            return False
        nx = min(max(x, x0 + rad), x1 - rad)
        ny = min(max(y, y0 + rad), y1 - rad)
        return (x - nx) ** 2 + (y - ny) ** 2 <= rad * rad

    px = bytearray()
    for y in range(H):
        px.append(0)
        for x in range(W):
            X, Y = x + 0.5, y + 0.5
            if circle(cx, cy, r, X, Y):
                c = (255, 255, 255, 255)
            elif rrect(238 * s, 305 * s, 274 * s, 398 * s, 18 * s, X, Y):
                c = (255, 255, 255, 255)
            elif rrect(192 * s, 406 * s, 320 * s, 430 * s, 12 * s, X, Y):
                c = (255, 255, 255, 255)
            else:
                c = bg(x, y)
            px += bytes(c)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(bytes(px), 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print('written', path)

os.chdir(os.path.dirname(os.path.abspath(__file__)) + '/..')
make_png('icon-512.png', 512)
make_png('icon-192.png', 192)
