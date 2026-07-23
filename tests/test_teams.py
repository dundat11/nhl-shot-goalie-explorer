from teams import TEAM_ABBREVS


def test_team_count():
    assert len(TEAM_ABBREVS) == 32


def test_no_duplicates():
    assert len(set(TEAM_ABBREVS)) == len(TEAM_ABBREVS)


def test_all_uppercase_three_letter():
    assert all(len(t) == 3 and t.isupper() for t in TEAM_ABBREVS)
