"""
Fetch Utah home game IDs from the NHL Stats API for the 2024-25 and 2025-26 seasons.
Outputs: data/processed/utah_home_games.csv
"""

import requests
import pandas as pd
from pathlib import Path

# Utah Hockey Club / Utah Mammoth team abbreviation
TEAM_ABBREV = "UTA"

SEASONS = ["20242025", "20252026"]

BASE_URL = "https://api-web.nhle.com/v1"

OUTPUT_PATH = Path(__file__).parent.parent / "data" / "processed" / "utah_home_games.csv"


def fetch_schedule(team_abbrev: str, season: str) -> list[dict]:
    url = f"{BASE_URL}/club-schedule-season/{team_abbrev}/{season}"
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return response.json().get("games", [])


def extract_home_games(games: list[dict], team_abbrev: str) -> list[dict]:
    home_games = []
    for game in games:
        home_team = game.get("homeTeam", {}).get("abbrev", "")
        if home_team == team_abbrev and game.get("gameType") == 2:  # 2 = regular season
            home_games.append({
                "gameId": game["id"],
                "date": game["gameDate"],
                "season": game["season"],
                "homeTeam": home_team,
                "awayTeam": game.get("awayTeam", {}).get("abbrev", ""),
                "homeScore": game.get("homeTeam", {}).get("score"),
                "awayScore": game.get("awayTeam", {}).get("score"),
                "gameState": game.get("gameState", ""),
            })
    return home_games


def main():
    all_home_games = []

    for season in SEASONS:
        print(f"Fetching schedule for {TEAM_ABBREV} — season {season}...")
        try:
            games = fetch_schedule(TEAM_ABBREV, season)
            home_games = extract_home_games(games, TEAM_ABBREV)
            print(f"  Found {len(home_games)} home regular season games")
            all_home_games.extend(home_games)
        except requests.HTTPError as e:
            print(f"  Warning: could not fetch season {season}: {e}")

    if not all_home_games:
        print("No games found. Check team abbreviation and season codes.")
        return

    df = pd.DataFrame(all_home_games)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"\nSaved {len(df)} home games to {OUTPUT_PATH}")
    print(df[["date", "season", "awayTeam", "gameState"]].to_string(index=False))


if __name__ == "__main__":
    main()
