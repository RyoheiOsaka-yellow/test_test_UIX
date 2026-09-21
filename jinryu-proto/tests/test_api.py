import pytest
from fastapi.testclient import TestClient

from jinryu import config

pytestmark = pytest.mark.skipif(not config.paths().table("building").exists(), reason="processed data がない")


@pytest.fixture(scope="module")
def client():
    from jinryu.api.main import app

    with TestClient(app) as c:
        yield c


def test_area(client):
    r = client.get("/areas/current")
    assert r.status_code == 200
    j = r.json()
    assert j["periods"] and "disclaimer" in j


def test_links_flow(client):
    period = client.get("/areas/current").json()["periods"][0]
    r = client.get("/links/flow", params={"period": period})
    assert r.status_code == 200
    assert r.json()["type"] == "FeatureCollection"


def test_parcel_and_gap_and_compare(client):
    a = client.get("/areas/current").json()
    period = a["periods"][0]
    g = client.post("/search/gap", json={"period": period, "top": 3}).json()
    assert len(g["items"]) == 3
    bid = g["items"][0]["building_id"]
    r = client.post("/parcels/score", json={"period": period, "building_id": bid})
    assert r.status_code == 200
    j = r.json()
    assert "potential_percentile" in j["metrics"] and "disclaimer" in j
    if len(a["periods"]) > 1:
        c = client.post(
            "/compare", json={"period_a": a["periods"][0], "period_b": a["periods"][-1], "geojson": False}
        )
        assert c.status_code == 200 and "area_change_ratio" in c.json()
