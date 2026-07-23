from team_scope import TEAMS_TO_FETCH
from teams import TEAM_ABBREVS


def test_default_scope_is_full_league():
    assert TEAMS_TO_FETCH == TEAM_ABBREVS


def test_scope_is_a_subset_of_valid_abbrevs():
    assert set(TEAMS_TO_FETCH).issubset(set(TEAM_ABBREVS))


def test_scope_has_no_duplicates():
    assert len(set(TEAMS_TO_FETCH)) == len(TEAMS_TO_FETCH)
