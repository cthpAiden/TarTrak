"""Write app-icon.png (1024x1024): dark square, amber ring, no dependencies."""
import struct, zlib, math

SIZE = 1024
BG = (20, 23, 28, 255)
RING = (240, 180, 41, 255)

def pixel(x, y):
    cx = cy = SIZE / 2
    r = math.hypot(x - cx, y - cy)
    if 300 <= r <= 380:
        return RING
    # heading tick pointing up
    if abs(x - cx) <= 28 and 60 <= y <= 330:
        return RING
    return BG

rows = []
for y in range(SIZE):
    row = bytearray([0])
    for x in range(SIZE):
        row.extend(pixel(x, y))
    rows.append(bytes(row))
raw = b"".join(rows)

def chunk(tag, data):
    c = struct.pack(">I", len(data)) + tag + data
    return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(raw, 9))
png += chunk(b"IEND", b"")
open("app-icon.png", "wb").write(png)
print("wrote app-icon.png")
