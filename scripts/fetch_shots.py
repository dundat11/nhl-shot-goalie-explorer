"""
Pull play-by-play shot data for each Utah home game.
Reads:  data/processed/utah_home_games.csv
Writes: data/raw/<gameId>.json  (one file per game, cached)
        data/processed/shots_raw.csv
"""

import json
import time
import requests
import pandas as pd
from pathlib import Path
from tqdm import tqdm

BASE_URL = "https://api-web.nhle.com/v1"
RAW_DIR = Path(__file__).parent.parent / "data" / "raw"
PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"
GAMES_CSV = PROCESSED_DIR / "utah_home_games.csv"
OUTPUT_CSV = PROCESSED_DIR / "shots_raw.csv"

# Shot and goal event type codes used in the NHL play-by-play API
SHOT_EVENT_TYPES = {
    "shot-on-goal",
    "missed-shot",
    "blocked-shot",
    "goal",
}

# Home bench: top boards from broadcast view = negative Y in NHL coordinates.
# Broadcast camera sits at bottom; bench runs along top boards, left side (x < 0).


def fetch_pbp(game_id: int) -> dict:
    cache_path = RAW_DIR / f"{game_id}.json"
    if cache_path.exists():
        with cache_path.open() as f:
            return json.load(f)

    url = f"{BASE_URL}/gamecenter/{game_id}/play-by-play"
    response = requests.get(url, timeout=15)
    response.raise_for_status()
    data = response.json()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with cache_path.open("w") as f:
        json.dump(data, f)

    time.sleep(0.3)  # be polite to the API
    return data


def extract_shots(pbp: dict, game_meta: dict) -> list[dict]:
    shots = []
    plays = pbp.get("plays", [])
    home_team = pbp.get("homeTeam", {}).get("abbrev", "")
    away_team = pbp.get("awayTeam", {}).get("abbrev", "")

    for play in plays:
        event_type = play.get("typeDescKey", "")
        if event_type not in SHOT_EVENT_TYPES:
            continue

        details = play.get("details", {})
        x = details.get("xCoord")
        y = details.get("yCoord")

        if x is None or y is None:
            continue

        shooting_team_id = details.get("shootingPlayerId") and play.get("details", {})
        # The shooting team is identified via the eventOwnerTeamId field
        owner_team_id = details.get("eventOwnerTeamId")
        home_team_id = pbp.get("homeTeam", {}).get("id")

        shooting_team_abbrev = home_team if owner_team_id == home_team_id else away_team
        is_utah_shooting = shooting_team_abbrev == "UTA"

        period_desc = play.get("periodDescriptor", {})
        period = period_desc.get("number")
        period_type = period_desc.get("periodType", "REG")

        shots.append({
            "gameId": game_meta["gameId"],
            "date": game_meta["date"],
            "season": game_meta["season"],
            "awayTeam": game_meta["awayTeam"],
            "period": period,
            "periodType": period_type,
            "timeInPeriod": play.get("timeInPeriod"),
            "eventType": event_type,
            "shootingTeam": shooting_team_abbrev,
            "isUtahShooting": is_utah_shooting,
            "x": x,
            "y": y,
            # Which side of center ice the shot came from (broadcast perspective)
            "shotSide": "top" if y < 0 else "bottom",
            # Home bench is along the top boards (y < 0) on the left side (x < 0)
            "isHomeBenchSide": y < 0 and x < 0,
            "shotType": details.get("shotType", ""),
            "isGoal": event_type == "goal",
            "isOnGoal": event_type in {"shot-on-goal", "goal"},
        })

    return shots


def main():
    if not GAMES_CSV.exists():
        print(f"Games list not found at {GAMES_CSV}. Run fetch_games.py first.")
        return

    games_df = pd.read_csv(GAMES_CSV)
    # Only process completed games
    completed = games_df[games_df["gameState"].isin(["OFF", "FINAL"])]
    print(f"Processing {len(completed)} completed home games...")

    all_shots = []
    for _, game in tqdm(completed.iterrows(), total=len(completed)):
        try:
            pbp = fetch_pbp(int(game["gameId"]))
            shots = extract_shots(pbp, game)
            all_shots.extend(shots)
        except Exception as e:
            print(f"\nError on game {game['gameId']}: {e}")

    if not all_shots:
        print("No shots collected.")
        return

    df = pd.DataFrame(all_shots)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"\nSaved {len(df)} shot events to {OUTPUT_CSV}")
    print(f"Goals: {df['isGoal'].sum()} | Shots on goal: {df['isOnGoal'].sum()}")
    print(f"Home bench side shots (y<0, x<0): {df['isHomeBenchSide'].sum()} "
          f"({df['isHomeBenchSide'].mean():.1%} of all shots)")


if __name__ == "__main__":
    main()
