export type SectionType = 'reportHeader' | 'pageHeader' | 'details' | 'footer';

export interface ElementStyle {
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  color: string;
}

export interface TemplateElement {
  id: string;
  type: 'text';
  content: string;
  position: { x: number; y: number };
  style: ElementStyle;
  boundField?: string;
}

export interface TemplateSection {
  type: SectionType;
  label: string;
  elements: TemplateElement[];
  height: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  sections: TemplateSection[];
}

export const DEFAULT_STYLE: ElementStyle = {
  fontSize: 12,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: '#1a1a1a',
};
