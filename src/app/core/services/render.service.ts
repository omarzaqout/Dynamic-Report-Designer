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
        renderedContent = this.interpolate(renderedContent, row, rawData, section.datasetPath, isGlobal, {
          aggregation: el.aggregation,
          conditions: el.conditions
        });
      }

      if (el.icon && el.type === 'field') {
        renderedContent = `<i class="${el.icon}"></i> ` + renderedContent;
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
          const processedRow = tRow.map(cell => this.processCell(cell, row, true, el.datasetPath, rawData, false));
          newCells.push(processedRow);
          
          // Use template height as the base. 
          // The UI will use this as min-height to allow "Auto Height" if text wraps.
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
    const cells = table.cells.map(cellsRow => cellsRow.map(cell => this.processCell(cell, contextRow, hasRowData, el.datasetPath, rawData, isGlobal)));
    
    return {
      ...table,
      rowHeights: table.rowHeights?.length === table.rows ? [...table.rowHeights] : Array.from({ length: table.rows }, () => 36),
      columnSettings: table.columnSettings?.length === table.columns ? table.columnSettings.map(col => ({ ...col })) : Array.from({ length: table.columns }, (_v, index) => ({ width: 120, order: index, visible: true })),
      cells: cells,
    };
  }

  private processCell(cell: any, row: ReportData, hasData: boolean, datasetPath?: string, rawData?: any, isGlobal = false): any {
    let imageUrl = cell.imageUrl;
    let content = '';

    // 1. Resolve content based on fieldPath or static content
    if (cell.fieldPath) {
      const val = this.resolveValue(cell.fieldPath, row, rawData, datasetPath, isGlobal, {
        aggregation: cell.aggregation,
        conditions: cell.conditions
      });
      
      if (imageUrl && imageUrl.startsWith('{{')) {
         imageUrl = this.interpolate(imageUrl, row, rawData, datasetPath, isGlobal);
      }

      content = val === undefined ? (hasData ? '' : `{{${cell.fieldPath}}}`) : this.formatValue(val);
    } else {
      content = this.interpolate(cell.content || '', row, rawData, datasetPath, isGlobal, {
        aggregation: cell.aggregation,
        conditions: cell.conditions
      });
    }

    // 2. Handle Text Wrapping / Newlines
    // If the cell is set to wrap (normal), we ensure newlines are preserved for HTML rendering
    if (cell.style?.whiteSpace === 'normal' || cell.style?.whiteSpace === 'pre-wrap') {
      content = content.replace(/\n/g, '<br>');
    }

    if (cell.icon) {
      content = `<i class="${cell.icon}"></i> ` + content;
    }

    // 3. Return the processed cell with all properties preserved
    return {
      ...cell,
      imageUrl,
      isQRCode: cell.isQRCode,
      content
    };
  }

  private resolveValue(expression: string, row: ReportData, rawData?: any, datasetPath?: string, isGlobal = false, metadata?: { aggregation?: any, conditions?: any[] }): any {
    const trimmed = expression.trim();
    const conditions = metadata?.conditions || [];
    
    // 1. Explicit Root Override
    if (trimmed.startsWith('root.')) {
      return this.handleAggregation(this.getValueByPath(rawData, trimmed.substring(5)), true, metadata);
    }

    // 2. Identify Context vs Global Dataset
    // We check if the path starts with a known top-level dataset (array in root)
    const firstPart = trimmed.split('.')[0];
    const isKnownDataset = rawData && Array.isArray(rawData[firstPart]);
    
    // 3. Dataset Path Prefix Stripping (for local context resolution)
    let cleanDatasetPath = datasetPath ? datasetPath.replace(/\[\d+\]/g, '').replace(/(^|\.)0(\.|$)/g, '$1').replace(/^\.+|\.+$/g, '') : '';
    let pathToResolve = trimmed;

    if (cleanDatasetPath && trimmed.startsWith(cleanDatasetPath)) {
      pathToResolve = trimmed.substring(cleanDatasetPath.length);
      if (pathToResolve.startsWith('.')) pathToResolve = pathToResolve.substring(1);
    }

    // 4. Resolve from Context Row
    let result: any = undefined;
    
    // If it's NOT a cross-dataset reference (e.g. we are in 'results' and user asked for 'components.id')
    // then we try the local row first.
    const isCrossDataset = isKnownDataset && firstPart !== cleanDatasetPath;
    
    if (!isCrossDataset) {
        const parts = pathToResolve.split('.');
        let current: any = row;
        let currentPath = cleanDatasetPath;
        let found = true;

        for (let i = 0; i < parts.length; i++) {
          const key = parts[i];
          if (!key) continue;
          
          // Check if property exists in current context
          if (current === undefined || current === null || (typeof current === 'object' && !current.hasOwnProperty(key))) {
              found = false;
              break;
          }

          const val = current[key];
          currentPath = currentPath ? `${currentPath}.${key}` : key;

          if (Array.isArray(val)) {
            let filtered = val;
            if (conditions.length > 0) {
              filtered = val.filter(item => this.applyFilters(item, conditions, currentPath));
            }

            if (i < parts.length - 1) {
              const remainingPath = parts.slice(i + 1).join('.');
              const plucked = filtered.map(item => this.getValueByPath(item, remainingPath)).filter(v => v !== undefined);
              return this.handleAggregation(plucked, isGlobal, metadata);
            } else {
              return this.handleAggregation(filtered, isGlobal, metadata);
            }
          }
          current = val;
        }
        if (found) result = current;
    }

    // 5. Global Context Fallback
    if ((result === undefined || result === null) && rawData) {
      // If we couldn't find it locally, or it was explicitly a cross-dataset reference, 
      // try globally from the very root.
      const rootResult = this.getValueByPath(rawData, trimmed);
      if (rootResult !== undefined) {
        return this.handleAggregation(rootResult, true, metadata);
      }
    }
  
    // 6. Primitive Context ('.' or 'this')
    if ((result === undefined || result === null) && (trimmed === '.' || trimmed === 'this' || trimmed === 'value')) {
      result = row;
    }
    
    return this.handleAggregation(result, isGlobal, metadata);
  }

  private handleAggregation(value: any, isGlobal: boolean, metadata?: { aggregation?: any, conditions?: any[] }): any {
    const aggType = metadata?.aggregation || 'none';

    if (Array.isArray(value)) {
      if (aggType !== 'none') {
        return this.aggregate(value, aggType);
      }
      
      // Default behavior: return first valid value
      const valid = value.filter(v => v !== null && v !== undefined && v !== '');
      return valid.length > 0 ? valid[0] : undefined;
    }
    
    return value;
  }

  private applyFilters(item: any, conditions: any[], datasetPath?: string): boolean {
    const cleanPrefix = datasetPath ? datasetPath.replace(/\[\d+\]/g, '').replace(/(^|\.)0(\.|$)/g, '$1').replace(/^\.+|\.+$/g, '') : '';

    for (const cond of conditions) {
      if (!cond.field) continue;
      
      let fieldPath = cond.field;
      if (cleanPrefix && fieldPath.startsWith(cleanPrefix)) {
        fieldPath = fieldPath.substring(cleanPrefix.length);
        if (fieldPath.startsWith('.')) fieldPath = fieldPath.substring(1);
      }

      const rawVal = this.getValueByPath(item, fieldPath);
      const target = cond.value;
      
      // Safe string conversion for general use
      const valStr = rawVal !== null && rawVal !== undefined ? String(rawVal).toLowerCase() : '';
      const targetStr = target !== null && target !== undefined ? String(target).toLowerCase() : '';

      // Numeric normalization for comparison operators
      const nVal = parseFloat(String(rawVal).replace(/[^0-9.-]+/g, ''));
      const nTarget = parseFloat(String(target).replace(/[^0-9.-]+/g, ''));

      switch (cond.operator) {
        case '==': 
          if (rawVal != target && valStr !== targetStr) return false; 
          break;
        case '!=': 
          if (rawVal == target || valStr === targetStr) return false; 
          break;
        case '>': if (isNaN(nVal) || isNaN(nTarget) || nVal <= nTarget) return false; break;
        case '<': if (isNaN(nVal) || isNaN(nTarget) || nVal >= nTarget) return false; break;
        case '>=': if (isNaN(nVal) || isNaN(nTarget) || nVal < nTarget) return false; break;
        case '<=': if (isNaN(nVal) || isNaN(nTarget) || nVal > nTarget) return false; break;
        case 'contains': 
          if (!valStr.includes(targetStr)) return false; 
          break;
      }
    }
    return true;
  }

  private aggregate(values: any[], type: string = 'none'): any {
    if (!values || !Array.isArray(values) || values.length === 0) {
      return type === 'count' ? 0 : undefined;
    }
    
    const validValues = values.filter(v => v !== null && v !== undefined && v !== '');
    if (validValues.length === 0 && type !== 'count') return undefined;

    // Robust numeric extraction - but ignore ISO dates
    const parseNum = (v: any) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        // If it looks like a date (ISO format), don't treat it as a number
        if (/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
        
        const cleaned = v.replace(/[^0-9.-]+/g, '');
        if (!cleaned || cleaned === '-' || cleaned === '.') return null;
        const n = parseFloat(cleaned);
        return isNaN(n) ? null : n;
      }
      return null;
    };

    const numericValues = validValues.map(parseNum).filter(v => v !== null) as number[];

    switch (type) {
      case 'count':
        return values.length;
      
      case 'sum':
        return numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) : 0;
      
      case 'avg':
        return numericValues.length > 0 ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length : 0;
      
      case 'min': {
        const dateValues = validValues.map(v => new Date(v).getTime()).filter(t => !isNaN(t));
        // If it looks like we have dates and few/no numbers, prioritize date min
        if (dateValues.length > 0 && (numericValues.length === 0 || dateValues.length >= numericValues.length)) {
          return new Date(Math.min(...dateValues));
        }
        return numericValues.length > 0 ? Math.min(...numericValues) : undefined;
      }
      
      case 'max': {
        const dateValues = validValues.map(v => new Date(v).getTime()).filter(t => !isNaN(t));
        if (dateValues.length > 0 && (numericValues.length === 0 || dateValues.length >= numericValues.length)) {
          return new Date(Math.max(...dateValues));
        }
        return numericValues.length > 0 ? Math.max(...numericValues) : undefined;
      }

      case 'join':
        return validValues.join(', ');

      default: {
        const dateValues = validValues.map(v => new Date(v).getTime()).filter(t => !isNaN(t));
        if (dateValues.length > 0 && dateValues.length === validValues.length) {
          return new Date(Math.max(...dateValues));
        }
        if (numericValues.length > 0 && numericValues.length === validValues.length) {
          return numericValues.reduce((a, b) => a + b, 0);
        }
        return validValues[0];
      }
    }
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

  interpolate(content: string, row: ReportData, rawData?: any, datasetPath?: string, isGlobal = false, metadata?: { aggregation?: any, conditions?: any[] }): string {
    return content.replace(/\{\{([^}]+)\}\}/g, (_match, expr) => {
      try {
        const result = this.resolveValue(expr, row, rawData, datasetPath, isGlobal, metadata);
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
