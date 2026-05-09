import db from '../db';
import { Track } from '../types/database';

export interface SmartPlaylistRule {
    field: string;
    operator: 'is' | 'isNot' | 'contains' | 'notContains' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'inLastDays';
    value: string | number | number[];
}

export interface SmartPlaylistRules {
    matchMode: 'all' | 'any';
    conditions: SmartPlaylistRule[];
    limit?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
}

export class SmartPlaylistService {
    static evaluate(rules: SmartPlaylistRules): Track[] {
        let sql = 'SELECT * FROM tracks';
        const params: (string | number)[] = [];
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
            // Sanitize field name for ORDER BY as it can't be parameterized
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

    private static buildClause(condition: SmartPlaylistRule, params: (string | number)[]): string | null {
        const field = condition.field;
        // Basic validation of field names to prevent SQL injection
        const allowedFields = ['title', 'artist', 'album', 'genre', 'year', 'bpm', 'duration', 'loudness', 'added_at', 'key', 'camelot_key', 'play_count', 'last_played'];
        if (!allowedFields.includes(field)) return null;

        let sqlField = field;
        if (['title', 'artist', 'album', 'genre'].includes(field)) {
            sqlField = `LOWER(${field})`;
        }

        const value = condition.value;

        switch (condition.operator) {
            case 'is':
                params.push(value as string | number);
                return `${sqlField} = ?`;
            case 'isNot':
                params.push(value as string | number);
                return `${sqlField} != ?`;
            case 'contains':
                params.push(`%${(value as string).toLowerCase()}%`);
                return `${sqlField} LIKE ?`;
            case 'notContains':
                params.push(`%${(value as string).toLowerCase()}%`);
                return `${sqlField} NOT LIKE ?`;
            case 'gt':
            case 'gte':
                params.push(value as string | number);
                return `${field} ${condition.operator === 'gt' ? '>' : '>='} ?`;
            case 'lt':
            case 'lte':
                params.push(value as string | number);
                return `${field} ${condition.operator === 'lt' ? '<' : '<='} ?`;
            case 'between':
                if (Array.isArray(value) && value.length === 2) {
                    params.push(value[0], value[1]);
                    return `${field} BETWEEN ? AND ?`;
                }
                return null;
            case 'inLastDays': {
                const cutoff = Date.now() - (Number(value) * 86400000);
                params.push(cutoff);
                return `${field} > ?`;
            }
            default:
                return null;
        }
    }
}
