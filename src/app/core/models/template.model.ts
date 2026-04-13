export type SectionType = 'reportHeader' | 'pageHeader' | 'details' | 'footer';

export interface ElementStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  color: string;
}

export interface TableCell {
  content: string;
  fieldPath?: string;
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
}

export interface TemplateSection {
  id: string;
  type: SectionType;
  label: string;
  elements: TemplateElement[];
  height: number;
  repeatPerRow: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  sections: TemplateSection[];
}

export const DEFAULT_STYLE: ElementStyle = {
  fontSize: 12,
  fontFamily: '"Segoe UI", Arial, sans-serif',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: '#1a1a1a',
};
