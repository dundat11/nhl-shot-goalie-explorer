"""
Fetch home game IDs for every current NHL team, for the 2024-25 and 2025-26 seasons.
Outputs: data/processed/games.csv
"""

import requests
import pandas as pd
from pathlib import Path
from team_scope import TEAMS_TO_FETCH

SEASONS = ["20242025", "20252026"]
BASE_URL = "https://api-web.nhle.com/v1"
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "processed" / "games.csv"


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

    for team_abbrev in TEAMS_TO_FETCH:
        for season in SEASONS:
            print(f"Fetching schedule for {team_abbrev} — season {season}...")
            try:
                games = fetch_schedule(team_abbrev, season)
                home_games = extract_home_games(games, team_abbrev)
                print(f"  Found {len(home_games)} home regular season games")
                all_home_games.extend(home_games)
            except requests.exceptions.RequestException as e:
                print(f"  Warning: could not fetch {team_abbrev} season {season}: {e}")

    if not all_home_games:
        print("No games found. Check team abbreviations and season codes.")
        return

    df = pd.DataFrame(all_home_games)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"\nSaved {len(df)} home games across {df['homeTeam'].nunique()} teams to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
