export type RuleField = 'title' | 'artist' | 'album' | 'genre' | 'year' | 'bpm' | 'rating' | 'play_count'
  | 'last_played' | 'added_at' | 'duration' | 'key' | 'camelot_key' | 'energy' | 'skip_count';

export type RuleOperator = 'is' | 'is_not' | 'contains' | 'not_contains' | 'starts_with'
  | 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'in_last_days' | 'before' | 'after';

export interface RuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: string | number | [number, number];
}

export interface SmartPlaylistDefinition {
  conditions: RuleCondition[];
  matchMode: 'all' | 'any';
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}
