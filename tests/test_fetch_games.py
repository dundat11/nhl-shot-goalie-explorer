from fetch_games import extract_home_games


def test_extract_home_games_filters_by_team_and_type():
    games = [
        {"id": 1, "gameDate": "2025-10-10", "season": 20252026, "gameType": 2,
         "homeTeam": {"abbrev": "BOS", "score": 3}, "awayTeam": {"abbrev": "NYR", "score": 2},
         "gameState": "OFF"},
        {"id": 2, "gameDate": "2025-10-11", "season": 20252026, "gameType": 2,
         "homeTeam": {"abbrev": "NYR", "score": 1}, "awayTeam": {"abbrev": "BOS", "score": 4},
         "gameState": "OFF"},
        {"id": 3, "gameDate": "2025-09-20", "season": 20252026, "gameType": 1,
         "homeTeam": {"abbrev": "BOS", "score": 0}, "awayTeam": {"abbrev": "NYR", "score": 0},
         "gameState": "OFF"},
    ]
    result = extract_home_games(games, "BOS")
    assert len(result) == 1
    assert result[0]["gameId"] == 1
    assert result[0]["awayTeam"] == "NYR"
