import db from '../db';
import type { Track } from '../types/database';

type SqlParam = string | number | bigint | null;

export type SmartPlaylistOperator =
  | 'is'
  | 'isNot'
  | 'contains'
  | 'notContains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'inLastDays';

export interface SmartPlaylistRule {
  field: string;
  operator: SmartPlaylistOperator;
  value: unknown;
}

export interface SmartPlaylistRules {
  matchMode: 'all' | 'any';
  conditions: SmartPlaylistRule[];
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export class SmartPlaylistService {
  static evaluate(rules: SmartPlaylistRules): Track[] {
    let sql = 'SELECT * FROM tracks';
    const params: SqlParam[] = [];
    const whereClauses: string[] = [];

    for (const condition of rules.conditions) {
      const clause = this.buildClause(condition, params);
      if (clause) {
        whereClauses.push(clause);
      }
    }

    if (whereClauses.length > 0) {
      const joiner = rules.matchMode === 'any' ? ' OR ' : ' AND ';
      sql += ' WHERE ' + whereClauses.join(joiner);
    }

    if (rules.sortBy) {
      const dir = rules.sortDir === 'desc' ? 'DESC' : 'ASC';
      const allowedFields = ['title', 'artist', 'album', 'bpm', 'added_at', 'duration', 'loudness'];
      if (allowedFields.includes(rules.sortBy)) {
        sql += ` ORDER BY ${rules.sortBy} ${dir}`;
      }
    }

    if (rules.limit) {
      sql += ' LIMIT ?';
      params.push(rules.limit);
    }

    return db.prepare(sql).all(...params) as Track[];
  }

  private static buildClause(condition: SmartPlaylistRule, params: SqlParam[]): string | null {
    const field = condition.field;
    const allowedFields = [
      'title',
      'artist',
      'album',
      'genre',
      'year',
      'bpm',
      'duration',
      'loudness',
      'added_at',
      'key',
      'camelot_key',
      'play_count',
      'last_played',
    ];
    if (!allowedFields.includes(field)) return null;

    let sqlField = field;
    if (field === 'title' || field === 'artist' || field === 'album' || field === 'genre') {
      sqlField = `LOWER(${field})`;
    }

    switch (condition.operator) {
      case 'is':
        params.push(asString(condition.value));
        return `${sqlField} = ?`;
      case 'isNot':
        params.push(asString(condition.value));
        return `${sqlField} != ?`;
      case 'contains':
        params.push(`%${asString(condition.value).toLowerCase()}%`);
        return `${sqlField} LIKE ?`;
      case 'notContains':
        params.push(`%${asString(condition.value).toLowerCase()}%`);
        return `${sqlField} NOT LIKE ?`;
      case 'gt':
      case 'gte': {
        const n = asNumber(condition.value);
        if (n === null) return null;
        params.push(n);
        return `${field} ${condition.operator === 'gt' ? '>' : '>='} ?`;
      }
      case 'lt':
      case 'lte': {
        const n = asNumber(condition.value);
        if (n === null) return null;
        params.push(n);
        return `${field} ${condition.operator === 'lt' ? '<' : '<='} ?`;
      }
      case 'between': {
        if (!Array.isArray(condition.value) || condition.value.length !== 2) return null;
        const lo = asNumber(condition.value[0]);
        const hi = asNumber(condition.value[1]);
        if (lo === null || hi === null) return null;
        params.push(lo, hi);
        return `${field} BETWEEN ? AND ?`;
      }
      case 'inLastDays': {
        const days = asNumber(condition.value);
        if (days === null) return null;
        const cutoff = Date.now() - days * 86400000;
        params.push(cutoff);
        return `${field} > ?`;
      }
      default:
        return null;
    }
  }
}
