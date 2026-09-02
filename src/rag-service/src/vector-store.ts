export type VectorMetadata = {
  chunkId: string;
  userId: string;
  fileId: string;
  indexId: string;
  indexVersion: string;
};

export type VectorMatch = VectorMetadata & { score: number };

export interface VectorStore {
  search(vector: readonly number[], options: {
    userId: string;
    fileIds?: readonly string[];
    indexVersion: string;
    topK: number;
  }): Promise<readonly VectorMatch[]>;
}

export class InMemoryVectorStore implements VectorStore {
  private readonly entries: Array<VectorMetadata & { vector: readonly number[] }> = [];

  add(entry: VectorMetadata & { vector: readonly number[] }): void { this.entries.push(entry); }

  async search(vector: readonly number[], options: {
    userId: string;
    fileIds?: readonly string[];
    indexVersion: string;
    topK: number;
  }): Promise<readonly VectorMatch[]> {
    const allowedFiles = options.fileIds ? new Set(options.fileIds) : undefined;
    return this.entries
      .filter((entry) => entry.userId === options.userId && entry.indexVersion === options.indexVersion
        && (!allowedFiles || allowedFiles.has(entry.fileId)))
      .map((entry) => ({ ...entry, score: cosineSimilarity(vector, entry.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.topK)
      .map(({ vector: _vector, ...match }) => match);
  }
}

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0; let leftMagnitude = 0; let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  return leftMagnitude === 0 || rightMagnitude === 0 ? 0 : dot / Math.sqrt(leftMagnitude * rightMagnitude);
}
