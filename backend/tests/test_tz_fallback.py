import pytest

from serving import insights


def test_unknown_zone_is_still_rejected_when_a_tz_database_exists():
    with pytest.raises(ValueError):
        insights.resolve_tz("Mars/Base")


def test_without_any_tz_database_days_fall_back_to_utc_instead_of_failing(monkeypatch):
    """Stock Windows Python has no IANA database unless `tzdata` is installed."""
    from zoneinfo import ZoneInfoNotFoundError

    def no_database(name):
        raise ZoneInfoNotFoundError(name)

    monkeypatch.setattr(insights, "ZoneInfo", no_database)
    assert insights.resolve_tz("Asia/Karachi") is insights.timezone.utc
