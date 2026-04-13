import { Injectable } from '@angular/core';
import { ReportData } from '../models/report.model';
import { ReportTemplate, TemplateSection, TemplateElement } from '../models/template.model';

export interface RenderedElement {
  content: string;
  imageUrl?: string;
  size?: { width: number; height: number };
  x: number;
  y: number;
  style: TemplateElement['style'];
  id: string;
  type: string;
}

export interface RenderedSection {
  label: string;
  sectionType: string;
  elements: RenderedElement[];
  rowData?: ReportData;
  height: number;
  isDetail: boolean;
}

export interface RenderedReport {
  sections: RenderedSection[];
}

@Injectable({ providedIn: 'root' })
export class RenderService {
  renderReport(data: ReportData[], template: ReportTemplate): RenderedReport {
    const sections: RenderedSection[] = [];

    for (const section of template.sections) {
      if (section.type === 'details') {
        for (const row of data) {
          sections.push(this.renderSection(section, row, true));
        }
      } else {
        sections.push(this.renderSection(section, {}, false));
      }
    }

    return { sections };
  }

  private renderSection(section: TemplateSection, row: ReportData, isDetail: boolean): RenderedSection {
    const elements: RenderedElement[] = section.elements.map((el) => {
      let renderedContent = el.content || '';
      if (el.type === 'field') {
        renderedContent = this.interpolate(renderedContent, row);
      }
      return {
        id: el.id,
        content: renderedContent,
        imageUrl: (el as any).imageUrl,
        size: el.size,
        x: el.position.x,
        y: el.position.y,
        style: el.style,
        type: el.type
      } as any;
    });

    return {
      label: section.label,
      sectionType: section.type,
      elements,
      rowData: isDetail ? row : undefined,
      height: section.height,
      isDetail,
    };
  }

  interpolate(content: string, row: ReportData): string {
    return content.replace(/\{\{([^}]+)\}\}/g, (_match, expr) => {
      try {
        const trimmed = expr.trim();
        let result = this.getValueByPath(row, trimmed);
        
        if (result === undefined) {
          const keys = Object.keys(row);
          const values = Object.values(row);
          const fn = new Function(...keys, `return ${trimmed}`);
          result = fn(...values);
        }
        
        return result !== undefined && result !== null ? typeof result === 'object' ? JSON.stringify(result) : String(result) : '';
      } catch {
        return `{{${expr}}}`;
      }
    });
  }

  getValueByPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }
}
