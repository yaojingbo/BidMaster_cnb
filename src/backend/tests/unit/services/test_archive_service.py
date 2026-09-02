"""安全 ZIP 摄取测试。"""
import io
import zipfile

import pytest

from app.services.archive_service import SafeZipService
from app.utils.exceptions import AppError


def build_zip(entries: dict[str, bytes]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries.items():
            archive.writestr(name, content)
    return output.getvalue()


def test_zip读取多个pdf():
    items = SafeZipService().read_pdfs(build_zip({
        "一/a.pdf": b"%PDF-1.4\na",
        "二/b.pdf": b"%PDF-1.4\nb",
    }))
    assert [item.path for item in items] == ["一/a.pdf", "二/b.pdf"]


@pytest.mark.parametrize("name", ["../a.pdf", "/a.pdf", "C:/a.pdf"])
def test_zip拒绝不安全路径(name: str):
    with pytest.raises(AppError) as error:
        SafeZipService().read_pdfs(build_zip({name: b"%PDF-1.4\na"}))
    assert error.value.code == "ARCHIVE_UNSAFE_PATH"


def test_zip拒绝非pdf成员():
    with pytest.raises(AppError) as error:
        SafeZipService().read_pdfs(build_zip({"a.pdf": b"%PDF-1.4\na", "readme.txt": b"x"}))
    assert error.value.code == "ARCHIVE_NON_PDF_ENTRY"


def test_zip拒绝伪pdf():
    with pytest.raises(AppError) as error:
        SafeZipService().read_pdfs(build_zip({"a.pdf": b"not pdf"}))
    assert error.value.code == "ARCHIVE_INVALID_PDF"
