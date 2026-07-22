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


def main():
    if not INPUT_CSV.exists():
        print(f"Input not found at {INPUT_CSV}. Run fetch_shots.py first.")
        return

    df = load_shots()
    print(f"Loaded {len(df)} shots on goal")

    # --- Individual shots for scatter plot ---
    df["isOnGoal"] = True  # process_data only keeps shots on goal
    df["shotType"] = df["shotType"].fillna("")
    shots_out = df[[
        "gameId", "date", "season", "period", "shootingTeam",
        "isUtahShooting", "x", "y", "isGoal", "isOnGoal", "isHomeBenchSide", "shotType"
    ]].to_dict(orient="records")

    with SHOTS_OUT.open("w") as f:
        json.dump(shots_out, f)
    print(f"Wrote {len(shots_out)} shot records to {SHOTS_OUT}")

    # --- Zone aggregates ---
    zones = []

    # Utah shooting at home
    zones += compute_zone_stats(df[df["isUtahShooting"]], "utah_home_offense")
    # Opponents shooting at Utah's home rink
    zones += compute_zone_stats(df[~df["isUtahShooting"]], "utah_home_defense")
    # All shots on Utah home ice combined
    zones += compute_zone_stats(df, "utah_home_all")

    with ZONES_OUT.open("w") as f:
        json.dump(zones, f, indent=2)
    print(f"Wrote zone stats ({len(zones)} zone records) to {ZONES_OUT}")

    # Quick summary — bench side = top of broadcast (y > 0 in NHL API = y < 0 after negation, x < 0)
    bench_side = df[df["isHomeBenchSide"]]
    other_side = df[~df["isHomeBenchSide"]]
    print(f"\nHome bench side (top boards, left): {len(bench_side)} shots, "
          f"{bench_side['isGoal'].mean():.3f} conversion rate")
    print(f"Rest of ice:                        {len(other_side)} shots, "
          f"{other_side['isGoal'].mean():.3f} conversion rate")


if __name__ == "__main__":
    main()
