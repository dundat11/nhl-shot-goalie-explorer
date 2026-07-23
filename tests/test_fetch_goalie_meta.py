from fetch_goalie_meta import missing_goalie_ids


def test_missing_goalie_ids_filters_out_cached():
    ids = [111, 222, 333]
    cache = {"111": "L"}
    assert missing_goalie_ids(ids, cache) == [222, 333]


def test_missing_goalie_ids_empty_cache_returns_all():
    assert missing_goalie_ids([1, 2], {}) == [1, 2]
