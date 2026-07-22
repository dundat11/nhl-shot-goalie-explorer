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
GAMES_CSV = PROCESSED_DIR / "games.csv"
OUTPUT_CSV = PROCESSED_DIR / "shots_raw.csv"
TEAM_META_JSON = PROCESSED_DIR / "team_meta.json"

# Shot and goal event type codes used in the NHL play-by-play API
SHOT_EVENT_TYPES = {
    "shot-on-goal",
    "missed-shot",
    "blocked-shot",
    "goal",
}


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


def compute_home_shooting(shooting_team: str, home_team: str) -> bool:
    return shooting_team == home_team


def compute_defending_team(is_home_shooting: bool, home_team: str, away_team: str) -> str:
    return away_team if is_home_shooting else home_team


def resolve_goalie_name(roster_spots: list[dict], goalie_id) -> str:
    if goalie_id is None:
        return ""
    for r in roster_spots:
        if r.get("playerId") == goalie_id:
            first = r.get("firstName", {}).get("default", "")
            last = r.get("lastName", {}).get("default", "")
            return f"{first} {last}".strip()
    return ""


def extract_team_meta(pbp: dict) -> dict:
    venue = pbp.get("venue", {}).get("default", "")
    out = {}
    for side in ("homeTeam", "awayTeam"):
        t = pbp.get(side, {})
        abbrev = t.get("abbrev")
        if not abbrev:
            continue
        out[abbrev] = {
            "abbrev": abbrev,
            "name": t.get("commonName", {}).get("default", abbrev),
            "logoLight": t.get("logo", ""),
            "logoDark": t.get("darkLogo", ""),
        }
        if side == "homeTeam":
            out[abbrev]["arena"] = venue
    return out


def extract_shots(pbp: dict, game_meta: dict) -> list[dict]:
    shots = []
    plays = pbp.get("plays", [])
    roster_spots = pbp.get("rosterSpots", [])

    for play in plays:
        event_type = play.get("typeDescKey", "")
        if event_type not in SHOT_EVENT_TYPES:
            continue

        details = play.get("details", {})
        x = details.get("xCoord")
        y = details.get("yCoord")

        if x is None or y is None:
            continue

        owner_team_id = details.get("eventOwnerTeamId")
        home_team_id = pbp.get("homeTeam", {}).get("id")
        home_team = game_meta["homeTeam"]
        away_team = game_meta["awayTeam"]

        shooting_team_abbrev = home_team if owner_team_id == home_team_id else away_team
        is_home_shooting = compute_home_shooting(shooting_team_abbrev, home_team)
        defending_team = compute_defending_team(is_home_shooting, home_team, away_team)

        goalie_id = details.get("goalieInNetId")
        goalie_name = resolve_goalie_name(roster_spots, goalie_id)

        period_desc = play.get("periodDescriptor", {})
        period = period_desc.get("number")
        period_type = period_desc.get("periodType", "REG")

        shots.append({
            "gameId": game_meta["gameId"],
            "date": game_meta["date"],
            "season": game_meta["season"],
            "homeTeam": home_team,
            "awayTeam": away_team,
            "period": period,
            "periodType": period_type,
            "timeInPeriod": play.get("timeInPeriod"),
            "eventType": event_type,
            "shootingTeam": shooting_team_abbrev,
            "isHomeShooting": is_home_shooting,
            "defendingTeam": defending_team,
            "x": x,
            "y": y,
            "shotType": details.get("shotType", ""),
            "isGoal": event_type == "goal",
            "isOnGoal": event_type in {"shot-on-goal", "goal"},
            "goalieInNetId": goalie_id,
            "goalieName": goalie_name,
        })

    return shots


def main():
    if not GAMES_CSV.exists():
        print(f"Games list not found at {GAMES_CSV}. Run fetch_games.py first.")
        return

    games_df = pd.read_csv(GAMES_CSV)
    completed = games_df[games_df["gameState"].isin(["OFF", "FINAL"])]
    print(f"Processing {len(completed)} completed games across all teams...")

    all_shots = []
    team_meta = {}

    for _, game in tqdm(completed.iterrows(), total=len(completed)):
        try:
            pbp = fetch_pbp(int(game["gameId"]))
            shots = extract_shots(pbp, game)
            all_shots.extend(shots)

            for abbrev, meta in extract_team_meta(pbp).items():
                existing = team_meta.get(abbrev, {})
                existing.update(meta)
                team_meta[abbrev] = existing
        except Exception as e:
            print(f"\nError on game {game['gameId']}: {e}")

    if not all_shots:
        print("No shots collected.")
        return

    df = pd.DataFrame(all_shots)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_CSV, index=False)

    with TEAM_META_JSON.open("w") as f:
        json.dump(team_meta, f, indent=2)

    print(f"\nSaved {len(df)} shot events to {OUTPUT_CSV}")
    print(f"Saved metadata for {len(team_meta)} teams to {TEAM_META_JSON}")
    print(f"Goals: {df['isGoal'].sum()} | Shots on goal: {df['isOnGoal'].sum()}")


if __name__ == "__main__":
    main()
