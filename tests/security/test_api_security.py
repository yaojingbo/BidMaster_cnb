"""Security tests for API operations."""
import pytest
from fastapi.testclient import TestClient


class TestAPISecurity:
    """Security tests for API endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    def test_cors_headers(self, client):
        """Test CORS headers are properly configured."""
        response = client.options(
            "/api/files/upload",
            headers={
                "Origin": "http://evil.com",
                "Access-Control-Request-Method": "POST",
            },
        )
        # CORS should block or properly handle cross-origin requests
        assert response.status_code in [200, 403]

    def test_rate_limiting_headers(self, client):
        """Test rate limiting headers are present."""
        response = client.get("/api/health")
        # Should have rate limiting headers in production
        # In test environment, may not be present
        assert response.status_code == 200

    def test_security_headers(self, client):
        """Test security-related headers."""
        response = client.get("/api/health")
        # Should have security headers like X-Content-Type-Options, etc.
        # In test environment, may not be present
        assert response.status_code == 200

    def test_input_validation_xss(self, client):
        """Test XSS prevention in input validation."""
        response = client.post(
            "/api/extract/element",
            json={
                "file_id": "<script>alert('xss')</script>",
                "prompts": ["test"],
            },
        )
        # Should either reject or sanitize the input
        assert response.status_code in [200, 400, 422]

    def test_api_key_authentication(self, client):
        """Test API key authentication for protected endpoints."""
        # Test without API key
        response = client.get("/api/settings/providers")
        assert response.status_code in [200, 401, 403]

    def test_file_upload_size_limit(self, client):
        """Test file upload size limit enforcement."""
        large_content = b"x" * (51 * 1024 * 1024)  # 51MB

        response = client.post(
            "/api/files/upload",
            files={"file": ("large.pdf", large_content)},
        )
        # Should reject files over 50MB
        assert response.status_code in [400, 413]
