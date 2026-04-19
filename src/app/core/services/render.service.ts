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
        // Preserve the original (pre-expansion) row count so the preview can compute
        // how much the table has grown relative to its designer size.
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
    
    // Choose the data source for the table entirely independent of the layout context.
    // Table data should strictly resolve from the root raw JSON using datasetPath.
    let tableSource: any[] = [];
    
    if (rawData) {
      const resolved = el.datasetPath ? this.getValueByPath(rawData, el.datasetPath) : rawData;

      if (Array.isArray(resolved)) {
        tableSource = resolved;
      } else if (resolved && typeof resolved === 'object' && resolved !== null) {
        tableSource = [resolved];
      }
    } else {
      // Safe fallback if rawData is not provided
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
    if (cell.fieldPath) {
      let value: any;
      const usedPath = cell.fieldPath;
      
      // The datasetPath might be "0.items", but the user field is just "items.name"
      // We must clean both of array index notation for prefix matching
      let cleanDatasetPath = datasetPath ? datasetPath.replace(/\[\d+\]/g, '').replace(/(^|\.)0(\.|$)/g, '$1').replace(/^\.+|\.+$/g, '') : '';
      
      // 1. Try stripping dataset path prefix if explicitly mapped from full tree
      if (cleanDatasetPath && usedPath.startsWith(cleanDatasetPath)) {
        let relativePath = usedPath.substring(cleanDatasetPath.length);
        if (relativePath.startsWith('.')) relativePath = relativePath.substring(1);
        value = relativePath ? this.getValueByPath(row, relativePath) : row;
      }
      
      // 2. Try against the local element context (works for 'id' directly inside array)
      if (value === undefined) {
        value = this.getValueByPath(row, usedPath);
        
        if (value === undefined) {
          const parts = usedPath.split('.');
          while (parts.length > 1 && value === undefined) {
            parts.shift();
            value = this.getValueByPath(row, parts.join('.'));
          }
        }
      }
      
      // 3. Try global context fallback (external fields)
      if (value === undefined && rawData) {
        value = this.getValueByPath(rawData, usedPath);
      }

      return {
        ...cell,
        content: value === undefined ? (hasData ? '' : `{{${cell.fieldPath}}}`) : typeof value === 'object' ? JSON.stringify(value) : String(value),
      };
    }
    return { ...cell, content: this.interpolate(cell.content || '', row, rawData, datasetPath) };
  }

  interpolate(content: string, row: ReportData, rawData?: any, datasetPath?: string): string {
    return content.replace(/\{\{([^}]+)\}\}/g, (_match, expr) => {
      try {
        const trimmed = expr.trim();
        let result: any = undefined;
        
        let cleanDatasetPath = datasetPath ? datasetPath.replace(/\[\d+\]/g, '').replace(/(^|\.)0(\.|$)/g, '$1').replace(/^\.+|\.+$/g, '') : '';
        
        // 1.
        if (cleanDatasetPath && trimmed.startsWith(cleanDatasetPath)) {
          let relPath = trimmed.substring(cleanDatasetPath.length);
          if (relPath.startsWith('.')) relPath = relPath.substring(1);
          result = relPath ? this.getValueByPath(row, relPath) : row;
        } 
        
        // 2.
        if (result === undefined) {
          result = this.getValueByPath(row, trimmed);
          if (result === undefined) {
            const parts = trimmed.split('.');
            while (parts.length > 1 && result === undefined) {
              parts.shift();
              result = this.getValueByPath(row, parts.join('.'));
            }
          }
        }
        
        // 3.
        if (result === undefined && rawData) {
          result = this.getValueByPath(rawData, trimmed);
        }
        
        // 4. Function execution
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

