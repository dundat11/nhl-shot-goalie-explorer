from process_data import compute_physical_side


def test_positive_x_positive_y_is_right():
    assert compute_physical_side(75, 10) == "right"


def test_positive_x_negative_y_is_left():
    assert compute_physical_side(75, -10) == "left"


def test_negative_x_negative_y_is_right():
    assert compute_physical_side(-75, -10) == "right"


def test_negative_x_positive_y_is_left():
    assert compute_physical_side(-75, 10) == "left"


def test_zero_x_is_none():
    assert compute_physical_side(0, 10) is None


def test_zero_y_is_none():
    assert compute_physical_side(75, 0) is None
