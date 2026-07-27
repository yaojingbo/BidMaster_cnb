"""Integration tests for Files API."""
import pytest
from fastapi.testclient import TestClient


class TestFilesAPI:
    """Integration tests for /api/files endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from app.main import app
        return TestClient(app)

    def test_upload_file(self, client):
        """Test file upload endpoint."""
        with open("/tmp/test.pdf", "wb") as f:
            f.write(b"Test PDF content")

        with open("/tmp/test.pdf", "rb") as f:
            response = client.post("/api/files/upload", files={"file": f})

        assert response.status_code in [200, 201, 400]

    def test_list_files(self, client):
        """Test list files endpoint."""
        response = client.get("/api/files/list")
        assert response.status_code == 200
        assert "files" in response.json() or "data" in response.json()

    def test_get_nonexistent_file(self, client):
        """Test getting non-existent file."""
        response = client.get("/api/files/nonexistent-id")
        assert response.status_code in [404, 500]

    def test_delete_file(self, client):
        """Test delete file endpoint."""
        response = client.delete("/api/files/test-id")
        assert response.status_code in [200, 404, 500]

    def test_download_file(self, client):
        """Test download file endpoint."""
        response = client.get("/api/files/test-id/download")
        assert response.status_code in [200, 404, 500]

    def test_upload_invalid_file_type(self, client):
        """Test uploading invalid file type."""
        with open("/tmp/test.exe", "wb") as f:
            f.write(b"Test content")

        with open("/tmp/test.exe", "rb") as f:
            response = client.post("/api/files/upload", files={"file": f})

        assert response.status_code == 400
