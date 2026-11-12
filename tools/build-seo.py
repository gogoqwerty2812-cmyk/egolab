# Build the pages that search engines and AI assistants (ChatGPT, Claude,
# Perplexity, Gemini…) can read without running JavaScript:
#
#   blog/<slug>.html   articles, from blog/_src/<slug>.html (JSON header + HTML body)
#   blog/index.html    list of articles
#   p/<slug>.html      one static page per product, from data/content.json
#   p/index.html       all products by category
#   sitemap.xml        every public page, for Google Search Console / Bing
#   llms.txt           a plain-text map of the store for AI assistants
#
# Usage (tools\shrink-content.bat runs it automatically after shrinking):
#   python tools/build-seo.py                # everything
#   python tools/build-seo.py --no-products  # articles + sitemap + llms.txt only
#
# It prints only counts — never the contents of content.json.
# Add an article: copy any file in blog/_src/, change the header and the text,
# run the script, commit and push.
import html, json, re, shutil, sys
from urllib.parse import quote
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://egolab.shop"
NAME = "EgoLab"
TODAY = date.today().isoformat()
OG_IMAGE = f"{SITE}/assets/img/bg/gym-hero.jpg"
EMAIL = "egolab@mailfence.com"
TELEGRAM = "https://t.me/egolab_shop"
COUNTRIES = ["United States", "Canada", "United Kingdom", "Ireland", "Germany", "Austria", "Switzerland",
             "France", "Belgium", "Netherlands", "Spain", "Portugal", "Italy", "Poland", "Serbia", "Bulgaria", "Czechia"]
# public app pages for the sitemap (cart / checkout / order / admin stay out)
APP_PAGES = [("", "1.0"), ("reviews.html", "0.6"), ("certificates.html", "0.7"), ("support.html", "0.5")]

esc = lambda s: html.escape(str(s or ""), quote=True)


def absurl(path):
    """Public URL of a page. The live site serves pages without ".html"
    (/reviews.html -> 308 -> /reviews), so canonical/sitemap URLs must be the
    final ones, or Google reports them as "Page with redirect"."""
    path = re.sub(r"(^|/)index\.html(?=$|\?)", r"\1", path)   # blog/index.html -> blog/
    path = re.sub(r"\.html(?=$|\?)", "", path)
    return f"{SITE}/{path}"


def version():
    m = re.search(r"\?v=(\d+)", (ROOT / "index.html").read_text(encoding="utf-8"))
    return m.group(1) if m else "1"


def csp():
    m = re.search(r'<meta http-equiv="Content-Security-Policy"[^>]*>', (ROOT / "index.html").read_text(encoding="utf-8"))
    return m.group(0) if m else ""


def page(*, title, description, path, body, nav, og_type="website", image=OG_IMAGE, jsonld=()):
    """A full static HTML page with the site's look (header/footer added by static.js)."""
    v, url = version(), absurl(path)
    # "<" is escaped so a product name can never close the <script> tag
    ld = "\n".join(f'  <script type="application/ld+json">{json.dumps(x, ensure_ascii=False).replace("<", "\\u003c")}</script>'
                   for x in jsonld)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  {csp()}
  <base href="/">
  <meta name="theme-color" content="#F1ECE5">
  <link rel="icon" href="assets/img/logo-mark.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Russo+One&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/styles.css?v={v}">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description)}">
  <link rel="canonical" href="{url}">
  <meta property="og:site_name" content="{NAME}">
  <meta property="og:type" content="{og_type}">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{esc(image)}">
  <meta name="twitter:card" content="summary_large_image">
{ld}
  <script src="assets/js/theme-init.js?v={v}"></script>
</head>
<body data-keep-title data-nav="{nav}">
  <main class="container section" id="app">
{body}
  </main>
  <script type="module" src="assets/js/pages/static.js?v={v}"></script>
</body>
</html>
"""


def crumbs(items):
    links = " <span>/</span> ".join(f'<a href="{h}">{esc(t)}</a>' if h is not None else f"<span>{esc(t)}</span>" for t, h in items)
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": t, **({"item": absurl(h)} if h is not None else {})}
        for i, (t, h) in enumerate(items)]}
    return f'<nav class="crumbs" aria-label="Breadcrumb">{links}</nav>', ld


# ---- articles -----------------------------------------------------------------
def build_blog():
    src_dir, out_dir = ROOT / "blog" / "_src", ROOT / "blog"
    posts = []
    for f in sorted(src_dir.glob("*.html")):
        raw = f.read_text(encoding="utf-8")
        m = re.match(r"\s*<!--(.*?)-->(.*)", raw, re.S)
        if not m:
            print(f"  ! skipped {f.name}: no JSON header")
            continue
        meta, body = json.loads(m.group(1)), m.group(2).strip()
        meta["slug"] = f.stem
        meta["words"] = len(re.sub(r"<[^>]+>", " ", body).split())
        posts.append((meta, body))
    posts.sort(key=lambda p: p[0]["date"], reverse=True)

    for meta, body in posts:
        path = f"blog/{meta['slug']}.html"
        nav, crumb_ld = crumbs([("Home", ""), ("Articles", "blog/index.html"), (meta["title"], None)])
        minutes = max(2, round(meta["words"] / 220))
        faq = meta.get("faq") or []
        faq_html = ""
        if faq:
            faq_html = '<section class="faq"><h2>Frequently asked questions</h2>' + "".join(
                f"<details><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for q, a in faq) + "</section>"
        article_ld = {"@context": "https://schema.org", "@type": "Article", "headline": meta["title"],
                      "description": meta["description"], "datePublished": meta["date"],
                      "dateModified": meta.get("updated", meta["date"]), "image": OG_IMAGE,
                      "author": {"@type": "Organization", "name": NAME, "url": SITE},
                      "publisher": {"@type": "Organization", "name": NAME, "url": SITE,
                                    "logo": {"@type": "ImageObject", "url": f"{SITE}/assets/img/logo-mark.svg"}},
                      "mainEntityOfPage": absurl(path)}
        lds = [article_ld, crumb_ld]
        if faq:
            lds.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
                {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]})
        health = meta.get("tag") not in ("Store",)
        content = f"""    <article class="article">
      {nav}
      <p class="article__tag">{esc(meta.get('tag', ''))}</p>
      <h1>{esc(meta['title'])}</h1>
      <p class="article__meta"><time datetime="{meta['date']}">{date.fromisoformat(meta['date']).strftime('%d %b %Y')}</time> · {minutes} min read · {NAME}</p>
      {body}
      {faq_html}
      <aside class="article__cta"><p><strong>Shop lab-tested supplements at {NAME}.</strong> Ships to the US, UK and Europe; pay by card or crypto.</p><a class="btn btn--primary" href="p/index.html">Browse products</a></aside>
      {'<p class="article__note">This article is general information, not medical advice. Talk to a doctor before using supplements if you are pregnant, take medication or have a health condition.</p>' if health else ''}
    </article>"""
        (out_dir / f"{meta['slug']}.html").write_text(
            page(title=f"{meta['title']} | {NAME}", description=meta["description"], path=path,
                 body=content, nav="blog/index.html", og_type="article", jsonld=lds), encoding="utf-8")

    cards = "\n".join(
        f"""      <a class="post-card" href="blog/{m['slug']}.html"><span class="article__tag">{esc(m.get('tag', ''))}</span>
        <h2>{esc(m['title'])}</h2><p>{esc(m['description'])}</p><span class="post-card__more">Read →</span></a>"""
        for m, _ in posts)
    nav, crumb_ld = crumbs([("Home", ""), ("Articles", None)])
    content = f"""    <div class="article article--wide">
      {nav}
      <h1>Articles</h1>
      <p class="lead">Straight answers about protein, creatine, pre-workout and supplement quality — plus how shipping and payment work at {NAME}.</p>
      <div class="post-grid">
{cards}
      </div>
    </div>"""
    blog_ld = {"@context": "https://schema.org", "@type": "Blog", "name": f"{NAME} articles", "url": absurl("blog/index.html"),
               "blogPost": [{"@type": "BlogPosting", "headline": m["title"], "url": absurl(f"blog/{m['slug']}.html"),
                             "datePublished": m["date"]} for m, _ in posts]}
    (out_dir / "index.html").write_text(
        page(title=f"Articles — protein, creatine, pre-workout guides | {NAME}",
             description="Practical, evidence-based guides on protein, creatine and pre-workout, how to read supplement lab reports, and EgoLab shipping and payment.",
             path="blog/index.html", body=content, nav="blog/index.html", jsonld=[blog_ld, crumb_ld]), encoding="utf-8")
    return [m for m, _ in posts]


# ---- products -----------------------------------------------------------------
def slugify(s):
    return re.sub(r"-{2,}", "-", re.sub(r"[^a-z0-9]+", "-", str(s).lower())).strip("-") or "item"


def build_products():
    src = ROOT / "data" / "content.json"
    if not src.exists():
        print("  ! data/content.json not found — product pages skipped")
        return []
    data = json.loads(src.read_text(encoding="utf-8-sig"))
    items = data if isinstance(data, list) else data.get("products") or []
    out_dir = ROOT / "p"
    if out_dir.exists():
        shutil.rmtree(out_dir)          # p/ is fully generated — drop pages of removed products
    out_dir.mkdir()

    products, used, embedded = [], set(), 0
    for p in items:
        if not isinstance(p, dict) or not p.get("id") or not p.get("name"):
            continue
        slug = slugify(p["id"])
        while slug in used:
            slug += "-2"
        used.add(slug)
        imgs = [i for i in (p.get("images") or []) if isinstance(i, str) and i and not i.startswith("data:")]
        embedded += sum(1 for i in (p.get("images") or []) if isinstance(i, str) and i.startswith("data:"))
        try:
            price = float(p.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        stock = p.get("stock")
        in_stock = not (isinstance(stock, (int, float)) and stock <= 0)
        products.append({"id": str(p["id"]), "slug": slug, "name": str(p["name"]), "price": price,
                         "category": str(p.get("category") or "Other"), "sub": str(p.get("subcategory") or ""),
                         "desc": str(p.get("description") or ""), "img": imgs[0] if imgs else "", "in_stock": in_stock})

    for pr in products:
        path = f"p/{pr['slug']}.html"
        buy = f"product.html?id={quote(pr['id'], safe='')}"
        nav, crumb_ld = crumbs([("Home", ""), ("Products", "p/index.html"), (pr["category"], None)])
        desc_paras = "".join(f"<p>{esc(x)}</p>" for x in re.split(r"\n\s*\n|\n", pr["desc"]) if x.strip())
        summary = re.sub(r"\s+", " ", pr["desc"]).strip()
        meta_desc = (summary[:150].rsplit(" ", 1)[0] + "…") if len(summary) > 155 else summary
        meta_desc = meta_desc or f"{pr['name']} — {pr['category']} at {NAME}. Ships to the US, UK and Europe; pay by card or crypto."
        img_abs = f"{SITE}/{pr['img']}" if pr["img"] and not pr["img"].startswith("http") else pr["img"]
        product_ld = {"@context": "https://schema.org", "@type": "Product", "name": pr["name"], "sku": pr["id"],
                      "category": pr["category"], "description": summary[:5000] or pr["name"],
                      **({"image": img_abs} if img_abs else {}),
                      "offers": {"@type": "Offer", "url": absurl(buy), "priceCurrency": "USD",
                                 "price": f"{pr['price']:.2f}",
                                 "availability": "https://schema.org/" + ("InStock" if pr["in_stock"] else "OutOfStock"),
                                 "seller": {"@type": "Organization", "name": NAME}}}
        img_html = f'<img src="{esc(pr["img"])}" alt="{esc(pr["name"])}" loading="lazy">' if pr["img"] else ""
        content = f"""    <article class="pstatic">
      {nav}
      <div class="pstatic__grid">
        <div class="pstatic__media">{img_html}</div>
        <div>
          <p class="article__tag">{esc(pr['category'])}{(' · ' + esc(pr['sub'])) if pr['sub'] else ''}</p>
          <h1>{esc(pr['name'])}</h1>
          <p class="pstatic__price">${pr['price']:.2f} <span>{'In stock' if pr['in_stock'] else 'Out of stock'}</span></p>
          <a class="btn btn--primary btn--lg" href="{esc(buy)}">View &amp; buy</a>
          <p class="hint" style="margin-top:12px">Free shipping from $99 · ships to the US, UK and Europe · pay by card or crypto</p>
          <div class="pstatic__desc">{desc_paras}</div>
        </div>
      </div>
    </article>"""
        (ROOT / path).write_text(page(title=f"{pr['name']} — buy online | {NAME}", description=meta_desc, path=path,
                                      body=content, nav="index.html", og_type="product",
                                      image=img_abs or OG_IMAGE, jsonld=[product_ld, crumb_ld]), encoding="utf-8")

    by_cat = {}
    for pr in products:
        by_cat.setdefault(pr["category"], []).append(pr)
    sections = "\n".join(
        f'      <section><h2>{esc(cat)}</h2><ul class="plist">' + "".join(
            f'<li><a href="p/{pr["slug"]}.html">{esc(pr["name"])}</a> <span>${pr["price"]:.2f}</span></li>' for pr in lst)
        + "</ul></section>" for cat, lst in by_cat.items())
    nav, crumb_ld = crumbs([("Home", ""), ("Products", None)])
    content = f"""    <div class="article article--wide">
      {nav}
      <h1>All products</h1>
      <p class="lead">{len(products)} products: protein, creatine, pre-workout, vitamins and gym accessories. Prices in USD; free shipping from $99.</p>
{sections}
    </div>"""
    list_ld = {"@context": "https://schema.org", "@type": "ItemList", "name": f"{NAME} products",
               "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": absurl(f"p/{pr['slug']}.html"),
                                    "name": pr["name"]} for i, pr in enumerate(products)]}
    (out_dir / "index.html").write_text(
        page(title=f"All products — sports nutrition & gym accessories | {NAME}",
             description=f"Browse all {len(products)} EgoLab products: protein, creatine, pre-workout, vitamins and accessories. Ships to the US, UK and Europe.",
             path="p/index.html", body=content, nav="index.html", jsonld=[list_ld, crumb_ld]), encoding="utf-8")
    if embedded:
        print(f"  ! {embedded} photos are still embedded in content.json — run tools\\shrink-content.bat so they show on product pages")
    return products


def existing_products():
    """--no-products: reuse the product pages already in p/ (built earlier from
    content.json), so the sitemap and llms.txt keep listing them."""
    out = []
    for f in sorted((ROOT / "p").glob("*.html")):
        if f.name == "index.html":
            continue
        m = re.search(r'<script type="application/ld\+json">(\{"@context": "https://schema.org", "@type": "Product".*?)</script>',
                      f.read_text(encoding="utf-8"), re.S)
        if not m:
            continue
        ld = json.loads(m.group(1))
        out.append({"slug": f.stem, "name": ld.get("name", f.stem), "category": ld.get("category", "Other"),
                    "price": float(ld.get("offers", {}).get("price") or 0)})
    return out


# ---- sitemap + llms.txt ------------------------------------------------------
def build_sitemap(posts, products):
    urls = [(absurl(p), pr, TODAY) for p, pr in APP_PAGES]
    urls.append((absurl("blog/index.html"), "0.7", TODAY))
    urls += [(absurl(f"blog/{m['slug']}.html"), "0.8", m.get("updated", m["date"])) for m in posts]
    if products or (ROOT / "p" / "index.html").exists():
        urls.append((absurl("p/index.html"), "0.8", TODAY))
    urls += [(absurl(f"p/{pr['slug']}.html"), "0.7", TODAY) for pr in products]
    body = "\n".join(f"  <url><loc>{esc(u)}</loc><lastmod>{d}</lastmod><priority>{pr}</priority></url>" for u, pr, d in urls)
    (ROOT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{body}\n</urlset>\n',
        encoding="utf-8")
    return len(urls)


def build_llms(posts, products):
    lines = [f"# {NAME}", "",
             f"> {NAME} ({SITE}) is an online sports nutrition store selling protein, creatine, pre-workout, "
             "vitamins, recovery products and gym accessories, with third-party lab reports. "
             f"It ships to: {', '.join(COUNTRIES)}. Prices are in USD; shipping is a flat $17 and free from $99. "
             "Payment by card (Visa, Mastercard, American Express, Apple Pay, Google Pay; PayPal in some regions) "
             "or crypto (BTC, ETH, USDT on TRON/BNB Smart Chain/Solana, BNB, SOL, TRX, TON, XMR, LTC, DOGE). "
             "No account is needed to order.", "",
             "## Store",
             f"- [Catalog]({SITE}/): browse and buy products",
             f"- [All products]({absurl("p/index.html")}): static list of every product with price",
             f"- [Lab reports]({absurl("certificates.html")}): third-party test results",
             f"- [Shipping & payment FAQ]({absurl("blog/egolab-shipping-and-payment-faq.html")})",
             f"- [Support]({absurl("support.html")}): email {EMAIL}, Telegram {TELEGRAM}", "",
             "## Articles"]
    lines += [f"- [{m['title']}]({absurl(f"blog/{m['slug']}.html")}): {m['description']}" for m in posts]
    if products:
        lines += ["", "## Products"]
        by_cat = {}
        for pr in products:
            by_cat.setdefault(pr["category"], []).append(pr)
        for cat, lst in by_cat.items():
            lines += ["", f"### {cat}"] + [f"- [{pr['name']}]({absurl(f"p/{pr['slug']}.html")}): ${pr['price']:.2f}" for pr in lst]
    (ROOT / "llms.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    posts = build_blog()
    products = existing_products() if "--no-products" in sys.argv else build_products()
    n = build_sitemap(posts, products)
    build_llms(posts, products)
    print("SEO pages ready:")
    print(f"  articles:      {len(posts)}  (blog/)")
    print(f"  product pages: {len(products)}  (p/)" + ("  — kept as built, not rebuilt" if "--no-products" in sys.argv else ""))
    print(f"  sitemap.xml:   {n} URLs")
    print("  llms.txt:      updated")


if __name__ == "__main__":
    main()
