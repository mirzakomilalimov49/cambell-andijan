#!/usr/bin/env python3
"""
Sync news from lzgtnet.com into assets/data/news.json
Run: python scripts/sync-news.py
Translates EN content to UZ and RU via MyMemory API (free tier).
"""
import json
import os
import re
import time
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NEWS_JSON = ROOT / "assets" / "data" / "news.json"
NEWS_IMG_DIR = ROOT / "assets" / "images" / "news"
BASE = "https://www.lzgtnet.com"
LIST_URL = f"{BASE}/news/news.php?class1=48&lang=en"
UA = "Mozilla/5.0 (compatible; CambellNewsSync/1.0)"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "ignore")


def strip_html(html):
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_paragraphs(html):
    parts = re.split(r"</p>\s*<p[^>]*>", html, flags=re.I)
    paras = []
    for p in parts:
        t = strip_html(p)
        if len(t) > 20:
            paras.append(t)
    if not paras:
        t = strip_html(html)
        if t:
            paras = [t]
    return paras


def translate(text, target):
    if not text or len(text) < 2:
        return text
  # MyMemory limit ~500 chars per request; chunk if needed
    chunks = []
    words = text.split()
    buf = []
    for w in words:
        buf.append(w)
        if len(" ".join(buf)) > 450:
            chunks.append(" ".join(buf))
            buf = []
    if buf:
        chunks.append(" ".join(buf))

    out = []
    for chunk in chunks:
        q = urllib.parse.quote(chunk[:500])
        url = f"https://api.mymemory.translated.net/get?q={q}&langpair=en|{target}"
        try:
            data = json.loads(fetch(url))
            out.append(data.get("responseData", {}).get("translatedText", chunk))
        except Exception:
            out.append(chunk)
        time.sleep(0.35)
    return " ".join(out)


def translate_paragraphs(paras, target):
    return [translate(p, target) for p in paras]


def resolve_image_url(src):
    if not src:
        return ""
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("http"):
        return src
    if src.startswith("/"):
        return BASE + src
    return urllib.parse.urljoin(BASE + "/news/", src)


def fetch_list_thumbnails():
    html = fetch(LIST_URL)
    thumbs = {}
    for m in re.finditer(
        r'<a[^>]+href=["\'][^"\']*shownews\.php\?id=(\d+)[^"\']*["\'][^>]*>(.*?)</a>',
        html,
        re.S | re.I,
    ):
        aid, inner = m.group(1), m.group(2)
        img = re.search(r'src=["\']([^"\']+)["\']', inner, re.I)
        if img:
            thumbs[aid] = resolve_image_url(img.group(1))
    return thumbs


def download_image(src, article_id):
    src = resolve_image_url(src)
    if not src:
        return f"assets/images/news/news1.png"

    ext = os.path.splitext(urllib.parse.urlparse(src).path)[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        ext = ".jpg"
    fname = f"article-{article_id}{ext}"
    dest = NEWS_IMG_DIR / fname
    try:
        req = urllib.request.Request(src, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        if len(data) < 5000:
            raise ValueError("image too small")
        dest.write_bytes(data)
    except Exception as e:
        print(f"  Image download failed {src}: {e}")
        for fallback in [f"assets/images/news/news{(int(article_id) % 4) or 1}.png",
                         "assets/images/news/news1.png"]:
            fb = ROOT / fallback.replace("/", os.sep)
            if fb.exists():
                return fallback
        return "assets/images/news/news1.png"
    return f"assets/images/news/{fname}"


def parse_article(article_id, list_thumb=""):
    url = f"{BASE}/news/shownews.php?id={article_id}&lang=en"
    html = fetch(url)

    title_m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S | re.I)
    title = strip_html(title_m.group(1)) if title_m else f"News {article_id}"

    date, views = "", "0"
    info_m = re.search(r'<div class="info font-weight-300">(.*?)</div>', html, re.S | re.I)
    if info_m:
        spans = re.findall(r"<span[^>]*>(.*?)</span>", info_m.group(1), re.S | re.I)
        for span in spans:
            t = strip_html(span)
            dm = re.search(r"(\d{4}-\d{2}-\d{2})", t)
            if dm:
                date = dm.group(1).replace("-", "/")
            if re.match(r"^\d+$", t):
                views = t

    start = html.find('class="met-editor')
    body_html = ""
    if start >= 0:
        sub = html[start : start + 20000]
        end_m = re.search(
            r'<div class="(met-page|tag|sidebar|recommend|news_bar)',
            sub,
            re.I,
        )
        block = sub[: end_m.start()] if end_m else sub
        body_html = block

    paragraphs_en = []
    for p in re.findall(r"<p[^>]*>(.*?)</p>", body_html, re.S | re.I):
        t = strip_html(p)
        if len(t) > 25:
            paragraphs_en.append(t)

    if not paragraphs_en and body_html:
        t = strip_html(body_html)
        if len(t) > 25:
            paragraphs_en = [t]

    img_src = list_thumb
    if not img_src:
        imgs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', body_html, re.I)
        img_src = imgs[0] if imgs else ""
    image = download_image(img_src, article_id)

    summary_en = (
        paragraphs_en[0][:220] + ("..." if len(paragraphs_en[0]) > 220 else "")
        if paragraphs_en
        else title
    )

    slug = re.sub(r"[^a-z0-9]+", "-", title.lower())[:60].strip("-") or f"news-{article_id}"

    return {
        "id": article_id,
        "slug": slug,
        "category": "enterprise",
        "date": date,
        "views": views,
        "author": "Lanzhou Guangtong",
        "image": image,
        "sourceUrl": url,
        "en": {"title": title, "summary": summary_en, "body": paragraphs_en},
    }


def load_existing():
    if NEWS_JSON.exists():
        with open(NEWS_JSON, encoding="utf-8") as f:
            return json.load(f)
    return {"updatedAt": "", "articles": []}


def decode_entities(text):
    if not text:
        return text
    return unescape(text).replace("&#39;", "'").replace("&quot;", '"')


def needs_translation(old_article, parsed_en, lang):
    loc = old_article.get(lang, {}) if old_article else {}
    en = parsed_en
    if not en.get("title"):
        return False
    if not loc.get("title"):
        return True
    if not loc.get("body") and en.get("body"):
        return True
    if len(loc.get("body", [])) != len(en.get("body", [])):
        return True
    if loc.get("title") == en.get("title") and len(en.get("title", "")) > 15:
        return True
    if loc.get("summary") == en.get("summary") and len(en.get("summary", "")) > 30:
        return True
    return False


def merge_article(existing_by_id, parsed, do_translate=True):
    eid = parsed["id"]
    old = existing_by_id.get(eid, {})

    article = {
        "id": eid,
        "slug": parsed["slug"],
        "category": parsed.get("category", "enterprise"),
        "date": parsed["date"],
        "views": parsed["views"],
        "author": "Cambell Andijan",
        "image": parsed["image"],
        "sourceUrl": parsed["sourceUrl"],
        "en": parsed["en"],
        "uz": old.get("uz", {}),
        "ru": old.get("ru", {}),
    }

    en_changed = (
        not old.get("en")
        or old["en"].get("title") != parsed["en"]["title"]
        or old["en"].get("body") != parsed["en"]["body"]
    )

    should_translate_uz = needs_translation(old, parsed["en"], "uz")
    should_translate_ru = needs_translation(old, parsed["en"], "ru")

    if do_translate and (en_changed or should_translate_uz or should_translate_ru):
        print(f"  Auto-translating to UZ/RU...")
        if should_translate_uz or en_changed:
            article["uz"] = {
                "title": decode_entities(translate(parsed["en"]["title"], "uz")),
                "summary": decode_entities(translate(parsed["en"]["summary"], "uz")),
                "body": [decode_entities(translate(p, "uz")) for p in parsed["en"]["body"]],
            }
        if should_translate_ru or en_changed:
            article["ru"] = {
                "title": decode_entities(translate(parsed["en"]["title"], "ru")),
                "summary": decode_entities(translate(parsed["en"]["summary"], "ru")),
                "body": [decode_entities(translate(p, "ru")) for p in parsed["en"]["body"]],
            }
    elif old.get("uz"):
        article["uz"] = old["uz"]
        article["ru"] = old.get("ru", old["uz"])

    return article


def main():
    NEWS_IMG_DIR.mkdir(parents=True, exist_ok=True)
    NEWS_JSON.parent.mkdir(parents=True, exist_ok=True)

    print("Fetching news list...")
    list_html = fetch(LIST_URL)
    ids = sorted(set(re.findall(r"shownews\.php\?id=(\d+)", list_html)), key=int, reverse=True)
    thumbs = fetch_list_thumbnails()
    print(f"Found {len(ids)} articles: {ids}")

    existing = load_existing()
    existing_by_id = {a["id"]: a for a in existing.get("articles", [])}

    articles = []
    for i, aid in enumerate(ids):
        print(f"[{i+1}/{len(ids)}] Article {aid}...")
        try:
            parsed = parse_article(aid, thumbs.get(aid, ""))
            article = merge_article(existing_by_id, parsed, do_translate=True)
            articles.append(article)
        except Exception as e:
            print(f"  Error: {e}")
            if aid in existing_by_id:
                articles.append(existing_by_id[aid])

    data = {
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": LIST_URL,
        "articles": articles,
    }

    with open(NEWS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    update_sitemap(articles)
    print(f"Saved {len(articles)} articles to {NEWS_JSON}")


def update_sitemap(articles):
    sitemap = ROOT / "sitemap.xml"
    base = "https://cambell-andijan.uz"
    static_pages = [
        ("", "1.0"),
        ("about.html", "0.8"),
        ("patents.html", "0.6"),
        ("feedback.html", "0.6"),
        ("contact.html", "0.8"),
        ("product.html", "0.9"),
        ("news.html", "0.7"),
        ("join.html", "0.6"),
    ]
    today = time.strftime("%Y-%m-%d")
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for path, pri in static_pages:
        loc = f"{base}/{path}" if path else f"{base}/"
        lines.append(f"  <url><loc>{loc}</loc><lastmod>{today}</lastmod><priority>{pri}</priority></url>")
    for a in articles:
        lines.append(
            f'  <url><loc>{base}/news-detail.html?id={a["id"]}</loc><lastmod>{today}</lastmod><priority>0.6</priority></url>'
        )
    lines.append("</urlset>")
    sitemap.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Updated {sitemap}")


if __name__ == "__main__":
    main()
