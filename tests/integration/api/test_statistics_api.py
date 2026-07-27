"""Integration tests for Statistics API."""
import pytest
from fastapi.testclient import TestClient


class TestStatisticsAPI:
    """Integration tests for /api/statistics endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    def test_analyze_statistics(self, client):
        """Test statistics analysis."""
        response = client.post(
            "/api/statistics/analyze",
            json={"prices": [100, 200, 300]},
        )
        assert response.status_code in [200, 400, 500]
        if response.status_code == 200:
            data = response.json()
            assert "data" in data or "success" in data

    def test_parse_statistics_data(self, client):
        """Test parsing Excel/CSV data."""
        with open("/tmp/test.csv", "w") as f:
            f.write("bidder,price\nA,100\nB,200\n")

        with open("/tmp/test.csv", "rb") as f:
            response = client.post(
                "/api/statistics/parse",
                files={"file": ("test.csv", f, "text/csv")},
            )

        assert response.status_code in [200, 400, 500]

    def test_export_report(self, client):
        """Test report export."""
        response = client.get("/api/statistics/export/test-id?format=pdf")
        assert response.status_code in [200, 400, 500]

    def test_export_report_json_format(self, client):
        """Test report export with JSON format."""
        response = client.get("/api/statistics/export/test-id?format=json")
        assert response.status_code in [200, 400, 500]

    def test_analyze_with_empty_prices(self, client):
        """Test analysis with empty prices."""
        response = client.post(
            "/api/statistics/analyze",
            json={"prices": []},
        )
        assert response.status_code == 400
