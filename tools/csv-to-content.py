# Convert catalog/products-catalog.csv into the admin's content.json format and
# MERGE it into the existing data/content.json (old products are kept).
#
# Usage:
#   python tools/csv-to-content.py                # writes data/content.new.json
#   python tools/csv-to-content.py --apply        # also replaces data/content.json (backup is made)
#   python tools/csv-to-content.py --csv other.csv --base data/content.json --out data/content.new.json
#
# Merge rules:
#   - every product in the old content.json stays untouched (except "csv-" products that
#     were removed from the CSV since the last run);
#   - a CSV row gets the stable id "csv-<slug-of-name>". Re-running the script
#     UPDATES that product (name, price, description, category) but keeps the
#     photos, stock, featured flag and createdAt you already set in the admin;
#   - new categories / subcategories are added to settings so they show up in the
#     admin form and catalog filter. certificates, reviews and other settings stay as-is.
#
# Afterwards: Admin -> Import all -> pick data/content.new.json, add photos,
# then Export all -> replace data/content.json -> commit and push.
# Also writes catalog/product-links.csv with the site link and supplier link of every product.
import argparse, csv, json, re, shutil, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_URL = "https://egolab.shop"

# CSV subcategory -> site category (names from SITE.categories in config.js, so category colours work)
CATEGORY_MAP = {
    "Protein": "Protein",
    "Creatine": "Creatine",
    "Amino acids": "Amino Acids",
    "Pre-workout": "Pre-workout supplements",  # already used by existing products
    "Gainer": "Mass Gainers",
    "Fat burners": "Fat Burners",
}
DEFAULT_CATEGORY = "Vitamins & Health"  # vitamins, minerals, omega-3, collagen, multivitamins...
DIRECT_CATEGORIES = {"Accessories", "Skincare"}  # CSV category used as-is
DEFAULT_STOCK = 99
SOLID_UNITS = re.compile(r"\b(tablets?|capsules?|softgels?|caps)\b", re.I)


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def build_description(row):
    vol = row["Volume / quantity"].strip()
    if row["Category"].strip() == "Accessories":
        label = "Size"
    else:
        label = "Quantity" if SOLID_UNITS.search(vol.split("·")[0]) else "Volume"
    parts = [f"{label}: {vol}", row["Description"].strip()]
    if row["How to use"].strip():
        parts.append("How to use: " + row["How to use"].strip())
    return "\n".join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=str(ROOT / "catalog" / "products-catalog.csv"))
    ap.add_argument("--base", default=str(ROOT / "data" / "content.json"))
    ap.add_argument("--out", default=str(ROOT / "data" / "content.new.json"))
    ap.add_argument("--apply", action="store_true", help="also replace data/content.json (backup is kept)")
    a = ap.parse_args()

    base_path = Path(a.base)
    content = json.loads(base_path.read_text(encoding="utf-8")) if base_path.exists() else {}
    content.setdefault("products", [])
    content.setdefault("certificates", [])
    content.setdefault("reviews", [])
    content.setdefault("settings", {})
    by_id = {p["id"]: p for p in content["products"] if p.get("id")}

    with open(a.csv, newline="", encoding="utf-8-sig") as f:
        rows = [r for r in csv.DictReader(f, delimiter=";") if (r.get("Name") or "").strip()]

    now = int(time.time() * 1000)
    added = updated = 0
    # drop products from an earlier run of this script that are no longer in the CSV
    csv_ids = {"csv-" + slugify(r["Name"].strip()) for r in rows}
    before = len(content["products"])
    content["products"] = [p for p in content["products"] if not str(p.get("id", "")).startswith("csv-") or p["id"] in csv_ids]
    pruned = before - len(content["products"])
    by_id = {p["id"]: p for p in content["products"] if p.get("id")}
    links = []
    new_cats, new_subs = [], []
    for i, r in enumerate(rows):
        name = r["Name"].strip()
        pid = "csv-" + slugify(name)
        sub = r["Subcategory"].strip()
        cat = r["Category"].strip() if r["Category"].strip() in DIRECT_CATEGORIES else CATEGORY_MAP.get(sub, DEFAULT_CATEGORY)
        fields = {
            "name": name,
            "description": build_description(r),
            "price": float(r["Price per unit (USD)"].replace(",", ".")),
            "category": cat,
            "subcategory": sub.lower(),
        }
        old = by_id.get(pid)
        if old:
            old.update(fields)
            old["updatedAt"] = now
            updated += 1
        else:
            p = {"id": pid, **fields, "featured": False, "stock": DEFAULT_STOCK,
                 "images": [], "createdAt": now - i, "updatedAt": now}
            content["products"].insert(0, p)
            by_id[pid] = p
            added += 1
        if cat not in new_cats:
            new_cats.append(cat)
        if sub and sub.lower() not in new_subs:
            new_subs.append(sub.lower())
        links.append([name, f"{SITE_URL}/product.html?id={pid}", r["Buy link"].strip(), r.get("Verify", "").strip()])

    st = content["settings"]
    cats = st.setdefault("categories", [])
    subs = st.setdefault("subcategories", [])
    cats.extend(c for c in new_cats if c not in cats)
    subs.extend(s for s in new_subs if s not in subs)
    st["updatedAt"] = now

    out = Path(a.out)
    out.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")

    links_path = ROOT / "catalog" / "product-links.csv"
    with open(links_path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["Name", "Product page on site", "Supplier / buy link", "Verify"])
        w.writerows(links)

    print(f"Added {added}, updated {updated}, removed old CSV items {pruned}, total products now {len(content['products'])}")
    print(f"Wrote {out}")
    print(f"Wrote {links_path}")

    if a.apply:
        target = ROOT / "data" / "content.json"
        if target.exists():
            backup = target.with_name(f"content.backup-{time.strftime('%Y%m%d-%H%M%S')}.json")
            shutil.copy2(target, backup)
            print(f"Backup: {backup}")
        shutil.copy2(out, target)
        print(f"Replaced {target}. In the admin press Import all with this file BEFORE editing anything there.")
    else:
        print("Next: Admin -> Import all -> choose data/content.new.json (or rerun with --apply).")


if __name__ == "__main__":
    sys.exit(main())
