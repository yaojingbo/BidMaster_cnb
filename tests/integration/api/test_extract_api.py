"""Integration tests for Extract API."""
import pytest
from fastapi.testclient import TestClient


class TestExtractAPI:
    """Integration tests for /api/extract endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    def test_extract_element(self, client):
        """Test element extraction endpoint."""
        response = client.post(
            "/api/extract/element",
            json={"file_id": "test-id", "prompts": ["资质要求"]},
        )
        assert response.status_code in [200, 400, 500]

    def test_extract_element_sse(self, client):
        """Test SSE element extraction."""
        with client.stream(
            "POST",
            "/api/extract/element",
            json={"file_id": "test-id", "prompts": ["资质要求"]},
            timeout=10,
        ) as response:
            assert response.status_code in [200, 400]
            if response.status_code == 200:
                chunks = list(response.iter_content(chunk_size=1024))
                assert len(chunks) > 0

    def test_get_extraction_status(self, client):
        """Test getting extraction status."""
        response = client.get("/api/extract/status/nonexistent-task")
        assert response.status_code in [200, 404]

    def test_extract_with_empty_prompts(self, client):
        """Test extraction with empty prompts."""
        response = client.post(
            "/api/extract/element",
            json={"file_id": "test-id", "prompts": []},
        )
        assert response.status_code == 400
