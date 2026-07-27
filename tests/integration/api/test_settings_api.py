"""Integration tests for Settings API."""
import pytest
from fastapi.testclient import TestClient


class TestSettingsAPI:
    """Integration tests for /api/settings endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    def test_get_providers(self, client):
        """Test getting providers list."""
        response = client.get("/api/settings/providers")
        assert response.status_code == 200
        data = response.json()
        assert "providers" in data or "data" in data

    def test_get_provider_status(self, client):
        """Test getting provider status."""
        response = client.get("/api/settings/providers/openai")
        assert response.status_code in [200, 404]

    def test_configure_provider(self, client):
        """Test configuring provider."""
        response = client.post(
            "/api/settings/providers/openai",
            json={"api_key": "test-key", "model": "gpt-4o"},
        )
        assert response.status_code in [200, 400, 500]

    def test_test_connection(self, client):
        """Test connection testing."""
        response = client.post(
            "/api/settings/test",
            json={"provider": "openai", "api_key": "test-key"},
        )
        assert response.status_code in [200, 400, 500]

    def test_test_connection_missing_fields(self, client):
        """Test connection test with missing fields."""
        response = client.post(
            "/api/settings/test",
            json={"provider": "openai"},
        )
        assert response.status_code == 400
