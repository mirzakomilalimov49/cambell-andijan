#!/usr/bin/env python3
"""Retranslate news articles where UZ/RU still match English."""
import importlib.util
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NEWS_JSON = ROOT / "assets" / "data" / "news.json"

spec = importlib.util.spec_from_file_location("sync_news", ROOT / "scripts" / "sync-news.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def article_needs_retranslate(article, lang):
    en = article.get("en", {})
    loc = article.get(lang, {})
    if not en.get("title"):
        return False
    if not loc.get("title"):
        return True
    if loc.get("title") == en.get("title"):
        return True
    if loc.get("body") and en.get("body") and loc["body"][0] == en["body"][0]:
        return True
    return False


def retranslate_article(article, lang):
    en = article["en"]
    print(f"    -> {lang.upper()}")
    article[lang] = {
        "title": sync.decode_entities(sync.translate(en["title"], lang)),
        "summary": sync.decode_entities(sync.translate(en["summary"], lang)),
        "body": [sync.decode_entities(sync.translate(p, lang)) for p in en["body"]],
    }
    time.sleep(0.3)


def main():
    with open(NEWS_JSON, encoding="utf-8") as f:
        data = json.load(f)

    fixed = 0
    for i, article in enumerate(data["articles"], 1):
        needs_uz = article_needs_retranslate(article, "uz")
        needs_ru = article_needs_retranslate(article, "ru")
        if not needs_uz and not needs_ru:
            continue
        print(f"[{i}/{len(data['articles'])}] Retranslating article {article['id']}...")
        if needs_uz:
            retranslate_article(article, "uz")
        if needs_ru:
            retranslate_article(article, "ru")
        fixed += 1

    data["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with open(NEWS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Retranslated {fixed} articles -> {NEWS_JSON}")


if __name__ == "__main__":
    main()
