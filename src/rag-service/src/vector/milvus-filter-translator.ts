import { BaseFilterTranslator, type VectorFilter } from '@mastra/core/vector/filter';

/**
 * 把 Mastra 的 MongoDB 风格 VectorFilter 翻译成 Milvus 布尔表达式字符串。
 *
 * 支持的操作符子集见 specs/dev/zilliz-vector-store.spec.md §6.2：
 *   $eq/$ne/$gt/$gte/$lt/$lte/$in/$nin 与 $and/$or。
 * 不支持的（$not/$nor/$exists/$regex/$elemMatch/$all）直接抛错，不静默降级。
 */
/** 字段名只允许标识符字符，防止注入 Milvus 表达式 */
const FIELD_NAME_PATTERN = /^[A-Za-z0-9_]+$/;

export class MilvusFilterTranslator extends BaseFilterTranslator<VectorFilter, string> {
  translate(filter: VectorFilter): string {
    if (filter == null) return '';
    if (typeof filter !== 'object' || Array.isArray(filter)) {
      throw new Error('Milvus 过滤器必须是对象');
    }
    return this.translateNode(filter);
  }

  private translateNode(node: Record<string, unknown>): string {
    const clauses: string[] = [];
    for (const [key, value] of Object.entries(node)) {
      if (key === '$and' || key === '$or') {
        const op = key === '$and' ? '&&' : '||';
        if (!Array.isArray(value)) throw new Error(`${key} 需要数组`);
        const parts = value.map((item) => this.translateNode(item as Record<string, unknown>));
        clauses.push(`(${parts.join(` ${op} `)})`);
      } else if (key.startsWith('$')) {
        throw new Error(`Milvus 不支持的操作符: ${key}`);
      } else {
        clauses.push(this.translateField(key, value));
      }
    }
    return clauses.join(' && ');
  }

  private translateField(field: string, value: unknown): string {
    if (!FIELD_NAME_PATTERN.test(field)) {
      throw new Error(`非法的字段名: ${field}`);
    }
    if (isOperatorObject(value)) {
      const parts: string[] = [];
      for (const [op, opValue] of Object.entries(value as Record<string, unknown>)) {
        parts.push(this.translateOperator(field, op, opValue));
      }
      return parts.length === 1 ? parts[0] : `(${parts.join(' && ')})`;
    }
    if (value === null || value === undefined) {
      throw new Error(`字段 ${field} 的值为空，无法翻译`);
    }
    return `${field} == ${formatValue(value)}`;
  }

  private translateOperator(field: string, op: string, value: unknown): string {
    switch (op) {
      case '$eq': return `${field} == ${formatValue(value)}`;
      case '$ne': return `${field} != ${formatValue(value)}`;
      case '$gt': return `${field} > ${formatValue(value)}`;
      case '$gte': return `${field} >= ${formatValue(value)}`;
      case '$lt': return `${field} < ${formatValue(value)}`;
      case '$lte': return `${field} <= ${formatValue(value)}`;
      case '$in': return `${field} in ${formatArray(value, '$in')}`;
      case '$nin': return `${field} not in ${formatArray(value, '$nin')}`;
      default:
        throw new Error(`Milvus 不支持的操作符: ${op}`);
    }
  }
}

function isOperatorObject(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function formatArray(value: unknown, op: string): string {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${op} 需要非空数组`);
  return `[${value.map(formatValue).join(', ')}]`;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return `"${value.toISOString()}"`;
  throw new Error(`不支持的过滤值类型: ${typeof value}`);
}
