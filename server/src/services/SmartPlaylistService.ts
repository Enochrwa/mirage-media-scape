import crypto from 'crypto';
import type { Database } from 'better-sqlite3';

export interface SmartPlaylistDefinition {
  conditions: RuleCondition[];
  matchMode: 'all' | 'any';
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface RuleCondition {
  field: string;
  operator: string;
  value: unknown;
}

export class SmartPlaylistService {
  private allowedFields = new Set([
    'title',
    'artist',
    'album',
    'genre',
    'year',
    'bpm',
    'rating',
    'play_count',
    'last_played',
    'added_at',
    'duration',
    'key',
    'camelot_key',
    'energy',
    'skip_count',
  ]);

  private allowedSortFields = new Set([
    'title',
    'artist',
    'album',
    'genre',
    'year',
    'bpm',
    'rating',
    'play_count',
    'added_at',
    'duration',
    'energy',
    'skip_count',
  ]);

  constructor(private db: Database) {}

  evaluate(definition: SmartPlaylistDefinition): Record<string, unknown>[] {
    const { conditions, matchMode, limit, sortBy, sortDir } = definition;
    let query = 'SELECT * FROM tracks WHERE missing = 0';
    const params: unknown[] = [];

    if (sortBy && !this.allowedSortFields.has(sortBy)) {
      throw new Error(`Invalid sort field: ${sortBy}`);
    }

    if (conditions.length > 0) {
      const clauses = conditions.map((cond) => {
        if (!this.allowedFields.has(cond.field)) {
          throw new Error(`Invalid field: ${cond.field}`);
        }
        const clause = this.buildConditionClause(cond);

        const value = cond.value;
        if (Array.isArray(value)) {
          params.push(...value);
        } else if (
          cond.operator === 'contains' ||
          cond.operator === 'not_contains'
        ) {
          params.push(`%${String(value)}%`);
        } else if (cond.operator === 'starts_with') {
          params.push(`${String(value)}%`);
        } else if (cond.operator === 'in_last_days' && typeof value === 'number') {
          params.push(Math.floor(Date.now() / 1000) - value * 86400);
        } else {
          params.push(value);
        }

        return clause;
      });

      const joined = clauses.join(matchMode === 'all' ? ' AND ' : ' OR ');
      query += ` AND (${joined})`;
    }

    if (sortBy) {
      const dir = sortDir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${sortBy} ${dir}`;
    }

    if (limit) {
      query += ` LIMIT ${Math.max(1, Math.floor(limit))}`;
    }

    return this.db.prepare(query).all(...params) as Record<string, unknown>[];
  }

  private buildConditionClause(cond: RuleCondition): string {
    const field = cond.field;
    switch (cond.operator) {
      case 'is':
        return `${field} = ?`;
      case 'is_not':
        return `${field} != ?`;
      case 'contains':
        return `${field} LIKE ?`;
      case 'not_contains':
        return `${field} NOT LIKE ?`;
      case 'starts_with':
        return `${field} LIKE ?`;
      case 'gt':
        return `${field} > ?`;
      case 'lt':
        return `${field} < ?`;
      case 'gte':
        return `${field} >= ?`;
      case 'lte':
        return `${field} <= ?`;
      case 'between':
        return `${field} BETWEEN ? AND ?`;
      case 'in_last_days':
        return `${field} >= ?`;
      case 'before':
        return `${field} < ?`;
      case 'after':
        return `${field} > ?`;
      default:
        throw new Error(`Unsupported operator: ${cond.operator}`);
    }
  }

  async generateSystemPlaylists(): Promise<void> {
    const systemPlaylists = [
      {
        name: 'Most Played',
        definition: JSON.stringify({
          conditions: [{ field: 'play_count', operator: 'gt', value: 0 }],
          matchMode: 'all',
          limit: 25,
          sortBy: 'play_count',
          sortDir: 'desc',
        }),
      },
      {
        name: 'Recently Added',
        definition: JSON.stringify({
          conditions: [{ field: 'added_at', operator: 'in_last_days', value: 14 }],
          matchMode: 'all',
          sortBy: 'added_at',
          sortDir: 'desc',
        }),
      },
      {
        name: 'Long Tracks',
        definition: JSON.stringify({
          conditions: [{ field: 'duration', operator: 'gt', value: 480 }],
          matchMode: 'all',
          sortBy: 'duration',
          sortDir: 'desc',
        }),
      },
      {
        name: 'High Energy',
        definition: JSON.stringify({
          conditions: [
            { field: 'energy', operator: 'gt', value: 0.7 },
            { field: 'bpm', operator: 'gt', value: 120 },
          ],
          matchMode: 'all',
          sortBy: 'bpm',
          sortDir: 'desc',
        }),
      },
    ];

    for (const p of systemPlaylists) {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO smart_playlists (id, name, definition, created_at, updated_at, is_system)
           VALUES (?, ?, ?, ?, ?, 1)`,
        )
        .run(crypto.randomUUID(), p.name, p.definition, Date.now(), Date.now());
    }
  }
}