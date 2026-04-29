import { Injectable } from '@angular/core';
import { ReportData } from '../models/report.model';
import { ReportTemplate, TemplateSection, TemplateElement, TableData } from '../models/template.model';

export interface RenderedElement {
  content: string;
  imageUrl?: string;
  table?: TableData;
  size?: { width: number; height: number };
  /** Original row count from the designer template (before dynamic-row expansion). */
  designerRows?: number;
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
    const renderedSections: RenderedSection[] = [];
    const mainData = data && data.length > 0 ? data : [{}];
    
    for (const section of template.sections) {
      const path = section.datasetPath || '';
      const resolved = this.getValueByPath(rawData || mainData, path);
      const isArray = Array.isArray(resolved);

      const isHeaderFooter =
        section.type === 'reportHeader' ||
        section.type === 'pageHeader' ||
        section.type === 'footer';

      if (isArray && !isHeaderFooter) {
        for (const row of resolved) {
          renderedSections.push(
            this.renderSection(section, row as ReportData, true, resolved, rawData, false)
          );
        }
      } else {
        const contextRow = isArray ? resolved[0] : (resolved || mainData[0] || {});
        renderedSections.push(
          this.renderSection(section, contextRow as ReportData, false, isArray ? resolved : mainData, rawData, true)
        );
      }
    }

    return { sections: renderedSections };
  }

  private renderSection(section: TemplateSection, row: ReportData, isDetail: boolean, fullData: ReportData[], rawData?: any, isGlobal = false): RenderedSection {
    const elements: RenderedElement[] = section.elements.map((el) => {
      let renderedContent = el.content || '';
      
      if (el.type === 'field' || (renderedContent && renderedContent.includes('{{'))) {
        renderedContent = this.interpolate(renderedContent, row, rawData, section.datasetPath, isGlobal);
      }

      let imageUrl = (el as any).imageUrl;
      if (el.type === 'image' && (el as any).isQRCode && ((el as any).fieldPath || (el as any).qrCodeField)) {
        const fieldToUse = (el as any).fieldPath || (el as any).qrCodeField;
        const val = this.interpolate(`{{${fieldToUse}}}`, row, rawData, section.datasetPath, isGlobal);
        if (val) {
          imageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(val)}`;
        }
      }

      return {
        id: el.id,
        content: renderedContent,
        imageUrl: imageUrl,
        table: el.type === 'table' ? this.renderTable(el, row, fullData, rawData, isGlobal) : undefined,
        designerRows: el.type === 'table' && el.table ? el.table.rows : undefined,
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

  private renderTable(el: TemplateElement, contextRow: ReportData, fullData: ReportData[], rawData?: any, isGlobal = false): TableData | undefined {
    const table = el.table;
    if (!table) return undefined;
    
    let tableSource: any[] = [];
    if (rawData) {
      const resolved = el.datasetPath ? this.getValueByPath(rawData, el.datasetPath) : rawData;
      if (Array.isArray(resolved)) {
        tableSource = resolved;
      } else if (resolved && typeof resolved === 'object' && resolved !== null) {
        tableSource = [resolved];
      }
    } else {
      tableSource = Array.isArray(fullData) ? fullData : [fullData];
    }
    
    if (table.dynamicRows && tableSource && tableSource.length > 0) {
      if (table.cells.length === 0) return table;
      
      const templateBlock = table.cells;
      const templateRowHeights = table.rowHeights?.length === table.rows ? table.rowHeights : Array.from({ length: table.rows }, () => 36);
      
      const newCells: any[][] = [];
      const newRowHeights: number[] = [];
      
      tableSource.forEach(row => {
        templateBlock.forEach((tRow, idx) => {
          newCells.push(tRow.map(cell => this.processCell(cell, row, true, el.datasetPath, rawData, false)));
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
      cells: table.cells.map(cellsRow => cellsRow.map(cell => this.processCell(cell, contextRow, hasRowData, el.datasetPath, rawData, isGlobal))),
    };
  }

  private processCell(cell: any, row: ReportData, hasData: boolean, datasetPath?: string, rawData?: any, isGlobal = false): any {
    let imageUrl = cell.imageUrl;

    if (cell.fieldPath) {
      const val = this.resolveValue(cell.fieldPath, row, rawData, datasetPath, isGlobal);
      if (imageUrl && imageUrl.startsWith('{{')) {
         imageUrl = this.interpolate(imageUrl, row, rawData, datasetPath, isGlobal);
      }

      return {
        ...cell,
        imageUrl,
        isQRCode: cell.isQRCode,
        content: val === undefined ? (hasData ? '' : `{{${cell.fieldPath}}}`) : this.formatValue(val)
      };
    }
    
    return { 
      ...cell, 
      imageUrl, 
      isQRCode: cell.isQRCode,
      content: this.interpolate(cell.content || '', row, rawData, datasetPath, isGlobal) 
    };
  }

  private resolveValue(expression: string, row: ReportData, rawData?: any, datasetPath?: string, isGlobal = false): any {
    const trimmed = expression.trim();
    let result: any = undefined;
    
    // 1. Dataset Path Prefix Stripping
    let cleanDatasetPath = datasetPath ? datasetPath.replace(/\[\d+\]/g, '').replace(/(^|\.)0(\.|$)/g, '$1').replace(/^\.+|\.+$/g, '') : '';
    if (cleanDatasetPath && trimmed.startsWith(cleanDatasetPath)) {
      let relPath = trimmed.substring(cleanDatasetPath.length);
      if (relPath.startsWith('.')) relPath = relPath.substring(1);
      result = relPath ? this.getValueByPath(row, relPath) : row;
      if (result !== undefined) return this.handleAggregation(result, isGlobal);
    } 
    
    // 2. Local Context Resolution
    result = this.getValueByPath(row, trimmed);
    if (result === undefined) {
      const parts = trimmed.split('.');
      while (parts.length > 1 && result === undefined) {
        parts.shift();
        result = this.getValueByPath(row, parts.join('.'));
      }
    }
    
    // 3. Global Context Fallback
    if (result === undefined && rawData) {
      result = this.getValueByPath(rawData, trimmed);
    }

    // 4. Primitive Context
    if (result === undefined && (trimmed === '.' || trimmed === 'this' || trimmed === 'value')) {
      result = row;
    }
    
    return this.handleAggregation(result, isGlobal);
  }

  private handleAggregation(value: any, isGlobal: boolean): any {
    if (isGlobal && Array.isArray(value)) {
      return this.aggregate(value);
    }
    return value;
  }

  private aggregate(values: any[]): any {
    if (!values || values.length === 0) return undefined;
    
    // Filter out nulls/undefined
    const validValues = values.filter(v => v !== null && v !== undefined && v !== '');
    if (validValues.length === 0) return undefined;

    // Numeric Aggregation (SUM)
    const numericValues = validValues.map(v => Number(v)).filter(v => !isNaN(v) && typeof v !== 'boolean');
    if (numericValues.length === validValues.length && numericValues.length > 0) {
      return numericValues.reduce((a, b) => a + b, 0);
    }

    // Date Aggregation (MAX)
    const dateValues = validValues.map(v => new Date(v)).filter(d => !isNaN(d.getTime()));
    if (dateValues.length === validValues.length && dateValues.length > 0) {
      return new Date(Math.max(...dateValues.map(d => d.getTime())));
    }

    // Fallback: First value
    return validValues[0];
  }

  private formatValue(value: any): string {
    if (value === undefined || value === null) return '';
    
    // Data Safety Rule: Prevent raw arrays from leaking to UI
    if (Array.isArray(value)) {
      if (value.length === 0) return '';
      // If we somehow got an array here, fallback to first value to avoid [object Object] or JSON strings
      return this.formatValue(value[0]);
    }

    if (typeof value === 'object') {
      if (value instanceof Date) {
        const day = String(value.getDate()).padStart(2, '0');
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const year = String(value.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
      }
      return JSON.stringify(value);
    }
    
    // Auto-format ISO dates
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = String(d.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
      }
    }
    
    return String(value);
  }

  interpolate(content: string, row: ReportData, rawData?: any, datasetPath?: string, isGlobal = false): string {
    return content.replace(/\{\{([^}]+)\}\}/g, (_match, expr) => {
      try {
        const result = this.resolveValue(expr, row, rawData, datasetPath, isGlobal);
        if (result !== undefined && result !== null) {
          return this.formatValue(result);
        }
        
        try {
          const keys = Object.keys(row);
          const values = Object.values(row);
          const fn = new Function(...keys, `return ${expr.trim()}`);
          return this.formatValue(fn(...values));
        } catch {
          return `{{${expr}}}`;
        }
      } catch {
        return `{{${expr}}}`;
      }
    });
  }

  getValueByPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    const parts = normalizedPath.split('.').filter(p => p);
    
    return parts.reduce((acc, key) => {
      if (acc === undefined || acc === null) return undefined;
      
      if (Array.isArray(acc)) {
        if (key === '0') return acc;
        if (!isNaN(Number(key))) return acc[Number(key)];
        
        const plucked: any[] = [];
        for (const item of acc) {
          const val = item?.[key];
          if (val !== undefined) {
            if (Array.isArray(val)) {
              plucked.push(...val);
            } else {
              plucked.push(val);
            }
          }
        }
        return plucked.length > 0 ? plucked : undefined;
      }
      
      return acc[key];
    }, obj);
  }
}
