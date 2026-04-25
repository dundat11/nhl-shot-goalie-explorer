# Utah Mammoth — Home Ice Shot Location Study

## The Hypothesis

The Utah Mammoth play their home games at the Delta Center in Salt Lake City. The home bench sits on the **left side of the ice from the broadcast perspective**. At home, the Mammoth wear **black uniforms**, which creates a high-contrast visual environment against the white ice surface and the bench/boards background.

The theory being tested is this repository is:

> **Shots taken from the area in front of the home bench have a measurably higher goal-scoring rate — for both teams — on Utah Mammoth home ice.**

If true, this effect would be visible in the raw geometry of shot locations: a concentration of successful shots near the left-side boards zone, regardless of which team is shooting or which direction they are attacking. The physical location on the ice is the constant, not the attacking direction.

Possible contributing factors:
- **Bench position** — players emerging from the bench gate create motion and visual noise in a goalie's peripheral field for shots from that side
- **Uniform contrast** — black jerseys against white ice and boards may affect how a goalie tracks the puck and reads shooter body language from that zone
- **Combined effect** — neither factor alone but the interaction of both

This is not a settled claim. The goal of this project is to collect the data and let the numbers answer the question.

---

## Research Questions

1. Is there a statistically significant shot-to-goal conversion rate difference by physical rink zone on Utah Mammoth home ice?
2. Does the zone in front of the home bench (left side, broadcast perspective) show elevated conversion rates compared to the same zone on away ice?
3. Is the elevated rate (if it exists) present for **both** teams on Utah home ice, or only for the visiting team or only for Utah (would factors such as goalie Goalie skill)?
4. How does Utah's home ice shot distribution compare to league-wide shot location averages?
5. Does the pattern change between the 2024-25 season (Utah Hockey Club) and the 2025-26 season (Utah Mammoth)?
6. Is there a period-by-period effect? (Teams switch sides between periods — does the pattern follow the physical bench location or the attacking direction?)

---

## Data Sources

| Source | Used For |
|---|---|
| [NHL Stats API](https://api-web.nhle.com) | Play-by-play shot coordinates (x/y), game schedules, team IDs |
| [MoneyPuck](https://moneypuck.com/data.htm) | League-wide shot data for comparison baseline |

**Important:** Shot coordinates are preserved in their raw rink reference frame (broadcast perspective). Coordinates are **not** normalized by attacking direction. The home bench occupies a fixed physical location at the Delta Center — that is the spatial constant being studied.

### NHL API Coordinate System
- X-axis: −100 (left end boards) to +100 (right end boards), broadcast perspective
- Y-axis: −42.5 (bottom boards) to +42.5 (top boards)
- Home bench: **left side → negative X territory**

---

## Seasons Covered

| Season | Team Name | Notes |
|---|---|---|
| 2024-25 | Utah Hockey Club | First season after Arizona Coyotes relocation |
| 2025-26 | Utah Mammoth | Rebranded name |

---

## Methodology

1. **Fetch** all Utah home game IDs from the NHL schedule API for both seasons
2. **Pull** play-by-play data for each game; extract all shot events (shots on goal, missed shots, blocked shots)
3. **Preserve** raw x/y coordinates — no direction normalization
4. **Tag** each shot: shooting team, is Utah home game, period, shot type, outcome (goal / on goal / missed / blocked)
5. **Aggregate** into zone bins for heatmap rendering
6. **Compare** home vs. away, both teams on home ice, and against league averages
7. **Visualize** with D3.js: interactive rink diagram with heatmap and scatter overlays

## Conclusion

## Questions to ask.. 
What is characterized as "front of the home bench" for these numbers?
Should this be a movable "goalie viewpoint" for dynamic analysis and simulated vision? 
Should this be just that "quarter" of the ice? 
We should split up the data to account for only shots (home and away) on the home side of the ice.