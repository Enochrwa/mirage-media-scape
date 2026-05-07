import db from '../db';

export interface SmartPlaylistRule {
    field: string;
    operator: 'is' | 'contains' | 'gt' | 'lt' | 'between';
    value: any;
}

export interface SmartPlaylistRules {
    matchMode: 'all' | 'any';
    conditions: SmartPlaylistRule[];
    limit?: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
}

export class SmartPlaylistService {
    static evaluate(rules: SmartPlaylistRules): any[] {
        let sql = 'SELECT * FROM tracks';
        const params: any[] = [];
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

        return db.prepare(sql).all(...params);
    }

    private static buildClause(condition: SmartPlaylistRule, params: any[]): string | null {
        const field = condition.field;
        // Basic validation of field names to prevent SQL injection
        const allowedFields = ['title', 'artist', 'album', 'genre', 'year', 'bpm', 'duration', 'loudness', 'added_at'];
        if (!allowedFields.includes(field)) return null;

        switch (condition.operator) {
            case 'is':
                params.push(condition.value);
                return `${field} = ?`;
            case 'contains':
                params.push(`%${condition.value}%`);
                return `${field} LIKE ?`;
            case 'gt':
                params.push(condition.value);
                return `${field} > ?`;
            case 'lt':
                params.push(condition.value);
                return `${field} < ?`;
            case 'between':
                if (Array.isArray(condition.value) && condition.value.length === 2) {
                    params.push(condition.value[0], condition.value[1]);
                    return `${field} BETWEEN ? AND ?`;
                }
                return null;
            default:
                return null;
        }
    }
}
