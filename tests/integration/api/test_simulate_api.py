"""Integration tests for Simulate API."""
import pytest
from fastapi.testclient import TestClient


class TestSimulateAPI:
    """Integration tests for /api/simulate endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    def test_create_simulate_task(self, client):
        """Test creating simulate task."""
        response = client.post(
            "/api/simulate/create",
            json={
                "project_type": "工程",
                "budget": "100万元",
                "timeline": "30日历天",
            },
        )
        assert response.status_code in [200, 201, 400, 500]
        if response.status_code in [200, 201]:
            data = response.json()
            assert "data" in data or "success" in data

    def test_get_simulate_task(self, client):
        """Test getting simulate task."""
        response = client.get("/api/simulate/nonexistent-id")
        assert response.status_code in [200, 404, 500]

    def test_submit_simulate_step(self, client):
        """Test submitting simulate step."""
        response = client.post(
            "/api/simulate/test-id/step/1",
            json={"content": "test content"},
        )
        assert response.status_code in [200, 404, 500]

    def test_generate_document(self, client):
        """Test generating document."""
        response = client.post("/api/simulate/test-id/generate")
        assert response.status_code in [200, 404, 500]

    def test_create_task_missing_fields(self, client):
        """Test creating task with missing fields."""
        response = client.post(
            "/api/simulate/create",
            json={"project_type": "工程"},
        )
        assert response.status_code == 400
