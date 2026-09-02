import hashlib
import math
from collections import defaultdict


class DeterministicFakeEmbedding:
    """测试专用确定性向量，不可由生产工厂创建。"""

    async def embed_texts(self, texts: list[str], user_id: str | None = None) -> list[list[float]]:
        return [self._embed(text) for text in texts]

    @staticmethod
    def _embed(text: str) -> list[float]:
        vector = [0.0] * 1024
        for token in text.lower().split():
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:2], "big") % 1024
            vector[index] += 1.0
        norm = math.sqrt(sum(value * value for value in vector)) or 1.0
        return [value / norm for value in vector]


class InMemoryVectorStore:
    def __init__(self, rows: list[dict]):
        self.rows = rows

    async def vector_search(self, user_id: str, file_ids: list[str], vector: list[float], limit: int) -> list[dict]:
        rows = [dict(row) for row in self.rows if row["user_id"] == user_id and row["file_id"] in file_ids]
        for row in rows:
            row["score"] = sum(a * b for a, b in zip(row["embedding"], vector))
        return sorted(rows, key=lambda row: row["score"], reverse=True)[:limit]

    async def keyword_search(self, user_id: str, file_ids: list[str], query: str, limit: int) -> list[dict]:
        words = set(query.lower().split())
        rows = []
        for source in self.rows:
            if source["user_id"] != user_id or source["file_id"] not in file_ids:
                continue
            score = len(words & set(source["content"].lower().split()))
            if score:
                row = dict(source)
                row["score"] = float(score)
                rows.append(row)
        return sorted(rows, key=lambda row: row["score"], reverse=True)[:limit]


class FakeAnswerGenerator:
    def __init__(self, answer: str = "投标保证金要求见文件。[1]"):
        self.answer = answer
        self.calls = 0

    async def generate(self, messages: list[dict], provider: str, model: str | None, user_id: str) -> str:
        self.calls += 1
        return self.answer
