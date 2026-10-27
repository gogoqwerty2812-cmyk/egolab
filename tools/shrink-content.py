# Make data/content.json small again: pull the photos that the admin embeds
# inside it (long "data:image/...;base64,..." strings) out into real image
# files under assets/img/products/, and put the short file path in their place.
#
# Nothing else in the file changes: names, prices, descriptions, reviews,
# settings, order of products — all stay exactly as they were. The script
# checks this itself before saving and refuses to save if anything differs.
# Photos keep their size; they are only re-encoded as WebP (much lighter).
#
# Usage (double-click tools\shrink-content.bat, or):
#   python tools/shrink-content.py                       # shrinks data/content.json
#   python tools/shrink-content.py data/other.json       # any other file
#
# A copy of the original is saved to backups/ first (backups/ is not committed).
# It prints only counts and sizes — never the contents of the file.
import base64, hashlib, json, re, shutil, sys, time
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "assets" / "img" / "products"
IMG_URL = "assets/img/products"          # how the site refers to them (pages live at the root)
DATA_URI = re.compile(r"^data:(image/[a-z0-9.+-]+)(;[^,]*)?,(.*)$", re.I | re.S)
RAW_EXT = {"image/svg+xml": "svg", "image/gif": "gif", "image/png": "png", "image/jpeg": "jpg",
           "image/jpg": "jpg", "image/webp": "webp", "image/avif": "avif"}

try:
    from PIL import Image
except ImportError:
    Image = None


def to_file(uri):
    """Write one data: URI to assets/img/products and return its site path."""
    m = DATA_URI.match(uri)
    mime, params, payload = m.group(1).lower(), (m.group(2) or "").lower(), m.group(3)
    if ";base64" in params:
        raw = base64.b64decode(payload)
    else:  # URL-encoded (usually SVG)
        from urllib.parse import unquote_to_bytes
        raw = unquote_to_bytes(payload)

    data, ext = raw, RAW_EXT.get(mime, "bin")
    # SVG and (possibly animated) GIF stay as they are; photos become WebP
    if Image and mime not in ("image/svg+xml", "image/gif"):
        try:
            im = Image.open(BytesIO(raw))
            im.load()
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGBA" if "A" in im.getbands() or "transparency" in im.info else "RGB")
            buf = BytesIO()
            im.save(buf, "WEBP", quality=85, method=6)
            if buf.tell() < len(raw):
                data, ext = buf.getvalue(), "webp"
        except Exception:
            pass  # unreadable by Pillow — keep the original bytes

    # name = hash of the picture, so the same photo is stored once and
    # re-running the script never creates duplicates
    name = f"{hashlib.sha1(raw).hexdigest()[:16]}.{ext}"
    path = IMG_DIR / name
    if not path.exists():
        path.write_bytes(data)
    return f"{IMG_URL}/{name}", len(data)


def walk(node, stats):
    """Return a copy of node with every data:image string replaced by a file path."""
    if isinstance(node, dict):
        return {k: walk(v, stats) for k, v in node.items()}
    if isinstance(node, list):
        return [walk(v, stats) for v in node]
    if isinstance(node, str) and DATA_URI.match(node):
        url, size = to_file(node)
        stats["images"] += 1
        stats["bytes"] += size
        stats["map"][url] = node
        return url
    return node


def same_except_images(a, b, mapping):
    """True if b equals a, except image strings that were swapped for their files."""
    if isinstance(a, dict):
        return isinstance(b, dict) and list(a) == list(b) and all(same_except_images(a[k], b[k], mapping) for k in a)
    if isinstance(a, list):
        return isinstance(b, list) and len(a) == len(b) and all(same_except_images(x, y, mapping) for x, y in zip(a, b))
    if isinstance(a, str) and isinstance(b, str) and a != b:
        return mapping.get(b) == a
    return a == b and type(a) is type(b)


def mb(n):
    return f"{n / 1024 / 1024:.2f} MB" if n >= 1024 * 1024 else f"{n / 1024:.0f} KB"


def main():
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "content.json"
    if not target.is_absolute():
        target = (Path.cwd() / target).resolve()
    if not target.exists():
        sys.exit(f"Файл не найден: {target}")

    text = target.read_text(encoding="utf-8-sig")
    before = len(text.encode("utf-8"))
    try:
        original = json.loads(text)
    except json.JSONDecodeError as e:
        sys.exit(f"Файл повреждён (не JSON), ничего не меняю. Строка {e.lineno}, позиция {e.colno}.")

    if Image is None:
        print("Внимание: Pillow не установлен — фото сохранятся как есть, без сжатия в WebP.")
        print("          Установить: python -m pip install pillow")

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    stats = {"images": 0, "bytes": 0, "map": {}}
    slim = walk(original, stats)

    if stats["images"] == 0:
        print(f"Встроенных картинок нет — файл уже лёгкий ({mb(before)}). Ничего не менял.")
        return

    # safety: everything except the image strings must be identical
    if not same_except_images(original, slim, stats["map"]):
        sys.exit("Проверка не прошла — данные отличаются. Ничего не сохранил.")
    for url in stats["map"]:
        if not (ROOT / url).exists():
            sys.exit(f"Не удалось записать картинку {url}. Ничего не сохранил.")

    backup_dir = ROOT / "backups"
    backup_dir.mkdir(exist_ok=True)
    backup = backup_dir / f"{target.stem}.{time.strftime('%Y%m%d-%H%M%S')}.json"
    shutil.copy2(target, backup)

    out = json.dumps(slim, ensure_ascii=False, indent=2)  # same layout as the admin's Export all
    tmp = target.with_suffix(".tmp")
    tmp.write_text(out, encoding="utf-8")
    if json.loads(tmp.read_text(encoding="utf-8")) != slim:
        tmp.unlink()
        sys.exit("Проверка записи не прошла. Оригинал не тронут.")
    tmp.replace(target)

    after = len(out.encode("utf-8"))
    print("Готово!")
    print(f"  Картинок вынесено:  {stats['images']}  (в assets/img/products, всего {mb(stats['bytes'])})")
    print(f"  {target.name}:  {mb(before)}  ->  {mb(after)}")
    print(f"  Копия оригинала:    backups/{backup.name}")
    print("Дальше: git add -A  ->  git commit  ->  git push  (картинки тоже нужно закоммитить).")


if __name__ == "__main__":
    main()
