import { Injectable } from '@angular/core';
import { ReportData } from '../models/report.model';
import { ReportTemplate, TemplateSection, TemplateElement, TableData } from '../models/template.model';

export interface RenderedElement {
  content: string;
  imageUrl?: string;
  table?: TableData;
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
  templateSection?: TemplateSection;
}

export interface RenderedReport {
  sections: RenderedSection[];
}

@Injectable({ providedIn: 'root' })
export class RenderService {
  renderReport(data: ReportData[], template: ReportTemplate, rawData?: any): RenderedReport {
    const sections: RenderedSection[] = [];

    for (const section of template.sections) {
      if (section.repeatPerRow) {
        const rows = data.length > 0 ? data : [{}];
        for (const row of rows) {
          sections.push(this.renderSection(section, row as ReportData, true, data, rawData));
        }
      } else {
        const baseRow = section.type === 'details' && data.length > 0 ? data[0] : {};
        sections.push(this.renderSection(section, baseRow as ReportData, false, data, rawData));
      }
    }

    return { sections };
  }

  private renderSection(section: TemplateSection, row: ReportData, isDetail: boolean, fullData: ReportData[], rawData?: any): RenderedSection {
    const elements: RenderedElement[] = section.elements.map((el) => {
      let renderedContent = el.content || '';
      if (el.type === 'field') {
        renderedContent = this.interpolate(renderedContent, row);
      }
      return {
        id: el.id,
        content: renderedContent,
        imageUrl: (el as any).imageUrl,
        table: el.type === 'table' ? this.renderTable(el, row, fullData, rawData) : undefined,
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
      templateSection: section,
    };
  }

  private renderTable(el: TemplateElement, contextRow: ReportData, fullData: ReportData[], rawData?: any): TableData | undefined {
    const table = el.table;
    if (!table) return undefined;
    
    // Choose the data source for the table
    let tableSource = fullData;
    if (el.datasetPath && rawData) {
      const resolved = this.getValueByPath(rawData, el.datasetPath);
      if (Array.isArray(resolved)) {
        tableSource = resolved;
      } else if (resolved && typeof resolved === 'object' && resolved !== null) {
        // Treat single object as a list of 1 for repeating rows
        tableSource = [resolved];
      }
    }
    
    if (table.dynamicRows && tableSource && tableSource.length > 0) {
      if (table.cells.length === 0) return table;
      
      const templateBlock = table.cells;
      const templateRowHeights = table.rowHeights?.length === table.rows ? table.rowHeights : Array.from({ length: table.rows }, () => 36);
      
      const newCells: any[][] = [];
      const newRowHeights: number[] = [];
      
      tableSource.forEach(row => {
        templateBlock.forEach((tRow, idx) => {
          newCells.push(tRow.map(cell => this.processCell(cell, row, true)));
          newRowHeights.push(templateRowHeights[idx]);
        });
      });
      
      return {
        ...table,
        rows: newCells.length,
        cells: newCells,
        rowHeights: newRowHeights,
      };
    }

    const hasRowData = Object.keys(contextRow).length > 0;
    return {
      ...table,
      rowHeights: table.rowHeights?.length === table.rows ? [...table.rowHeights] : Array.from({ length: table.rows }, () => 36),
      columnSettings: table.columnSettings?.length === table.columns ? table.columnSettings.map(col => ({ ...col })) : Array.from({ length: table.columns }, (_v, index) => ({ width: 120, order: index, visible: true })),
      cells: table.cells.map(cellsRow => cellsRow.map(cell => this.processCell(cell, contextRow, hasRowData))),
    };
  }

  private processCell(cell: any, row: ReportData, hasData: boolean): any {
    if (cell.fieldPath) {
      const value = this.getValueByPath(row, cell.fieldPath);
      return {
        ...cell,
        content: value === undefined ? (hasData ? '' : `{{${cell.fieldPath}}}`) : typeof value === 'object' ? JSON.stringify(value) : String(value),
      };
    }
    return { ...cell, content: this.interpolate(cell.content || '', row) };
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
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    return normalizedPath.split('.').filter(p => p).reduce((acc, key) => acc?.[key], obj);
  }
}
