"""
Clean and aggregate shot data for D3 visualization.
Reads:  data/processed/shots_raw.csv
Writes: data/processed/shots_viz.json   — individual shots for scatter plot
        data/processed/zones_viz.json   — zone aggregates for heatmap
"""

import json
import pandas as pd
import numpy as np
from pathlib import Path

PROCESSED_DIR = Path(__file__).parent.parent / "data" / "processed"
INPUT_CSV = PROCESSED_DIR / "shots_raw.csv"
TEAM_META_JSON = PROCESSED_DIR / "team_meta.json"
GOALIE_CATCHES_JSON = PROCESSED_DIR / "goalie_catches.json"
TEAMS_OUT = PROCESSED_DIR / "teams.json"
TEAMS_DIR = PROCESSED_DIR / "teams"
GOALIES_OUT = PROCESSED_DIR / "goalies.json"
GOALIES_DIR = PROCESSED_DIR / "goalies"


def compute_physical_side(x: float, y: float) -> str | None:
    """
    Physical left/right side of the net, relative to the goalie's own body,
    derived from which end of the ice the shot's x-coordinate places the net at.
    Operates on the same x/y convention already used elsewhere in this pipeline
    (NHL raw x, and the display-oriented y already negated by load_shots()).
    """
    if x == 0 or y == 0:
        return None
    net_end = 1 if x > 0 else -1
    y_sign = 1 if y > 0 else -1
    return "right" if y_sign == net_end else "left"


def load_shots() -> pd.DataFrame:
    df = pd.read_csv(INPUT_CSV)
    df = df[df["periodType"].isin(["REG", "OT"])]
    df = df[df["isOnGoal"]].copy()
    df["shotType"] = df["shotType"].fillna("")
    df["goalieName"] = df["goalieName"].fillna("")
    # NHL API uses positive y toward the top of the broadcast image (mathematical convention).
    # SVG renders positive y downward, so we negate y here so that display coordinates match.
    df["y"] = -df["y"]
    return df


def load_team_meta() -> dict:
    if not TEAM_META_JSON.exists():
        return {}
    with TEAM_META_JSON.open() as f:
        return json.load(f)


def load_goalie_catches() -> dict:
    if not GOALIE_CATCHES_JSON.exists():
        return {}
    with GOALIE_CATCHES_JSON.open() as f:
        return json.load(f)


def build_team_datasets(df: pd.DataFrame, team_meta: dict) -> None:
    TEAMS_DIR.mkdir(parents=True, exist_ok=True)
    team_index = []

    for abbrev, meta in team_meta.items():
        if "arena" not in meta:
            continue  # never seen as a home team in the fetched data — skip

        team_index.append(meta)

        team_games = df[df["homeTeam"] == abbrev]
        records = [{
            "gameId": int(row.gameId),
            "date": row.date,
            "season": int(row.season),
            "period": int(row.period),
            "shootingTeam": row.shootingTeam,
            "isHomeShooting": bool(row.isHomeShooting),
            "x": row.x,
            "y": row.y,
            "isGoal": bool(row.isGoal),
            "isOnGoal": True,
            "shotType": row.shotType,
            "goalieInNetId": int(row.goalieInNetId) if pd.notna(row.goalieInNetId) else None,
            "goalieName": row.goalieName,
        } for row in team_games.itertuples()]

        with (TEAMS_DIR / f"{abbrev}.json").open("w") as f:
            json.dump(records, f)

    team_index.sort(key=lambda t: t["name"])
    with TEAMS_OUT.open("w") as f:
        json.dump(team_index, f, indent=2)

    print(f"Wrote {len(team_index)} team files to {TEAMS_DIR}")


def main():
    if not INPUT_CSV.exists():
        print(f"Input not found at {INPUT_CSV}. Run fetch_shots.py first.")
        return

    team_meta = load_team_meta()
    catches_map = load_goalie_catches()

    df = load_shots()
    print(f"Loaded {len(df)} shots on goal across {df['homeTeam'].nunique()} home teams")

    build_team_datasets(df, team_meta)


if __name__ == "__main__":
    main()
