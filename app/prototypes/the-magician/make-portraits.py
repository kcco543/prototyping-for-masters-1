"""
Build circle-ready cat portraits for The Magician.

For each cat:
1. (4.jpg only) remove watermark text/logos by masking greyish pixels inside
   hand-marked zones and inpainting them from the surrounding colours.
2. Find the cat's pixels (everything that isn't background near the original
   crop box), including small parts close to the cat (flower, skateboard...).
3. Erase neighbouring cats/fragments that poke into view (inpaint).
4. Compute the smallest circle that encloses the cat, then export a square
   image where that circle is 90% of the frame's radius, centred.
"""
import sys
import cv2
import numpy as np

SRC, OUT, DEBUG = sys.argv[1], sys.argv[2], sys.argv[3]
SIZE = 640
CAT_RADIUS = 0.45 * SIZE  # cat's enclosing circle radius in the output (frame radius is 0.5)

# name: (source, crop box x, y, w, h) — the crops approved earlier
CATS = {
    "scholar": ("3.webp", 140, 290, 232, 268),
    "romantic": ("5.jpg", 146, 96, 302, 236),
    "night-loaf": ("3.webp", 548, 568, 364, 192),
    "showstopper": ("4.jpg", 282, 287, 177, 188),
    "skyscraper": ("4.jpg", 461, 11, 160, 175),
    "stroller": ("5.jpg", 396, 1048, 302, 204),
    "librarian": ("5.jpg", 190, 330, 166, 366),
    "outline": ("3.webp", 715, 1425, 222, 282),
    "pixel-skater": ("5.jpg", 146, 948, 238, 310),
    "avant-garde": ("4.jpg", 10, 6, 148, 164),
    "athlete": ("3.webp", 702, 1703, 316, 264),
    "aristocrat": ("3.webp", 332, 1120, 212, 272),
}


def grey_rule(hsv):
    """Watermark = grey over black, or darkened cream (same saturation, lower brightness)."""
    s, v = hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    return ((s < 70) & (v > 38) & (v < 205)) | ((s < 48) & (v > 150) & (v < 238))


def ring_rule(hsv):
    """Faint watermark rings on the red body: a little less saturated, not bright like the fur dashes."""
    s, v = hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    return ((s > 125) & (s < 178) & (v > 120) & (v < 222)) | grey_rule(hsv)


def clean_watermarks(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    zones = np.zeros(img.shape[:2], np.uint8)
    rings = np.zeros(img.shape[:2], np.uint8)
    # Skyscraper: diagonal "shutterstock" + logo tiles in two corners
    cv2.line(zones, (484, 150), (594, 44), 255, 30)
    cv2.rectangle(zones, (602, 3), (630, 34), 255, -1)
    cv2.rectangle(zones, (604, 156), (630, 192), 255, -1)
    # Showstopper: contributor name on the right, (c) mark on the left, logo tile bottom-left
    cv2.rectangle(zones, (436, 298), (464, 348), 255, -1)
    cv2.rectangle(zones, (278, 308), (298, 350), 255, -1)
    cv2.rectangle(zones, (276, 452), (300, 482), 255, -1)
    # Avant-Garde: logo square on the tail, corner tile, faint rings on the body
    cv2.rectangle(zones, (16, 84), (38, 114), 255, -1)
    cv2.rectangle(zones, (150, 0), (170, 20), 255, -1)
    for (cx, cy, r) in [(125, 62, 10), (125, 99, 9), (76, 139, 7), (112, 18, 8), (80, 30, 7)]:
        cv2.circle(rings, (cx, cy), r, 255, -1)

    # Avant-Garde: pale strokes of the logo tile sitting on the orange tail
    tail = np.zeros(img.shape[:2], np.uint8)
    cv2.rectangle(tail, (29, 88), (41, 107), 255, -1)
    pale = (hsv[..., 2] > 190) & (hsv[..., 1] < 110)

    mask = (grey_rule(hsv) & (zones > 0)) | (ring_rule(hsv) & (rings > 0)) | (pale & (tail > 0))
    mask = mask.astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)
    cv2.imwrite(f"{DEBUG}/wm_mask.png", mask)
    out = repaint(img, mask > 0)

    # Shape repair: the watermark clipped the top-left corner of the
    # Skyscraper's pink leg. Inside the leg's true outline, flagged pixels
    # become pink; just outside it, they become the body's black. Unflagged
    # pixels (the leg's printed dots) are left exactly as they were.
    leg = np.zeros(mask.shape, np.uint8)
    cv2.ellipse(leg, (523, 131), (7, 7), 0, 180, 360, 255, -1, cv2.LINE_AA)
    cv2.rectangle(leg, (516, 131), (530, 144), 255, -1)
    zone = np.zeros(mask.shape, bool)
    zone[116:147, 510:537] = True
    flagged = zone & (mask > 0)
    pink = np.median(img[136:143, 519:528].reshape(-1, 3), axis=0)
    black = np.median(img[150:160, 500:510].reshape(-1, 3), axis=0)
    a = (leg.astype(np.float32) / 255)[..., None]  # soft edge from the anti-aliased outline
    blend = (a * pink + (1 - a) * black).astype(np.uint8)
    out[flagged] = blend[flagged]

    # Skyscraper outline: where the diagonal text crossed the body's edge,
    # the fill left small bumps. Smooth the black silhouette (open + close
    # with a round brush) and apply it only to pixels we changed.
    band = np.zeros(mask.shape, np.uint8)
    cv2.line(band, (484, 150), (594, 44), 255, 30)
    changed = (band > 0) & (mask > 0) & ~zone
    dark = (cv2.cvtColor(out, cv2.COLOR_BGR2GRAY) < 90).astype(np.uint8)
    brush = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    smooth = cv2.morphologyEx(cv2.morphologyEx(dark, cv2.MORPH_OPEN, brush), cv2.MORPH_CLOSE, brush)
    cream = np.median(img[20:30, 470:480].reshape(-1, 3), axis=0)
    to_cream = changed & (dark > 0) & (smooth == 0)
    to_black = changed & (dark == 0) & (smooth > 0) & (hsv[..., 1] < 70)
    out[to_cream] = cream
    out[to_black] = black

    # Avant-Garde: flagged pixels left of the tail's edge belong to the cream background
    left_of_tail = np.zeros(mask.shape, bool)
    left_of_tail[84:114, 16:28] = True
    out[left_of_tail & (mask > 0)] = np.median(img[60:70, 12:20].reshape(-1, 3), axis=0)

    # Avant-Garde tail: the tail is a soft, plain orange, so regular
    # inpainting (smooth blending) looks more natural there than a flat fill.
    tail_fix = (pale & (tail > 0)) | (grey_rule(hsv) & (tail > 0))
    tail_fix = cv2.dilate(tail_fix.astype(np.uint8) * 255, np.ones((3, 3), np.uint8))
    out = cv2.inpaint(out, tail_fix, 3, cv2.INPAINT_TELEA)
    return out


def repaint(img, mask, K=12, R=7):
    """
    Edge-preserving fill: every masked pixel takes the colour that is most
    common among its clean neighbours (so a pixel next to the black body
    becomes black, one in open cream becomes cream). Normal inpainting
    blends across edges and leaves grey smudges.
    """
    out = img.copy()
    ys, xs = np.nonzero(mask)
    y0, y1 = max(0, ys.min() - R * 3), min(img.shape[0], ys.max() + R * 3)
    x0, x1 = max(0, xs.min() - R * 3), min(img.shape[1], xs.max() + R * 3)
    region = img[y0:y1, x0:x1].reshape(-1, 3).astype(np.float32)
    clean = ~mask[y0:y1, x0:x1].reshape(-1)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 1.0)
    _, _, centers = cv2.kmeans(region[clean], K, None, crit, 3, cv2.KMEANS_PP_CENTERS)
    labels = np.argmin(((img.reshape(-1, 1, 3).astype(np.float32) - centers[None]) ** 2).sum(2), 1).reshape(img.shape[:2])
    H, W = mask.shape
    for y, x in zip(ys, xs):
        r = R
        while True:
            a, b, c, d = max(0, y - r), min(H, y + r + 1), max(0, x - r), min(W, x + r + 1)
            ok = ~mask[a:b, c:d]
            if ok.sum() >= 6 or r > 30:
                break
            r += 3
        yy, xx = np.nonzero(ok)
        dist = np.hypot(yy + a - y, xx + c - x) + 0.5
        labs = labels[a:b, c:d][ok]
        votes = np.bincount(labs, weights=1 / dist, minlength=K)
        best = votes.argmax()
        out[y, x] = np.median(img[a:b, c:d][ok][labs == best], axis=0)
    # soften the filled pixels very slightly so they sit in with the JPEG texture
    blur = cv2.medianBlur(out, 3)
    out[mask] = blur[mask]
    return out


def portrait(name, src, img, x, y, w, h):
    H, W = img.shape[:2]
    bg = img[y + 3, x + 3].astype(int)

    # Work in a window a bit bigger than the crop box
    pad = int(max(w, h) * 0.6)
    X0, Y0 = max(0, x - pad), max(0, y - pad)
    X1, Y1 = min(W, x + w + pad), min(H, y + h + pad)
    win = img[Y0:Y1, X0:X1].copy()
    bx, by = x - X0, y - Y0

    # Foreground = noticeably different from the background colour
    lab = cv2.cvtColor(win, cv2.COLOR_BGR2LAB).astype(int)
    bg_lab = cv2.cvtColor(np.uint8([[bg]]), cv2.COLOR_BGR2LAB)[0, 0].astype(int)
    # On the cream illustration (4.jpg) white is very close to the background,
    # so a lower threshold keeps white stripes as part of the cat.
    threshold = 9 if src == "4.jpg" else 22
    fg = (np.linalg.norm(lab - bg_lab, axis=2) > threshold).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))

    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
    inbox = np.zeros_like(fg)
    inbox[by:by + h, bx:bx + w] = 1

    # Main cat = biggest component that is mostly inside the crop box
    best, best_area = 0, 0
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        inside = (inbox[labels == i]).mean()
        if inside > 0.6 and area > best_area:
            best, best_area = i, area
    cat = (labels == best).astype(np.uint8)

    # Add nearby parts (flower, skateboard, whisker tips…) within 7px of the cat
    # (repeat until nothing new joins, so a chain of stripes all counts)
    added = True
    while added:
        added = False
        near = cv2.dilate(cat, np.ones((15, 15), np.uint8))
        for i in range(1, n):
            comp = labels == i
            if cat[comp].any():
                continue
            if near[comp].any() and inbox[comp].mean() > 0.5 and stats[i, cv2.CC_STAT_AREA] < best_area:
                cat[comp] = 1
                added = True

    # Erase anything that is mostly outside the crop box (neighbouring cats)
    erase = np.zeros_like(fg)
    for i in range(1, n):
        comp = labels == i
        if cat[comp].any():
            continue
        if inbox[comp].mean() < 0.6:
            erase[comp] = 1
    erase = cv2.dilate(erase, np.ones((5, 5), np.uint8)) & (1 - cv2.dilate(cat, np.ones((3, 3), np.uint8)))
    if erase.any():
        win[erase > 0] = bg
        edge = cv2.dilate(erase, np.ones((5, 5), np.uint8)) - cv2.erode(erase, np.ones((3, 3), np.uint8))
        win = cv2.inpaint(win, edge * 255, 2, cv2.INPAINT_TELEA)

    # Smallest circle around the cat
    pts = cv2.findNonZero(cat)
    (cx, cy), r = cv2.minEnclosingCircle(pts)
    k = CAT_RADIUS / r
    # Affine map: window coords -> output, cat circle centre -> output centre
    M = np.float32([[k, 0, SIZE / 2 - cx * k], [0, k, SIZE / 2 - cy * k]])
    out = cv2.warpAffine(win, M, (SIZE, SIZE), flags=cv2.INTER_CUBIC if k > 1 else cv2.INTER_AREA,
                         borderMode=cv2.BORDER_CONSTANT, borderValue=tuple(int(c) for c in bg))
    cv2.imwrite(f"{OUT}/{name}.webp", out, [cv2.IMWRITE_WEBP_QUALITY, 90])

    # Debug preview: output with the frame circle (black) and cat circle (red)
    dbg = out.copy()
    cv2.circle(dbg, (SIZE // 2, SIZE // 2), SIZE // 2 - 1, (0, 0, 0), 2)
    cv2.circle(dbg, (SIZE // 2, SIZE // 2), int(CAT_RADIUS), (0, 0, 255), 1)
    mask_out = cv2.warpAffine(cat * 255, M, (SIZE, SIZE), flags=cv2.INTER_NEAREST)
    yy, xx = np.nonzero(mask_out)
    far = np.sqrt((xx - SIZE / 2) ** 2 + (yy - SIZE / 2) ** 2).max()
    cv2.imwrite(f"{DEBUG}/p_{name}.jpg", dbg)
    print(f"{name:14} scale x{k:.2f}  farthest cat pixel = {far / (SIZE / 2) * 100:.1f}% of frame radius  erased={int(erase.sum())}px")


sources = {}
for name, (src, x, y, w, h) in CATS.items():
    if src not in sources:
        img = cv2.imread(f"{SRC}/{src}")
        if src == "4.jpg":
            img = clean_watermarks(img)
            cv2.imwrite(f"{DEBUG}/4_clean.png", img)
        sources[src] = img
    portrait(name, src, sources[src], x, y, w, h)
