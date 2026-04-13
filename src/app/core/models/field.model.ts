export interface Field {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'object' | 'array';
  path?: string;
  children?: Field[];
  isExpanded?: boolean;
}
