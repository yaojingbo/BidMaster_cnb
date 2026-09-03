FROM python:3.12-slim

ARG TARGETARCH
ARG TYPST_VERSION=0.13.1

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PADDLEOCR_HOME=/data/paddleocr \
    OCR_SAVE_EVIDENCE=false \
    OCR_EVIDENCE_DIR=/data/ocr-evidence

WORKDIR /app

# 切换 Debian 源为腾讯云镜像（trixie 用 DEB822 格式，两个路径都兜底），
# 避免服务器访问 deb.debian.org 过慢导致 apt-get install 卡死
RUN set -eux; \
    if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
        sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list.d/debian.sources; \
    fi; \
    if [ -f /etc/apt/sources.list ]; then \
        sed -i 's|deb.debian.org|mirrors.cloud.tencent.com|g' /etc/apt/sources.list; \
    fi; \
    apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        fontconfig \
        fonts-noto-cjk \
        git \
        ghostscript \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
        libsm6 \
        libxext6 \
        libxrender1 \
        poppler-utils \
        qpdf \
        tesseract-ocr \
        tesseract-ocr-chi-sim \
        tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
      amd64) typst_arch="x86_64-unknown-linux-musl" ;; \
      arm64) typst_arch="aarch64-unknown-linux-musl" ;; \
      *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    typst_url="https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-${typst_arch}.tar.xz"; \
    curl -fsSL "https://ghproxy.net/${typst_url}" -o /tmp/typst.tar.xz \
      || curl -fsSL "https://mirror.ghproxy.com/${typst_url}" -o /tmp/typst.tar.xz \
      || curl -fsSL "${typst_url}" -o /tmp/typst.tar.xz; \
    tar -xf /tmp/typst.tar.xz -C /tmp; \
    cp "/tmp/typst-${typst_arch}/typst" /usr/local/bin/typst; \
    chmod +x /usr/local/bin/typst; \
    rm -rf /tmp/typst*; \
    typst --version

COPY src/backend/requirements.txt /app/requirements.txt
RUN pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ \
    && pip config set global.trusted-host mirrors.aliyun.com \
    && pip install --upgrade pip \
    && pip install -r /app/requirements.txt \
    && pip install ocrmypdf

COPY src/backend/app /app/app

RUN mkdir -p /data/paddleocr /data/ocr-evidence /app/uploads /app/tmp \
    && useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app /data

USER appuser

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
