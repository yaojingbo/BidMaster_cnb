# Quality Assurance Plan: Bid Master Web

<meta>
  <document-id>bid-master-quality-assurance</document-id>
  <version>1.0.0</version>
  <project>Bid Master Web</project>
  <type>Quality Assurance</type>
  <created>2026-05-10</created>
  <depends>real.md, cog.md, sys.spec.md, db.spec.md, userstory.spec.md</depends>
</meta>

---

## 1. Testing Strategy

### 1.1 Testing Pyramid

```
          /\
         /  \
        / E2E \           10% - Critical user journeys
       /──────\
      /        \
     /Integration\        30% - API and DB tests
    /────────────\
   /              \
  /   Unit Tests   \      60% - Functions and components
 /──────────────────\
```

### 1.2 Testing Tools

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit | Vitest | Fast unit testing for TS/Python |
| Component | React Testing Library | React component testing |
| Integration | Vitest + Supertest | API testing for FastAPI |
| E2E | Playwright | Browser automation |
| Security | Manual + OWASP Checklist | Security validation |

### 1.3 Coverage Targets

| Type | Minimum | Target |
|------|---------|--------|
| Unit Tests | 70% | 85% |
| Integration | 50% | 70% |
| Critical Paths | 100% | 100% |

---

## 2. Unit Tests

### 2.1 Frontend Unit Tests (src/frontend/)

**Test File Structure:**
```
src/frontend/__tests__/
├── lib/
│   ├── validations/
│   │   ├── document.test.ts
│   │   ├── analysis.test.ts
│   │   └── ai-config.test.ts
│   └── utils.test.ts
├── components/
│   ├── file-upload/
│   │   └── FileUploader.test.tsx
│   └── extract/
│       └── ElementCard.test.tsx
└── stores/
    ├── file-store.test.ts
    └── extract-store.test.ts
```

**Validation Schema Tests:**

```typescript
// __tests__/lib/validations/document.test.ts
import { describe, it, expect } from 'vitest'
import { createDocumentSchema } from '@/lib/validations/document'

describe('Document Validation', () => {
  describe('createDocumentSchema', () => {
    it('should accept valid PDF file', () => {
      const validData = {
        name: 'tender.pdf',
        size: 1024 * 1024, // 1MB
        mimeType: 'application/pdf',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      }
      const result = createDocumentSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should reject file larger than 50MB', () => {
      const invalidData = {
        name: 'huge.pdf',
        size: 51 * 1024 * 1024, // 51MB
        mimeType: 'application/pdf',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      }
      const result = createDocumentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should reject unsupported mime types', () => {
      const invalidData = {
        name: 'malware.exe',
        size: 1024,
        mimeType: 'application/x-executable',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      }
      const result = createDocumentSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it('should only allow tender or bid category', () => {
      const validTender = {
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        category: 'tender',
        encryptedPath: '/storage/abc123.enc',
      }
      const validBid = {
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        category: 'bid',
        encryptedPath: '/storage/abc123.enc',
      }
      const invalidCategory = {
        name: 'test.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        category: 'invalid',
        encryptedPath: '/storage/abc123.enc',
      }
      expect(createDocumentSchema.safeParse(validTender).success).toBe(true)
      expect(createDocumentSchema.safeParse(validBid).success).toBe(true)
      expect(createDocumentSchema.safeParse(invalidCategory).success).toBe(false)
    })
  })
})
```

**Zustand Store Tests:**

```typescript
// __tests__/stores/file-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFileStore } from '@/stores/file-store'

describe('File Store', () => {
  beforeEach(() => {
    // Reset store state
    const store = useFileStore.getState()
    store.files = []
    store.isUploading = false
  })

  it('should add file to list', async () => {
    const { result } = renderHook(() => useFileStore())

    act(() => {
      result.current.addFile({
        id: 'uuid-1',
        name: 'tender.pdf',
        size: 1024,
        type: 'application/pdf',
        status: 'ready',
        createdAt: new Date().toISOString(),
      })
    })

    expect(result.current.files).toHaveLength(1)
    expect(result.current.files[0].name).toBe('tender.pdf')
  })

  it('should update file status', () => {
    const { result } = renderHook(() => useFileStore())

    act(() => {
      result.current.addFile({
        id: 'uuid-1',
        name: 'tender.pdf',
        size: 1024,
        type: 'application/pdf',
        status: 'uploading',
        createdAt: new Date().toISOString(),
      })
    })

    act(() => {
      result.current.updateFileStatus('uuid-1', 'ready')
    })

    expect(result.current.files[0].status).toBe('ready')
  })

  it('should remove file from list', () => {
    const { result } = renderHook(() => useFileStore())

    act(() => {
      result.current.addFile({
        id: 'uuid-1',
        name: 'tender.pdf',
        size: 1024,
        type: 'application/pdf',
        status: 'ready',
        createdAt: new Date().toISOString(),
      })
    })

    act(() => {
      result.current.removeFile('uuid-1')
    })

    expect(result.current.files).toHaveLength(0)
  })
})
```

### 2.2 Backend Unit Tests (src/backend/)

**Test File Structure:**
```
src/backend/tests/
├── unit/
│   ├── services/
│   │   ├── test_file_service.py
│   │   ├── test_encryption_service.py
│   │   └── test_llm_service.py
│   ├── models/
│   │   └── test_schemas.py
│   └── utils/
│       └── test_crypto.py
└── conftest.py
```

**Encryption Service Tests:**

```python
# tests/unit/services/test_encryption_service.py
import pytest
from cryptography.fernet import Fernet
from app.services.encryption_service import EncryptionService

class TestEncryptionService:
    @pytest.fixture
    def service(self):
        key = Fernet.generate_key()
        return EncryptionService(key)

    def test_encrypt_returns_different_data(self, service):
        original = b"sensitive document content"
        encrypted = service.encrypt(original)
        assert encrypted != original

    def test_decrypt_returns_original(self, service):
        original = b"sensitive document content"
        encrypted = service.encrypt(original)
        decrypted = service.decrypt(encrypted)
        assert decrypted == original

    def test_encrypted_data_is_bytes(self, service):
        original = b"test data"
        encrypted = service.encrypt(original)
        assert isinstance(encrypted, bytes)

    def test_different_encryptions_are_different(self, service):
        original = b"same data"
        encrypted1 = service.encrypt(original)
        encrypted2 = service.encrypt(original)
        assert encrypted1 != encrypted2

    def test_decrypt_wrong_data_raises_error(self, service):
        with pytest.raises(Exception):
            service.decrypt(b"invalid encrypted data")

    def test_generate_key_produces_valid_key(self):
        password = "test_password_123"
        salt = b"salt_value_12345"
        key = EncryptionService.generate_key(password, salt)
        assert len(key) == 44  # Fernet key is 44 bytes when base64 encoded
```

**LLM Service Tests:**

```python
# tests/unit/services/test_llm_service.py
import pytest
from unittest.mock import patch, MagicMock
from app.services.llm_service import LLMService

class TestLLMService:
    def test_model_mapping_deepseek(self):
        service = LLMService(provider="deepseek", api_key="test-key")
        assert service.model == "deepseek-v4-flash"

    def test_model_mapping_dashscope(self):
        service = LLMService(provider="dashscope", api_key="test-key")
        assert service.model == "qwen-turbo"

    def test_model_mapping_zhipu(self):
        service = LLMService(provider="zhipu", api_key="test-key")
        assert service.model == "glm-4-flash"

    def test_model_mapping_minimax(self):
        service = LLMService(provider="minimax", api_key="test-key")
        assert service.model == "MiniMax-M2.7"

    def test_model_mapping_openai(self):
        service = LLMService(provider="openai", api_key="test-key")
        assert service.model == "gpt-4o"

    def test_model_mapping_claude(self):
        service = LLMService(provider="claude", api_key="test-key")
        assert service.model == "claude-sonnet-4-6"

    def test_model_mapping_ollama(self):
        service = LLMService(provider="ollama", api_key="test-key")
        assert service.model == "llama3"

    @pytest.mark.asyncio
    async def test_complete_returns_content(self):
        service = LLMService(provider="openai", api_key="test-key")
        messages = [{"role": "user", "content": "test"}]

        with patch('app.services.llm_service.acompletion') as mock_complete:
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "Test response"
            mock_complete.return_value = mock_response

            result = await service.complete(messages, stream=False)
            assert result == "Test response"
```

**Statistics Service Tests:**

```python
# tests/unit/services/test_statistics_service.py
import pytest
from app.services.statistics_service import StatisticsService

class TestStatisticsService:
    def test_calculate_price_statistics_with_prices(self):
        prices = [100, 200, 150, 300, 250]
        result = StatisticsService.calculate_price_statistics(prices)

        assert result["average_price"] == 200
        assert result["lowest_price"] == 100
        assert result["highest_price"] == 300
        assert len(result["price_rankings"]) == 5
        assert result["price_rankings"][0]["rank"] == 1
        assert result["price_rankings"][0]["price"] == 100

    def test_calculate_price_statistics_empty_list(self):
        result = StatisticsService.calculate_price_statistics([])
        assert result == {}

    def test_calculate_dispersion_coefficient(self):
        prices = [100, 200, 300]
        result = StatisticsService.calculate_price_statistics(prices)
        assert "dispersion_coefficient" in result
        assert result["dispersion_coefficient"] > 0

    def test_calculate_price_changes(self):
        prices = [100, 90, 80]
        result = StatisticsService.calculate_price_statistics(prices)
        assert len(result["price_changes"]) == 2

    @pytest.mark.asyncio
    async def test_statistics_calculated_server_side(self):
        """Verify statistics are calculated on server, not returned raw"""
        prices = [100, 200, 150]
        result = await StatisticsService.calculate_price_statistics_async(prices)
        # Should contain processed data, not raw prices
        assert "average_price" in result
        assert "price_rankings" in result
```

---

## 3. Integration Tests

### 3.1 API Integration Tests

**Test File Structure:**
```
tests/integration/
├── api/
│   ├── test_files_api.py
│   ├── test_extract_api.py
│   └── test_settings_api.py
└── conftest.py
```

**Files API Integration Tests:**

```python
# tests/integration/api/test_files_api.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestFilesAPI:
    def setup_method(self):
        self.test_file = None

    def test_upload_pdf_success(self):
        response = client.post(
            "/api/files/upload",
            files={"file": ("tender.pdf", b"PDF content", "application/pdf")}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert "id" in data["data"]

    def test_upload_markdown_success(self):
        response = client.post(
            "/api/files/upload",
            files={"file": ("doc.md", b"# Markdown content", "text/markdown")}
        )
        assert response.status_code == 201

    def test_upload_unsupported_type_fails(self):
        response = client.post(
            "/api/files/upload",
            files={"file": ("virus.exe", b"executable", "application/x-executable")}
        )
        assert response.status_code == 400
        assert "File type not supported" in response.json()["detail"]

    def test_upload_file_too_large(self):
        # Create 51MB file content
        large_content = b"x" * (51 * 1024 * 1024)
        response = client.post(
            "/api/files/upload",
            files={"file": ("large.pdf", large_content, "application/pdf")}
        )
        assert response.status_code == 413

    def test_list_files(self):
        response = client.get("/api/files/list")
        assert response.status_code == 200
        assert "files" in response.json()

    def test_get_file_info(self):
        # First upload a file
        upload_resp = client.post(
            "/api/files/upload",
            files={"file": ("test.pdf", b"content", "application/pdf")}
        )
        file_id = upload_resp.json()["data"]["id"]

        # Then get info
        response = client.get(f"/api/files/{file_id}")
        assert response.status_code == 200
        assert response.json()["data"]["id"] == file_id

    def test_download_file(self):
        # Upload file
        upload_resp = client.post(
            "/api/files/upload",
            files={"file": ("test.pdf", b"content to download", "application/pdf")}
        )
        file_id = upload_resp.json()["data"]["id"]

        # Download
        response = client.get(f"/api/files/{file_id}/download")
        assert response.status_code == 200

    def test_delete_file(self):
        # Upload file
        upload_resp = client.post(
            "/api/files/upload",
            files={"file": ("test.pdf", b"content", "application/pdf")}
        )
        file_id = upload_resp.json()["data"]["id"]

        # Delete
        response = client.delete(f"/api/files/{file_id}")
        assert response.status_code == 200

        # Verify deleted
        get_resp = client.get(f"/api/files/{file_id}")
        assert get_resp.status_code == 404
```

**Settings API Integration Tests:**

```python
# tests/integration/api/test_settings_api.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

class TestSettingsAPI:
    def test_get_providers_list(self):
        response = client.get("/api/settings/providers")
        assert response.status_code == 200
        data = response.json()
        assert "providers" in data
        assert "active" in data

        # Verify provider structure
        providers = data["providers"]
        assert len(providers) >= 6  # OpenAI, DeepSeek, Claude, Dashscope, Zhipu, MiniMax

        # Verify each provider has required fields
        for provider in providers:
            assert "id" in provider
            assert "name" in provider
            assert "models" in provider

    def test_get_specific_provider(self):
        response = client.get("/api/settings/providers/deepseek")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "deepseek"

    def test_test_connection_success(self):
        # This test requires valid API key in environment
        # Skip if not configured
        import os
        if not os.environ.get("DEEPSEEK_API_KEY"):
            pytest.skip("API key not configured")

        response = client.post(
            "/api/settings/test",
            json={"provider": "deepseek"}
        )
        # May fail if key is invalid, but should not be 500
        assert response.status_code in [200, 400]

    def test_test_connection_invalid_provider(self):
        response = client.post(
            "/api/settings/test",
            json={"provider": "nonexistent_provider"}
        )
        assert response.status_code == 400
```

### 3.2 Database Integration Tests

```python
# tests/integration/db/test_database.py
import pytest
from app.infrastructure.database import Database
from app.models.schemas import DocumentCreate

@pytest.fixture
def db():
    return Database(DATABASE_URL)

class TestDatabaseIntegration:
    @pytest.mark.asyncio
    async def test_create_document(self, db):
        doc = await db.tender_documents.create({
            "name": "test.pdf",
            "size": 1024,
            "mime_type": "application/pdf",
            "category": "tender",
            "encrypted_path": "/storage/test.enc",
            "status": "ready"
        })

        assert doc.id is not None
        assert doc.name == "test.pdf"

        # Cleanup
        await db.tender_documents.delete(doc.id)

    @pytest.mark.asyncio
    async def test_create_and_retrieve_analysis(self, db):
        # Create document first
        doc = await db.tender_documents.create({
            "name": "test.pdf",
            "size": 1024,
            "mime_type": "application/pdf",
            "category": "tender",
            "encrypted_path": "/storage/test.enc",
            "status": "ready"
        })

        # Create analysis
        analysis = await db.analysis_results.create({
            "document_id": doc.id,
            "type": "element_extract",
            "status": "done",
            "result": {"elements": []}
        })

        assert analysis.id is not None

        # Retrieve with relationship
        retrieved = await db.analysis_results.get(analysis.id)
        assert retrieved.document_id == doc.id

        # Cleanup
        await db.analysis_results.delete(analysis.id)
        await db.tender_documents.delete(doc.id)

    @pytest.mark.asyncio
    async def test_cascade_delete(self, db):
        # Create document
        doc = await db.tender_documents.create({
            "name": "test.pdf",
            "size": 1024,
            "mime_type": "application/pdf",
            "category": "tender",
            "encrypted_path": "/storage/test.enc",
            "status": "ready"
        })

        # Create analysis
        analysis = await db.analysis_results.create({
            "document_id": doc.id,
            "type": "element_extract",
            "status": "done"
        })

        # Delete document - analysis should be cascade deleted
        await db.tender_documents.delete(doc.id)

        # Verify analysis is gone
        with pytest.raises(Exception):
            await db.analysis_results.get(analysis.id)

    @pytest.mark.asyncio
    async def test_ai_config_unique_provider(self, db):
        # Create first config
        config1 = await db.ai_configurations.create({
            "provider": "deepseek",
            "model": "deepseek-v4-flash",
            "is_active": True
        })

        # Try to create second active config for same provider should fail or replace
        # Based on db.spec.md, unique constraint on provider
        with pytest.raises(Exception):
            await db.ai_configurations.create({
                "provider": "deepseek",
                "model": "deepseek-v4-pro",
                "is_active": True
            })

        # Cleanup
        await db.ai_configurations.delete(config1.id)
```

---

## 4. E2E Tests

### 4.1 E2E Test Structure

**Test File Location:**
```
e2e/
├── auth.spec.ts
├── upload.spec.ts
├── extract.spec.ts
└── settings.spec.ts
```

### 4.2 Critical User Journeys

| Journey | Steps | Priority |
|---------|-------|----------|
| 文件上传 → 要素提取 | Upload PDF → Trigger Extract → View Results | Critical |
| AI 配置切换 | Settings → Change Provider → Verify | High |
| 文件管理 | Upload → List → Download → Delete | Medium |

### 4.3 E2E Test Cases

**upload.spec.ts:**
```typescript
// e2e/upload.spec.ts
import { test, expect } from '@playwright/test'

test.describe('File Upload', () => {
  test('user can upload PDF file', async ({ page }) => {
    await page.goto('/')

    // Wait for upload area
    const uploadArea = page.locator('[data-testid="upload-area"]')
    await expect(uploadArea).toBeVisible()

    // Upload file
    const fileChooser = page.locator('input[type="file"]')
    await fileChooser.setInputFiles({
      name: 'tender.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock content')
    })

    // Verify upload progress
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible()

    // Verify file appears in list
    await expect(page.locator('[data-testid="file-list"]')).toContainText('tender.pdf')
  })

  test('user sees error for unsupported file type', async ({ page }) => {
    await page.goto('/')

    const fileChooser = page.locator('input[type="file"]')
    await fileChooser.setInputFiles({
      name: 'virus.exe',
      mimeType: 'application/x-executable',
      buffer: Buffer.from('mock')
    })

    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('File type not supported')
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Supported: PDF, Markdown, Word, Excel')
  })

  test('upload progress is displayed', async ({ page }) => {
    await page.goto('/')

    // Large file simulation
    const fileChooser = page.locator('input[type="file"]')

    // Set up progress tracking
    await fileChooser.setInputFiles({
      name: 'large.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(1024 * 1024) // 1MB
    })

    // Progress bar should appear
    const progressBar = page.locator('[data-testid="upload-progress-bar"]')
    await expect(progressBar).toBeVisible()
  })
})
```

**extract.spec.ts:**
```typescript
// e2e/extract.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Element Extraction', () => {
  test('SSE streaming displays progress', async ({ page }) => {
    // Setup - upload file first
    await page.goto('/')
    const fileChooser = page.locator('input[type="file"]')
    await fileChooser.setInputFiles({
      name: 'tender.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 mock content')
    })

    // Wait for file to be ready
    await expect(page.locator('[data-testid="file-item"]').first()).toHaveAttribute('data-status', 'ready')

    // Trigger extraction
    await page.click('[data-testid="extract-button"]')

    // Verify streaming progress
    await expect(page.locator('[data-testid="stream-progress"]')).toBeVisible()
    await expect(page.locator('[data-testid="stream-progress"]')).toContainText(/正在解析|提取中/)

    // Wait for completion
    await expect(page.locator('[data-testid="element-card"]')).toBeVisible({ timeout: 30000 })
  })

  test('all five elements are displayed', async ({ page }) => {
    // Upload and trigger extraction
    await page.goto('/')
    const fileChooser = page.locator('input[type="file"]')
    await fileChooser.setInputFiles({
      name: 'tender.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 full content')
    })

    await page.click('[data-testid="extract-button"]')

    // Wait for all elements
    await expect(page.locator('[data-testid="element-资质要求"]')).toBeVisible()
    await expect(page.locator('[data-testid="element-评标办法"]')).toBeVisible()
    await expect(page.locator('[data-testid="element-业绩门槛"]')).toBeVisible()
    await expect(page.locator('[data-testid="element-定标方法"]')).toBeVisible()
    await expect(page.locator('[data-testid="element-合同条款"]')).toBeVisible()
  })

  test('user can interrupt extraction', async ({ page }) => {
    await page.goto('/')
    const fileChooser = page.locator('input[type="file"]')
    await fileChooser.setInputFiles({
      name: 'tender.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 content')
    })

    await page.click('[data-testid="extract-button"]')

    // Wait a bit for progress
    await page.waitForTimeout(2000)

    // Click stop button
    await page.click('[data-testid="stop-button"]')

    // Verify stopped state
    await expect(page.locator('[data-testid="stream-progress"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="stopped-message"]')).toBeVisible()
  })
})
```

**settings.spec.ts:**
```typescript
// e2e/settings.spec.ts
import { test, expect } from '@playwright/test'

test.describe('AI Settings', () => {
  test('user can view provider list', async ({ page }) => {
    await page.goto('/settings')

    // Verify all providers are listed
    await expect(page.locator('[data-testid="provider-deepseek"]')).toBeVisible()
    await expect(page.locator('[data-testid="provider-openai"]')).toBeVisible()
    await expect(page.locator('[data-testid="provider-claude"]')).toBeVisible()
    await expect(page.locator('[data-testid="provider-dashscope"]')).toBeVisible()
    await expect(page.locator('[data-testid="provider-zhipu"]')).toBeVisible()
    await expect(page.locator('[data-testid="provider-minimax"]')).toBeVisible()
  })

  test('user can switch active provider', async ({ page }) => {
    await page.goto('/settings')

    // Click on a different provider
    await page.click('[data-testid="provider-dashscope"]')

    // Verify selection
    await expect(page.locator('[data-testid="provider-dashscope"]')).toHaveAttribute('data-active', 'true')

    // Verify success message
    await expect(page.locator('[data-testid="toast"]')).toContainText('供应商切换成功')
  })

  test('connection test shows success', async ({ page }) => {
    await page.goto('/settings')

    // Find test button and click
    await page.click('[data-testid="test-connection-deepseek"]')

    // Wait for test result
    await expect(page.locator('[data-testid="test-result"]')).toBeVisible({ timeout: 10000 })

    // Verify success indicator
    await expect(page.locator('[data-testid="test-result"]')).toContainText(/成功|success/)
  })
})
```

---

## 5. Security Tests

### 5.1 Security Test Checklist

```markdown
## File Upload Security
- [ ] Only allowed MIME types accepted (PDF, Markdown, Word, Excel, CSV)
- [ ] File size limited to 50MB
- [ ] Files encrypted before storage (Fernet)
- [ ] File content not stored in plain text

## API Security
- [ ] API keys read from environment variables only
- [ ] No API keys stored in database
- [ ] Rate limiting enabled
- [ ] CORS properly configured

## Data Protection
- [ ] Statistics calculated server-side only
- [ ] No sensitive data exposed to frontend
- [ ] File download requires proper authorization check

## Input Validation
- [ ] All inputs validated with Zod (frontend)
- [ ] All inputs validated with Pydantic (backend)
- [ ] SQL injection prevented (ORM usage)
- [ ] XSS prevented (React auto-escaping)
```

### 5.2 Security Test Cases

**file-security.spec.ts:**
```typescript
// tests/security/file-security.spec.ts
import { test, expect } from '@playwright/test'

test.describe('File Upload Security', () => {
  test('only allowed file types are accepted', async ({ page }) => {
    await page.goto('/')

    // Try executable file
    const fileChooser = page.locator('input[type="file"]')
    await fileChooser.setInputFiles({
      name: 'malware.exe',
      mimeType: 'application/x-executable',
      buffer: Buffer.from('mock')
    })

    await expect(page.locator('[data-testid="error-message"]')).toContainText('not supported')
  })

  test('file size limit is enforced', async ({ page }) => {
    await page.goto('/')

    // Create a file larger than 50MB
    const largeBuffer = Buffer.alloc(51 * 1024 * 1024)
    const fileChooser = page.locator('input[type="file"]')
    await fileChooser.setInputFiles({
      name: 'huge.pdf',
      mimeType: 'application/pdf',
      buffer: largeBuffer
    })

    await expect(page.locator('[data-testid="error-message"]')).toContainText('too large')
  })
})

test.describe('API Security', () => {
  test('API keys are not exposed in client', async ({ page }) => {
    await page.goto('/')

    // Check network tab for any API key leakage
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    // Make API call
    await page.click('[data-testid="extract-button"]')
    await page.waitForTimeout(2000)

    // Verify no API keys in console
    for (const error of consoleErrors) {
      expect(error).not.toContain('api_key')
      expect(error).not.toContain('API_KEY')
    }
  })
})
```

---

## 6. 本地质量验证

项目当前不绑定第三方 CI 平台。提交前在本地执行 lint、类型检查、单元测试、集成测试、端到端测试和安全检查；生产发布前按照腾讯云部署文档完成构建与健康检查。


```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest --run",
    "test:unit:watch": "vitest",
    "test:coverage": "vitest --run --coverage",
    "test:integration": "vitest --run tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "type-check": "tsc --noEmit",
    "security:check": "npm audit"
  }
}
```

```python
# src/backend/pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto
```

---

## 7. Test Coverage Report

### 7.1 Coverage Targets by Component

| Component | Type | Target | Priority |
|-----------|------|--------|----------|
| src/lib/validations/* | Unit | 90% | High |
| src/frontend/stores/* | Unit | 85% | High |
| src/frontend/components/* | Component | 80% | Medium |
| src/backend/services/* | Unit | 85% | High |
| src/backend/api/* | Integration | 80% | High |
| E2E Critical Paths | E2E | 100% | Critical |

### 7.2 Quality Gates

| Gate | Threshold | Action |
|------|-----------|--------|
| Unit Test Coverage | < 70% | Block PR |
| Integration Test Pass | < 90% | Block PR |
| E2E Critical Path | < 100% | Block PR |
| Security Scan | Any High/Critical | Block PR |
| Lint Errors | Any | Block PR |

---

## 8. Testing Guide by User Story

### MS-L-01 (上传招标文件)
- [ ] 支持拖拽上传
- [ ] 支持点击选择
- [ ] 上传进度显示
- [ ] 成功/失败状态正确
- [ ] 不支持类型有清晰提示

### MS-L-02 (触发要素提取)
- [ ] SSE 流式响应正常
- [ ] 五要素完整展示
- [ ] 支持中断
- [ ] 统计分析服务端完成

### MS-D-01 (文件类型不支持)
- [ ] 错误消息列出支持类型
- [ ] 用户可关闭提示重选

### MS-L-04 (切换 AI 供应商)
- [ ] 供应商列表完整
- [ ] 切换成功提示
- [ ] 当前供应商高亮

### MS-D-02 (AI 连接测试失败)
- [ ] 无效 Key 显示明确错误
- [ ] 成功显示绿色对勾

---

## 9. Quality Checklist

- [ ] Testing pyramid is balanced (60% unit, 30% integration, 10% E2E)
- [ ] Unit tests cover all validation schemas
- [ ] Unit tests cover all Zustand stores
- [ ] Unit tests cover encryption service
- [ ] Unit tests cover LLM service model mapping
- [ ] Unit tests cover statistics calculation (server-side)
- [ ] Integration tests cover all API endpoints
- [ ] Integration tests cover database operations
- [ ] E2E tests cover critical user journeys
- [ ] Security tests validate real.md constraints
- [ ] CI pipeline runs all test stages
- [ ] Coverage meets minimum targets
- [ ] All user story acceptance criteria mapped to tests

---

**文档版本：** v1.0.0
**创建日期：** 2026-05-10
**维护者：** Bid Master Team