"""
Which teams this pipeline fetches data for.

Defaults to the full league (every team in scripts/teams.py's TEAM_ABBREVS). If you've forked
this repo to track just your own team, change TEAMS_TO_FETCH below to a smaller list — for
example, TEAMS_TO_FETCH = ["NJD"] for the New Jersey Devils only. Every other file in this
pipeline (games.csv, shots_raw.csv, teams.json, teams/*.json, goalies.json, goalies/*.json)
and the frontend's team switcher automatically scale down to match whatever teams actually
appear in the fetched data — no other code changes are needed.

Narrowing this list also reduces load on the NHL API, which matters if you're running this on
a daily schedule via GitHub Actions (see .github/workflows/update-data.yml) — please don't run
a scheduled fetch of the full league from more forks than necessary.
"""

from teams import TEAM_ABBREVS

TEAMS_TO_FETCH = TEAM_ABBREVS
