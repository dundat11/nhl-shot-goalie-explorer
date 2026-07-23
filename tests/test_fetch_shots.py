from fetch_shots import (
    compute_home_shooting,
    compute_defending_team,
    resolve_goalie_name,
    extract_team_meta,
)
from fixtures import SAMPLE_PBP, SAMPLE_ROSTER_SPOTS


def test_compute_home_shooting_true_when_matches():
    assert compute_home_shooting("UTA", "UTA") is True


def test_compute_home_shooting_false_when_visitor():
    assert compute_home_shooting("CHI", "UTA") is False


def test_compute_defending_team_is_the_other_side():
    assert compute_defending_team(True, "UTA", "CHI") == "CHI"
    assert compute_defending_team(False, "UTA", "CHI") == "UTA"


def test_resolve_goalie_name_found():
    assert resolve_goalie_name(SAMPLE_ROSTER_SPOTS, 8478872) == "Karel Vejmelka"


def test_resolve_goalie_name_missing_id_returns_empty():
    assert resolve_goalie_name(SAMPLE_ROSTER_SPOTS, None) == ""


def test_resolve_goalie_name_unknown_id_returns_empty():
    assert resolve_goalie_name(SAMPLE_ROSTER_SPOTS, 999) == ""


def test_extract_team_meta_tags_arena_only_on_home_side():
    meta = extract_team_meta(SAMPLE_PBP)
    assert meta["UTA"]["arena"] == "Delta Center"
    assert "arena" not in meta["CHI"]
    assert meta["CHI"]["name"] == "Chicago Blackhawks"
