"""安全 ZIP 摄取测试。"""
import io
import struct
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


def build_zip_without_utf8_flag(entries: dict[str, bytes]) -> bytes:
    """造一个文件名是 UTF-8 字节却未置 UTF-8 标志位的 ZIP，模拟部分压缩工具的行为。"""
    data = bytearray(build_zip(entries))
    # 清除 local file header 与 central directory 里的 UTF-8 标志位（第 11 位 = 0x0800）。
    pos = 0
    while True:
        index = data.find(b"PK\x03\x04", pos)
        if index < 0:
            break
        flags = struct.unpack_from("<H", data, index + 6)[0]
        struct.pack_into("<H", data, index + 6, flags & ~0x0800)
        pos = index + 4
    pos = 0
    while True:
        index = data.find(b"PK\x01\x02", pos)
        if index < 0:
            break
        flags = struct.unpack_from("<H", data, index + 8)[0]
        struct.pack_into("<H", data, index + 8, flags & ~0x0800)
        pos = index + 4
    return bytes(data)


def test_zip读取多个pdf():
    items = SafeZipService().read_pdfs(build_zip({
        "一/a.pdf": b"%PDF-1.4\na",
        "二/b.pdf": b"%PDF-1.4\nb",
    }))
    assert [item.path for item in items] == ["一/a.pdf", "二/b.pdf"]


def test_zip还原未置utf8标志的中文文件名():
    name = "01_天台平桥污水处理厂.pdf"
    items = SafeZipService().read_pdfs(build_zip_without_utf8_flag({name: b"%PDF-1.4\na"}))
    assert [item.path for item in items] == [name]


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
