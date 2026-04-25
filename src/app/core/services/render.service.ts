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
    const sections: RenderedSection[] = [];

    for (const section of template.sections) {
      // Choose the data source for this specific section. 
      // If a section has a datasetPath, it resolves from the raw API response.
      let sectionData = data;
      if (section.datasetPath && rawData) {
        const resolved = this.getValueByPath(rawData, section.datasetPath);
        if (Array.isArray(resolved)) {
          sectionData = resolved as ReportData[];
        } else if (resolved && typeof resolved === 'object' && resolved !== null) {
          sectionData = [resolved] as ReportData[];
        }
      }

      if (section.repeatPerRow) {
        const rows = sectionData.length > 0 ? sectionData : [{}];
        for (const row of rows) {
          sections.push(this.renderSection(section, row as ReportData, true, sectionData, rawData));
        }
      } else {
        const baseRow = (section.type === 'details' || section.type === 'pageHeader' || section.type === 'reportHeader' || section.type === 'footer') && sectionData.length > 0 ? sectionData[0] : {};
        sections.push(this.renderSection(section, baseRow as ReportData, false, sectionData, rawData));
      }
    }

    return { sections };
  }

  private renderSection(section: TemplateSection, row: ReportData, isDetail: boolean, fullData: ReportData[], rawData?: any): RenderedSection {
    const elements: RenderedElement[] = section.elements.map((el) => {
      let renderedContent = el.content || '';
      
      // Use unified resolution logic for both fields and interpolated text
      if (el.type === 'field' || (renderedContent && renderedContent.includes('{{'))) {
        renderedContent = this.interpolate(renderedContent, row, rawData, section.datasetPath);
      }

      let imageUrl = (el as any).imageUrl;
      if (el.type === 'image' && (el as any).isQRCode && ((el as any).fieldPath || (el as any).qrCodeField)) {
        const fieldToUse = (el as any).fieldPath || (el as any).qrCodeField;
        const val = this.interpolate(`{{${fieldToUse}}}`, row, rawData, section.datasetPath);
        if (val) {
          imageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(val)}`;
        }
      }

      return {
        id: el.id,
        content: renderedContent,
        imageUrl: imageUrl,
        table: el.type === 'table' ? this.renderTable(el, row, fullData, rawData) : undefined,
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

  private renderTable(el: TemplateElement, contextRow: ReportData, fullData: ReportData[], rawData?: any): TableData | undefined {
    const table = el.table;
    if (!table) return undefined;
    
    // Table data resolution
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
          newCells.push(tRow.map(cell => this.processCell(cell, row, true, el.datasetPath, rawData)));
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
      cells: table.cells.map(cellsRow => cellsRow.map(cell => this.processCell(cell, contextRow, hasRowData, el.datasetPath, rawData))),
    };
  }

  private processCell(cell: any, row: ReportData, hasData: boolean, datasetPath?: string, rawData?: any): any {
    let imageUrl = cell.imageUrl;

    if (cell.fieldPath) {
      const val = this.resolveValue(cell.fieldPath, row, rawData, datasetPath);
      
      // If it's a field and it's bound to an image, it might be a URL
      if (imageUrl && imageUrl.startsWith('{{')) {
         const resolvedUrl = this.interpolate(imageUrl, row, rawData, datasetPath);
         imageUrl = resolvedUrl;
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
      content: this.interpolate(cell.content || '', row, rawData, datasetPath) 
    };
  }

  private resolveValue(expression: string, row: ReportData, rawData?: any, datasetPath?: string): any {
    const trimmed = expression.trim();
    let result: any = undefined;
    
    // 1. Dataset Path Prefix Stripping (Crystal Reports style)
    let cleanDatasetPath = datasetPath ? datasetPath.replace(/\[\d+\]/g, '').replace(/(^|\.)0(\.|$)/g, '$1').replace(/^\.+|\.+$/g, '') : '';
    if (cleanDatasetPath && trimmed.startsWith(cleanDatasetPath)) {
      let relPath = trimmed.substring(cleanDatasetPath.length);
      if (relPath.startsWith('.')) relPath = relPath.substring(1);
      result = relPath ? this.getValueByPath(row, relPath) : row;
      
      // CRITICAL: If we matched the prefix, we treat this as a STRICT BINDING.
      // We do not fallback to global rawData because that would cause "plucking" of the whole array.
      if (result !== undefined) return result;
      // Even if result is undefined, we return it to prevent global fallback if it was intended for this row
      return undefined;
    } 
    
    // 2. Local Context Resolution (with fallback to shifted parts)
    result = this.getValueByPath(row, trimmed);
    if (result === undefined) {
      const parts = trimmed.split('.');
      while (parts.length > 1 && result === undefined) {
        parts.shift();
        result = this.getValueByPath(row, parts.join('.'));
      }
    }
    
    // 3. Global Context Fallback (only if not explicitly prefixed with a different dataset)
    if (result === undefined && rawData) {
      result = this.getValueByPath(rawData, trimmed);
    }

    // 4. Primitive Context
    if (result === undefined && (trimmed === '.' || trimmed === 'this' || trimmed === 'value')) {
      result = row;
    }
    
    return result;
  }

  private formatValue(value: any): string {
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object') return JSON.stringify(value);
    
    // Auto-format dates
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

  interpolate(content: string, row: ReportData, rawData?: any, datasetPath?: string): string {
    return content.replace(/\{\{([^}]+)\}\}/g, (_match, expr) => {
      try {
        const result = this.resolveValue(expr, row, rawData, datasetPath);
        
        if (result !== undefined && result !== null) {
          return this.formatValue(result);
        }
        
        // Final fallback: try as JS expression if scalar resolution failed
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
