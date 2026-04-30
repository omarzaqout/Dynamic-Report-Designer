export type SectionType = 'reportHeader' | 'pageHeader' | 'details' | 'footer';

export interface ElementStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  color: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  whiteSpace?: 'nowrap' | 'normal' | 'pre-wrap';
  border?: string;
  borderColor?: string;
  padding?: number;
}

export type AggregationType = 'none' | 'sum' | 'avg' | 'min' | 'max' | 'count' | 'join';

export interface FieldCondition {
  field: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains';
  value: any;
}

export interface TableCell {
  content: string;
  fieldPath?: string;
  style?: Partial<ElementStyle>;
  imageUrl?: string;
  isQRCode?: boolean;
  icon?: string;
  aggregation?: AggregationType;
  conditions?: FieldCondition[];
}

export interface TableColumnSetting {
  width: number;
  order: number;
  visible: boolean;
}

export interface TableData {
  rows: number;
  columns: number;
  cells: TableCell[][];
  rowHeights: number[];
  columnSettings: TableColumnSetting[];
  dynamicRows?: boolean;
  fullWidth?: boolean;
  previousWidths?: number[];
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'field' | 'image' | 'table';
  content?: string;
  fieldPath?: string;
  imageUrl?: string;
  table?: TableData;
  size?: { width: number; height: number };
  position: { x: number; y: number };
  style: ElementStyle;
  boundField?: string;
  datasetPath?: string;
  isQRCode?: boolean;
  qrCodeField?: string;
  icon?: string;
  aggregation?: AggregationType;
  conditions?: FieldCondition[];
}

export interface TemplateSection {
  id: string;
  type: SectionType;
  label: string;
  elements: TemplateElement[];
  height: number;
  repeatPerRow: boolean;
  repeatOnEveryPage?: boolean;
  datasetPath?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  sections: TemplateSection[];
  margin?: { top: number; right: number; bottom: number; left: number };
  dataSourceUrl?: string;
}

export const DEFAULT_STYLE: ElementStyle = {
  fontSize: 12,
  fontFamily: '"Segoe UI", Arial, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: '#1a1a1a',
};
