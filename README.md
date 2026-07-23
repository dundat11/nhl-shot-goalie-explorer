# NHL Shot Location & Goalie Tendency Explorer

An interactive, league-wide tool for exploring NHL shot location data and goalie shooting-side
tendencies. Switch between any of the 32 NHL teams to see where shots are taken and how likely
they are to become goals across the ice surface, or drill into a specific goalie to see their
glove-side vs. blocker-side conversion rates.

---

## Origin

This project started as a narrower experiment: testing whether shots taken from in front of
the Utah Mammoth's home bench at the Delta Center converted to goals at a higher rate than
shots from elsewhere on the ice — for both teams, not just Utah — theorizing that bench-side
crowd motion and Utah's black home uniforms might affect goalie tracking from that specific
zone.

That single-team hypothesis-testing version has since grown into this general-purpose tool:
every NHL team is selectable, each with its own shot map and goalie split data, refreshed
automatically throughout the season.

---

## What You Can Do

- **Switch teams** — pick any of the 32 NHL teams from the dropdown; the header logo, team
  name, and arena update along with the shot map.
- **Filter shots** — by shooting team (home/opponent), season, specific game, metric
  (conversion rate vs. shot volume), and view mode (heatmap or scatter).
- **Select zones** — click hexes on the rink to compare a specific zone's conversion rate
  against the rest of the ice.
- **Explore goalie tendencies** — pick a specific goalie from a team's roster to see their
  glove-side vs. blocker-side shot conversion rates, based on that goalie's full season (home
  and away appearances).

---

## Data

Shot, game, and goalie data comes from the [NHL Stats API](https://api-web.nhle.com), covering
the 2024-25 and 2025-26 regular seasons. Raw play-by-play coordinates are preserved exactly as
the API reports them — not normalized by attacking direction — so shots are plotted at their
true physical location on the ice.

### NHL API Coordinate System
- X-axis: −100 (left end boards) to +100 (right end boards), broadcast perspective
- Y-axis: −42.5 (bottom boards) to +42.5 (top boards)

A scheduled GitHub Actions workflow (`.github/workflows/update-data.yml`) refreshes this data
automatically during the NHL season (October through April). Data is not automatically
refreshed during the offseason (May–September), when no games are being played.

---

## Forking for Just Your Team

Running this pipeline for the full league makes thousands of NHL API calls per season. If
you've forked this repo and only care about one team, edit `scripts/team_scope.py` — the only
file that controls which teams get fetched:

```python
TEAMS_TO_FETCH = ["COL"]  # e.g. just the Colorado Avalanche
```

Everything downstream — the data pipeline, the processed output files, and the team switcher —
automatically scales to match whatever teams you list here. No other code changes are needed,
and your fork's own scheduled GitHub Actions workflow will only ever fetch data for the
team(s) you've listed.

---

## Running Locally

```bash
pip install -r requirements.txt
python scripts/fetch_games.py
python scripts/fetch_shots.py
python scripts/fetch_goalie_meta.py
python scripts/process_data.py

npm install
npm run dev
```
