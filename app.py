"""GAMEPICK — catalog, randomizer and live OBS overlay for games and demos.

Steam search results is an undocumented storefront interface; handle errors gracefully.
"""
from __future__ import annotations

import os
import random
import re
import threading
import time
import math
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlparse

import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from live_vote import router as live_vote_router

BASE_DIR = Path(__file__).resolve().parent
app = FastAPI(title="GAMEPICK", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
app.include_router(live_vote_router)

STEAM_ENDPOINT = "https://store.steampowered.com/search/results/"
STEAM_SEARCH = "https://store.steampowered.com/search/"
PAGE_SIZE = 36
CACHE_SECONDS = 600
CACHE_LIMIT = 180
MAX_RANDOM_OFFSET = 3600
GAME_KINDS = {"demo": 10, "full": 998}

# Public Steam tag IDs. Tags represent user labels, not a game's sole genre.
GENRES: dict[str, dict[str, Any]] = {
    "all": {"name": "Все жанры", "tag": None},
    "action": {"name": "Экшен", "tag": 19},
    "adventure": {"name": "Приключения", "tag": 21},
    "horror": {"name": "Хорроры", "tag": 1667},
    "survival": {"name": "Выживание", "tag": 1662},
    "rpg": {"name": "RPG", "tag": 122},
    "shooter": {"name": "Шутеры", "tag": 1774},
    "strategy": {"name": "Стратегии", "tag": 9},
    "simulation": {"name": "Симуляторы", "tag": 599},
    "puzzle": {"name": "Головоломки", "tag": 1664},
    "platformer": {"name": "Платформеры", "tag": 1625},
    "racing": {"name": "Гонки", "tag": 699},
    "coop": {"name": "Кооператив", "tag": 1685},
    "roguelike": {"name": "Рогалики", "tag": 1716},
    "visual_novel": {"name": "Визуальные новеллы", "tag": 3799},
    "indie": {"name": "Инди", "tag": 492},
}
SORTS = {"relevance": "", "new": "Released_DESC", "popular": "Reviews_DESC", "name": "Name_ASC"}

_cache: dict[tuple[str, str, str, str, int], tuple[float, dict[str, Any]]] = {}
_cache_lock = threading.Lock()
_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://store.steampowered.com/search/",
})


class SteamUnavailable(Exception):
    """Steam isn't returning usable search results."""


def sanitize_image(url: str) -> str:
    if not url:
        return ""
    if url.startswith("//"):
        url = "https:" + url
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    valid = host == "steamstatic.com" or host.endswith(".steamstatic.com") or host == "akamaihd.net" or host.endswith(".akamaihd.net")
    return url if parsed.scheme == "https" and valid else ""


def parse_steam_html(html: str, kind: str = "demo") -> list[dict[str, str]]:
    """Extract game rows and allowlist media and target URLs."""
    soup = BeautifulSoup(html, "html.parser")
    games: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in soup.select("a.search_result_row"):
        title_el = item.select_one("span.title")
        if title_el is None:
            continue
        title = title_el.get_text(" ", strip=True)
        if not title:
            continue
        href = item.get("href", "")
        host = urlparse(href).hostname
        if host and host != "store.steampowered.com":
            continue
        match = re.search(r"/app/(\d+)(?:/|\?|$)", href)
        if match:
            app_id = match.group(1)
        else:
            app_id = (item.get("data-ds-appid") or "").split(",")[0].strip()
            if not app_id.isdigit():
                continue
        if app_id in seen:
            continue
        seen.add(app_id)
        image_el = item.select_one(".search_capsule img") or item.select_one("img")
        image = sanitize_image((image_el.get("src") or image_el.get("data-src") or "") if image_el else "")
        date_el = item.select_one(".search_released")
        date = date_el.get_text(" ", strip=True) if date_el else ""
        games.append({
            "id": app_id, "name": title[:180], "image": image,
            "date": date[:70], "url": f"https://store.steampowered.com/app/{app_id}/",
            "kind": kind,
        })
    return games


def release_year(value: str) -> int | None:
    """Year actually printed by Steam (not guessed from title or popularity)."""
    years = re.findall(r"(?<!\d)((?:19|20)\d{2})(?!\d)", str(value or ""))
    current = datetime.now(timezone.utc).year
    matches = [int(y) for y in years if 1980 <= int(y) <= current]
    return matches[-1] if matches else None


def read_year_range(request: Request) -> tuple[int | None, int | None]:
    raw_start = (request.query_params.get("year_from") or "").strip()
    raw_end = (request.query_params.get("year_to") or "").strip()
    if not raw_start and not raw_end:
        return None, None
    current = datetime.now(timezone.utc).year
    if (raw_start and not re.fullmatch(r"\d{4}", raw_start)) or (raw_end and not re.fullmatch(r"\d{4}", raw_end)):
        return None, None
    low, high = int(raw_start) if raw_start else 1980, int(raw_end) if raw_end else current
    if not (1980 <= low <= high <= current):
        return None, None
    return low, high


def game_matches_year(game: dict[str, str], years: tuple[int | None, int | None]) -> bool:
    if years[0] is None:
        return True
    year = release_year(game.get("date", ""))
    return year is not None and years[0] <= year <= years[1]


def scan_games_for_year(q: str, genres: list[str], mode: str, sort: str,
                        start: int, kind: str, years: tuple[int | None, int | None]) -> dict[str, Any]:
    # Steam search has no dependable year parameter. Scan bounded slices and report
    # these as partial matches, never total yearly counts or exhaustive results.
    search_pages = 2 if mode == 'any' and len(genres) > 1 else 5
    games: dict[tuple[str, str], dict[str, str]] = {}
    known_total = 0
    scanned = 0
    has_more = False
    failures = 0
    for i in range(search_pages):
        offset = start + i * PAGE_SIZE
        try:
            batch = fetch_multi_genres(q, genres, mode, sort, offset, kind)
        except SteamUnavailable:
            failures += 1
            continue
        scanned += 1
        known_total = max(known_total, int(batch.get('total', 0)))
        for item in batch['games']:
            if game_matches_year(item, years):
                games[(item['kind'], item['id'])] = item
        has_more = bool(batch.get('has_more', offset + PAGE_SIZE < int(batch.get('total', 0))))
        if not has_more or len(games) >= PAGE_SIZE:
            break
    if not scanned:
        raise SteamUnavailable('Каталог временно недоступен. Попробуй позже.')
    return {'games': list(games.values())[:PAGE_SIZE], 'total': len(games),
            'has_more': has_more, 'sampled_years': True,
            'scan_start': start, 'scan_next': start + scanned * PAGE_SIZE,
            'approximate_total': True, 'partial': failures > 0,
            'checked': scanned * PAGE_SIZE}


def _int_count(value: Any) -> int:
    found = re.sub(r"\D", "", str(value or ""))
    return min(int(found), 500000) if found else 0


def query_steam(q: str, genre: str, sort: str, start: int, kind: str = "demo") -> dict[str, Any]:
    """Query public Steam storefront's JSON search response with short cache."""
    cache_key = (kind, q.casefold(), genre, sort, start)
    now = time.monotonic()
    with _cache_lock:
        entry = _cache.get(cache_key)
        if entry and now - entry[0] < CACHE_SECONDS:
            return entry[1]

    params: dict[str, Any] = {
        "query": "", "start": start, "count": PAGE_SIZE,
        "dynamic_data": "", "sort_by": SORTS[sort],
        "category1": GAME_KINDS[kind], "infinite": 1,
        "l": "russian", "cc": "kz", "ndl": 1,
    }
    if q:
        params["term"] = q
    # Steam accepts comma-separated tags for narrowing by ALL selected tags.
    tag_ids = [str(GENRES[g]["tag"]) for g in genre.split(",")
               if g in GENRES and GENRES[g]["tag"]]
    if tag_ids:
        params["tags"] = ",".join(tag_ids)
    try:
        response = _session.get(STEAM_ENDPOINT, params=params, timeout=(7, 17))
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise SteamUnavailable("Каталог временно недоступен. Попробуй ещё раз позже.") from exc
    if not isinstance(payload, dict) or "results_html" not in payload:
        raise SteamUnavailable("Каталог вернул неизвестный ответ.")

    games = parse_steam_html(str(payload.get("results_html") or ""), kind)
    total = _int_count(payload.get("total_count"))
    if not total and games:
        total = start + len(games)
    result: dict[str, Any] = {"games": games, "total": total, "start": start}
    with _cache_lock:
        if len(_cache) >= CACHE_LIMIT:
            for key in sorted(_cache, key=lambda item: _cache[item][0])[: CACHE_LIMIT // 4]:
                _cache.pop(key, None)
        _cache[cache_key] = (time.monotonic(), result)
    return result


def read_filters(request: Request) -> tuple[str, str, str, str]:
    q = (request.query_params.get("q") or "").strip()[:90]
    genre = request.query_params.get("genre", "all")
    sort = request.query_params.get("sort", "relevance")
    kind = request.query_params.get("kind", "demo")
    if genre not in GENRES:
        genre = "all"
    if sort not in SORTS:
        sort = "relevance"
    if kind not in GAME_KINDS:
        kind = "demo"
    return q, genre, sort, kind


MAX_GENRE_SELECTION = 8


def read_genre_selection(request: Request) -> tuple[list[str], str]:
    """Validate 0–8 genre IDs; accept old single-genre links as well."""
    raw = request.query_params.get("genres")
    if raw is None:
        raw = request.query_params.get("genre", "all")
    ids: list[str] = []
    for item in raw.split(",")[:35]:
        genre = item.strip()
        if genre in GENRES and genre != "all" and genre not in ids:
            ids.append(genre)
        if len(ids) >= MAX_GENRE_SELECTION:
            break
    mode = request.query_params.get("genre_mode", "any")
    return ids, mode if mode in {"all", "any"} else "any"


def fetch_multi_genres(q: str, genres: list[str], mode: str, sort: str,
                       start: int, kind: str) -> dict[str, Any]:
    """ALL uses Steam's multi-tag filter; ANY unions per-tag results."""
    if len(genres) < 2 or mode == "all":
        result = query_steam(q, ",".join(genres) if genres else "all", sort, start, kind)
        return {**result, "approximate_total": False}

    # Allocate each paginated result slice to a genre so no records are skipped
    # between pages. Duplicates between different tags are removed.
    stride = math.ceil(PAGE_SIZE / len(genres))
    tag_start = start // PAGE_SIZE * stride
    found: dict[str, dict[str, Any]] = {}
    failures = 0
    with ThreadPoolExecutor(max_workers=min(4, len(genres))) as executor:
        futures = {executor.submit(query_steam, q, tag, sort, tag_start, kind): tag for tag in genres}
        for future in as_completed(futures):
            tag = futures[future]
            try:
                found[tag] = future.result()
            except SteamUnavailable:
                failures += 1

    if not found:
        raise SteamUnavailable("Каталог временно недоступен. Попробуй ещё раз позже.")
    # Interleave genres: selecting a less common tag still gets visible results.
    groups = [found[tag]["games"][:stride] if tag in found else [] for tag in genres]
    dedup: dict[str, dict[str, str]] = {}
    for j in range(stride):
        for group in groups:
            if j < len(group):
                game = group[j]
                dedup.setdefault(game["id"], game)
    games = list(dedup.values())[:PAGE_SIZE]
    if sort == "name":
        games.sort(key=lambda game: game["name"].casefold())
    return {
        "games": games,
        # Result counts overlap across tags; NEVER label the sum exact.
        "total": sum(data["total"] for data in found.values()),
        "start": start,
        "approximate_total": True,
        "partial": bool(failures),
        "has_more": any(data["total"] > tag_start + stride for data in found.values()),
    }


def steam_search_url(q: str, genre: str, sort: str, kind: str) -> str:
    params: dict[str, str | int] = {"category1": GAME_KINDS[kind]}
    if q:
        params["term"] = q
    tags = [str(GENRES[g]["tag"]) for g in genre.split(",")
            if g in GENRES and GENRES[g]["tag"]]
    if tags:
        params["tags"] = ",".join(tags)
    if SORTS[sort]:
        params["sort_by"] = SORTS[sort]
    return STEAM_SEARCH + "?" + urlencode(params)


@app.get("/")
def index():
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/genres")
def genres():
    return {"genres": [{"id": key, "name": val["name"]} for key, val in GENRES.items()]}


@app.get("/api/games")
def games(request: Request):
    q, _, sort, kind = read_filters(request)
    selected, mode = read_genre_selection(request)
    try:
        page = min(max(int(request.query_params.get("page", 1)), 1), 100)
    except ValueError:
        page = 1
    years = read_year_range(request)
    year_scan = years[0] is not None
    # In year mode each page scans several storefront slices. The cursor is
    # an offset, not the count of filtered games.
    start = (page - 1) * PAGE_SIZE * (2 if mode == 'any' and len(selected) > 1 else 5) if year_scan else (page - 1) * PAGE_SIZE
    # For ANY, storefront links can represent only one selected genre at once.
    fallback_url = steam_search_url(q, ",".join(selected) if mode == "all" else
                                    (selected[0] if selected else "all"), sort, kind)
    try:
        result = (scan_games_for_year(q, selected, mode, sort, start, kind, years)
                  if year_scan else fetch_multi_genres(q, selected, mode, sort, start, kind))
        return {
            **result, "year_from": years[0], "year_to": years[1], "page": page, "genres": selected, "genre_mode": mode,
            "has_more": result.get("has_more", start + PAGE_SIZE < result["total"]) if year_scan else
                        (result.get("has_more", start + PAGE_SIZE < result["total"]) and bool(result["games"])),
            "source_url": fallback_url,
        }
    except SteamUnavailable as exc:
        return JSONResponse({"error": str(exc), "source_url": fallback_url}, status_code=503)


@app.get("/api/wheel")
def wheel(request: Request):
    q, _, _, default_kind = read_filters(request)
    selected, mode = read_genre_selection(request)
    raw_kind = request.query_params.get("kind", default_kind)
    kinds = ("demo", "full") if raw_kind == "mix" else (default_kind,)
    # ANY searches every requested genre; ALL asks Steam to match every tag.
    group_filters = selected if mode == "any" and len(selected) > 1 else [",".join(selected) if selected else "all"]
    fallback_tag = selected[0] if mode == "any" and selected else (",".join(selected) if selected else "all")
    fallback = steam_search_url(q, fallback_tag, "relevance", kinds[0])
    years = read_year_range(request)
    exclusions = {
        s for s in (request.query_params.get("exclude") or "").split(",")[:40]
        if re.fullmatch(r"\d{1,15}", s)
    }
    pool: dict[str, dict[str, str]] = {}
    total = 0
    failed = 0
    searches = [(kind, genre) for kind in kinds for genre in group_filters]
    # Concurrent requests keep multiple selected genres responsive.
    with ThreadPoolExecutor(max_workers=min(6, len(searches))) as executor:
        futures = {executor.submit(query_steam, q, genre, "relevance", 0, kind): (kind, genre)
                   for kind, genre in searches}
        for future in as_completed(futures):
            kind, genre = futures[future]
            try:
                first = future.result()
                total += first["total"]
                for game in first["games"]:
                    if game_matches_year(game, years):
                        pool[f"{kind}:{game['id']}"] = game
                page_total = first["total"]
                if page_total > PAGE_SIZE:
                    last_offset = min(max(page_total - PAGE_SIZE, 0), MAX_RANDOM_OFFSET)
                    if last_offset >= PAGE_SIZE:
                        offset = random.randint(1, max(1, last_offset // PAGE_SIZE)) * PAGE_SIZE
                        try:
                            next_page = query_steam(q, genre, "relevance", offset, kind)
                            for game in next_page["games"]:
                                if game_matches_year(game, years):
                                    pool[f"{kind}:{game['id']}"] = game
                        except SteamUnavailable:
                            pass
            except SteamUnavailable:
                failed += 1
    if years[0] is not None and not pool and not failed:
        return JSONResponse({"error": "За выбранные годы в просмотренных результатах нет игр. Попробуй другой диапазон, название или жанр — поиск по годам ограничен данными Steam.", "source_url": fallback}, status_code=404)
    if not pool:
        error = ("Каталог игр временно недоступен. Попробуй ещё раз или используй «Мой список»."
                 if failed else "Для этих фильтров пока нет игр. Попробуй другие жанры или название.")
        return JSONResponse({"error": error, "source_url": fallback}, status_code=503 if failed else 404)
    candidates = [g for g in pool.values() if g["id"] not in exclusions]
    if not candidates:
        candidates = list(pool.values())
    random.shuffle(candidates)
    if len(kinds) > 1:
        demo = [g for g in candidates if g["kind"] == "demo"]
        full = [g for g in candidates if g["kind"] == "full"]
        if demo and full:
            candidates = demo[:4] + full[:4]
            random.shuffle(candidates)
    return {"games": candidates[:8], "total": total, "year_from": years[0], "year_to": years[1], "source_url": fallback,
            "genres": selected, "genre_mode": mode,
            "approximate_total": len(selected) > 1 and mode == "any"}


@app.get("/api/random")
def random_game(request: Request):
    """Keep compatibility with older integration clients."""
    result = wheel(request)
    if isinstance(result, JSONResponse):
        return result
    return {"game": random.choice(result["games"]), "total": result["total"], "source_url": result["source_url"]}


# A lightweight, non-persistent streaming room. Single worker required so the
# broadcaster and OBS browser source see the same room state.
_room_lock = threading.Lock()
_rooms: dict[str, tuple[float, dict[str, Any]]] = {}
ROOM_TTL = 7200


def valid_room(room: str) -> bool:
    return bool(re.fullmatch(r"[a-f0-9]{32}", room))


@app.get("/overlay")
def obs_overlay():
    return FileResponse(BASE_DIR / "static" / "overlay.html")


@app.get("/obs-widgets")
def obs_widgets():
    return FileResponse(BASE_DIR / "static" / "obs-widgets.html")


@app.get("/api/stream/{room}")
def read_stream(room: str):
    if not valid_room(room):
        return JSONResponse({"error": "Invalid room ID"}, status_code=400)
    with _room_lock:
        entry = _rooms.get(room)
        if entry and time.monotonic() - entry[0] < ROOM_TTL:
            return JSONResponse(entry[1], headers={"Cache-Control": "no-store"})
    return JSONResponse({"status": "idle"}, headers={"Cache-Control": "no-store"})


@app.post("/api/stream/{room}")
async def write_stream(room: str, request: Request):
    if not valid_room(room):
        return JSONResponse({"error": "Invalid room ID"}, status_code=400)
    try:
        data = await request.json()
    except (ValueError, TypeError):
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    if not isinstance(data, dict):
        return JSONResponse({"error": "Expected object"}, status_code=400)
    status = data.get("status")
    if status not in {"idle", "spinning", "winner"}:
        return JSONResponse({"error": "Invalid status"}, status_code=400)
    machine = data.get("machine") if data.get("machine") in {"wheel", "case", "drum", "casino"} else "wheel"
    try:
        duration = min(max(int(data.get("duration") or 0), 0), 15000)
    except (ValueError, TypeError):
        duration = 0
    game = None
    if status == "winner":
        raw = data.get("game")
        if not isinstance(raw, dict) or not str(raw.get("name") or "").strip():
            return JSONResponse({"error": "Missing winner"}, status_code=400)
        name = str(raw.get("name"))[:180]
        image = sanitize_image(str(raw.get("image") or ""))
        game_id = str(raw.get("id") or "")[:100]
        kind = raw.get("kind") if raw.get("kind") in {"demo", "full", "custom"} else "full"
        url = str(raw.get("url") or "")
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.netloc != "store.steampowered.com":
            url = STEAM_SEARCH + "?" + urlencode({"term": name})
        game = {"id": game_id, "name": name, "kind": kind, "image": image, "url": url}
    channel = data.get("theme") if data.get("theme") in {"neon", "noir", "sunset", "retro", "frost", "forest", "gold", "cosmos"} else "neon"
    accent = data.get("accent")
    if not isinstance(accent, str) or not re.fullmatch(r"#[a-fA-F0-9]{6}", accent):
        accent = {"neon":"#71e6fa", "noir":"#ff526d", "sunset":"#ffad75", "retro":"#eacb5a", "frost":"#89bdff", "forest":"#80e8b4", "gold":"#f6d47e", "cosmos":"#ba9bff"}.get(channel, "#71e6fa")
    # V10 cosmetic-only scenario. It never influences the chosen game.
    raw_round = data.get("round")
    if not isinstance(raw_round, dict):
        raw_round = {}
    round_data = {
        "triple": bool(raw_round.get("triple")),
        "mystery": bool(raw_round.get("mystery")),
        "rule": str(raw_round.get("rule") or "")[:150],
        "challenge": str(raw_round.get("challenge") or "")[:150],
        "event": raw_round.get("event") if raw_round.get("event") in {"gold", "glitch", "starlight"} else "",
    }
    raw_history = data.get("history")
    history = [str(x)[:180] for x in raw_history[:6] if isinstance(x, str)] if isinstance(raw_history, list) else []
    raw_design = data.get("design") if isinstance(data.get("design"), dict) else {}
    try:
        radius = min(28, max(0, int(raw_design.get("radius", 14))))
    except (TypeError, ValueError):
        radius = 14
    design = {
        "font": raw_design.get("font") if raw_design.get("font") in {"modern", "mono", "round"} else "modern",
        "background": raw_design.get("background") if raw_design.get("background") in {"default", "aurora", "mesh", "stars", "custom"} else "default",
        "radius": radius,
    }
    payload = {"status": status, "machine": machine, "duration": duration, "game": game, "theme": channel, "accent": accent, "updated": time.time(), "round": round_data, "history": history, "design": design}
    with _room_lock:
        prev = _rooms.get(room)
        if prev and time.monotonic()-prev[0]<ROOM_TTL and "votes" in prev[1]:
            payload["votes"] = prev[1]["votes"]
        if len(_rooms) > 2000:
            cutoff = time.monotonic() - ROOM_TTL
            for key, val in list(_rooms.items()):
                if val[0] < cutoff:
                    _rooms.pop(key, None)
        _rooms[room] = (time.monotonic(), payload)
    return JSONResponse({"ok": True}, headers={"Cache-Control": "no-store"})


@app.post("/api/stream/{room}/vote")
async def write_stream_vote(room: str, request: Request):
    """Publish public vote totals for OBS. The room ID is a bearer secret, not a user login."""
    if not valid_room(room):
        return JSONResponse({"error": "Invalid room ID"}, status_code=400)
    try:
        data = await request.json()
    except (ValueError, TypeError):
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
    if not isinstance(data, dict):
        return JSONResponse({"error": "Expected object"}, status_code=400)
    games = data.get("games")
    counts = data.get("counts")
    if not isinstance(games, list) or not 2 <= len(games) <= 12 or not isinstance(counts, list) or len(counts) != len(games):
        return JSONResponse({"error": "Invalid voting data"}, status_code=400)
    if any(not isinstance(x,str) or not x.strip() or len(x)>100 for x in games):
        return JSONResponse({"error": "Invalid game name"}, status_code=400)
    try:
        clean_counts = [min(1000000,max(0,int(x))) for x in counts]
        voters = min(1000000,max(0,int(data.get("voters") or 0)))
    except (TypeError,ValueError,OverflowError):
        return JSONResponse({"error": "Invalid counts"}, status_code=400)
    vote={"games":[x.strip() for x in games],"counts":clean_counts,"voters":voters,"active":bool(data.get("active"))}
    with _room_lock:
        entry=_rooms.get(room)
        base = dict(entry[1]) if entry and time.monotonic()-entry[0]<ROOM_TTL else {"status":"idle", "updated":time.time()}
        base["votes"]=vote
        base["updated"]=time.time()
        _rooms[room]=(time.monotonic(),base)
    return JSONResponse({"ok":True},headers={"Cache-Control":"no-store"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
