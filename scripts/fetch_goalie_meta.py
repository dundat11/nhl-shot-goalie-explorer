"""
Fetch each goalie's glove hand (catches L/R) from the NHL player API.
Reads:  data/processed/shots_raw.csv         (for the set of goalie IDs seen)
Writes: data/processed/goalie_catches.json   (merged/cached across runs)
"""

import json
import time
import requests
import pandas as pd
from pathlib import Path

BASE_URL = "https://api-web.nhle.com/v1"
PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"
SHOTS_CSV = PROCESSED_DIR / "shots_raw.csv"
OUTPUT_JSON = PROCESSED_DIR / "goalie_catches.json"


def fetch_catches(player_id: int) -> str | None:
    url = f"{BASE_URL}/player/{player_id}/landing"
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    data = response.json()
    time.sleep(0.2)  # be polite to the API
    return data.get("shootsCatches")


def missing_goalie_ids(goalie_ids: list[int], cache: dict) -> list[int]:
    return [gid for gid in goalie_ids if str(gid) not in cache]


def main():
    if not SHOTS_CSV.exists():
        print(f"Input not found at {SHOTS_CSV}. Run fetch_shots.py first.")
        return

    df = pd.read_csv(SHOTS_CSV)
    goalie_ids = sorted(df["goalieInNetId"].dropna().astype(int).unique().tolist())

    cache = {}
    if OUTPUT_JSON.exists():
        with OUTPUT_JSON.open() as f:
            cache = json.load(f)

    missing = missing_goalie_ids(goalie_ids, cache)
    print(f"{len(goalie_ids)} unique goalies, {len(missing)} missing catches data")

    for gid in missing:
        try:
            catches = fetch_catches(gid)
            cache[str(gid)] = catches or "L"
        except requests.HTTPError as e:
            print(f"  Warning: could not fetch goalie {gid}: {e}")
            cache[str(gid)] = "L"

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    with OUTPUT_JSON.open("w") as f:
        json.dump(cache, f, indent=2)
    print(f"Saved catches data for {len(cache)} goalies to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
