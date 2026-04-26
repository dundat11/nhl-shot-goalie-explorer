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
SHOTS_OUT = PROCESSED_DIR / "shots_viz.json"
ZONES_OUT = PROCESSED_DIR / "zones_viz.json"

# Bin the ice into a grid for zone aggregation
# NHL rink: x in [-100, 100], y in [-42.5, 42.5]
X_BINS = np.linspace(-100, 100, 41)   # 5-unit bins
Y_BINS = np.linspace(-42.5, 42.5, 18) # ~5-unit bins


def load_shots() -> pd.DataFrame:
    df = pd.read_csv(INPUT_CSV)
    # Only use regular time + OT, exclude shootouts
    df = df[df["periodType"].isin(["REG", "OT"])]
    # Only shots on goal and goals for conversion rate analysis
    df = df[df["isOnGoal"]].copy()
    # NHL API uses positive y toward the top of the broadcast image (mathematical convention).
    # SVG renders positive y downward, so we negate y here so that display coordinates
    # match the SVG: y < 0 = top of SVG = bench side (top of broadcast).
    df["y"] = -df["y"]
    return df


def compute_zone_stats(df: pd.DataFrame, label: str) -> list[dict]:
    df = df.copy()
    df["xBin"] = pd.cut(df["x"], bins=X_BINS, labels=False)
    df["yBin"] = pd.cut(df["y"], bins=Y_BINS, labels=False)

    grouped = df.groupby(["xBin", "yBin"]).agg(
        shots=("isGoal", "count"),
        goals=("isGoal", "sum"),
    ).reset_index()

    grouped["conversionRate"] = grouped["goals"] / grouped["shots"]
    grouped["xCenter"] = X_BINS[grouped["xBin"].astype(int)] + (X_BINS[1] - X_BINS[0]) / 2
    grouped["yCenter"] = Y_BINS[grouped["yBin"].astype(int)] + (Y_BINS[1] - Y_BINS[0]) / 2
    grouped["group"] = label

    return grouped[["xCenter", "yCenter", "shots", "goals", "conversionRate", "group"]].to_dict(orient="records")


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
