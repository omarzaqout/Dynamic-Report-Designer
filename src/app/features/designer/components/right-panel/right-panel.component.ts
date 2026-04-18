import { Component, inject, computed, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TemplateService } from '../../../../core/services/template.service';
import { DataService } from '../../../../core/services/data.service';
import { ElementStyle, TableData } from '../../../../core/models/template.model';
import { Field } from '../../../../core/models/field.model';
import { ReportData } from '../../../../core/models/report.model';

@Component({
  selector: 'app-right-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './right-panel.component.html',
  styleUrl: './right-panel.component.css',
})
export class RightPanelComponent {
  private templateService = inject(TemplateService);
  private dataService = inject(DataService);

  readonly placeholderHint = 'e.g. {{name}} or Hello {{name}}';
  readonly fontFamilies = [
    { label: 'Segoe UI', value: '"Segoe UI", Arial, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Tahoma', value: 'Tahoma, sans-serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Courier New', value: '"Courier New", monospace' },
  ] as const;

  readonly element = this.templateService.selectedElement;
  readonly selectedElementIds = this.templateService.selectedElementIds;
  
  // Use datasets from DataService instead of calculating here
  readonly datasets = this.dataService.datasets;
  readonly dataRows = toSignal(this.dataService.data$, { initialValue: [] as ReportData[] });
  
  // Cache fields and avoid frequent re-computation if possible
  readonly fields = computed(() => {
    const el = this.element();
    // Re-check rawData in service to ensure we didn't lose state
    if (!this.dataService.datasets().length) return [];
    
    if (el?.type === 'table' && el.datasetPath) {
      return this.dataService.getFieldsForPath(el.datasetPath);
    }
    return this.dataService.getFields();
  });

  readonly leafFields = computed(() => this.flattenLeafFields(this.fields()));
  
  readonly arrayFields = computed(() => {
    // Return all datasets found by DataService
    return this.datasets().map(ds => ({
      label: ds.name,
      path: ds.path,
      count: ds.count
    }));
  });
  
  readonly filteredLeafFields = computed(() => this.leafFields());
  readonly sectionLabel = computed(() => {
    const s = this.templateService.selectedElementSection();
    if (!s) return '';
    const map: Record<string, string> = {
      reportHeader: 'Report Header',
      pageHeader: 'Page Header',
      details: 'Details',
      footer: 'Footer',
    };
    return map[s.type] ?? s.type;
  });

  onContentChange(event: Event): void {
    const val = (event.target as HTMLTextAreaElement).value;
    const el = this.element();
    if (el) this.templateService.updateElement(el.id, { content: val });
  }

  onBindField(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const el = this.element();
    if (!el) return;
    if (val) {
      this.templateService.updateElement(el.id, { content: `{{${val}}}`, boundField: val, fieldPath: val, type: 'field' });
    } else {
      this.templateService.updateElement(el.id, { boundField: undefined, fieldPath: undefined, type: 'text' });
    }
  }

  onImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const el = this.element();
        if (el && el.type === 'image') {
          this.templateService.updateElement(el.id, { imageUrl: result });
        }
      };
      reader.readAsDataURL(file);
    }
  }

  adjustSize(delta: number): void {
    const el = this.element();
    if (el) {
      const newSize = Math.max(8, Math.min(72, el.style.fontSize + delta));
      this.updateStyle({ fontSize: newSize });
    }
  }

  onColorChange(event: Event): void {
    this.updateStyle({ color: (event.target as HTMLInputElement).value });
  }

  onFontFamilyChange(event: Event): void {
    this.updateStyle({ fontFamily: (event.target as HTMLSelectElement).value });
  }

  toggleBold(): void {
    const el = this.element();
    if (el) this.updateStyle({ fontWeight: el.style.fontWeight === 'bold' ? 'normal' : 'bold' });
  }

  toggleItalic(): void {
    const el = this.element();
    if (el) this.updateStyle({ fontStyle: el.style.fontStyle === 'italic' ? 'normal' : 'italic' });
  }

  toggleUnderline(): void {
    const el = this.element();
    if (el) this.updateStyle({ textDecoration: el.style.textDecoration === 'underline' ? 'none' : 'underline' });
  }

  onTextAlignChange(align: 'left' | 'center' | 'right'): void {
    this.updateStyle({ textAlign: align });
  }

  onXChange(event: Event): void {
    const el = this.element();
    if (el) {
      const x = parseInt((event.target as HTMLInputElement).value, 10) || 0;
      this.templateService.updateElementPosition(el.id, x, el.position.y);
    }
  }

  onYChange(event: Event): void {
    const el = this.element();
    if (el) {
      const y = parseInt((event.target as HTMLInputElement).value, 10) || 0;
      this.templateService.updateElementPosition(el.id, el.position.x, y);
    }
  }

  addTableRow(): void {
    this.updateTable((table) => {
      table.rows += 1;
      table.cells.push(Array.from({ length: table.columns }, () => ({ content: '' })));
      table.rowHeights.push(36);
      return table;
    });
  }

  removeTableRow(): void {
    this.updateTable((table) => {
      if (table.rows <= 1) return table;
      table.rows -= 1;
      table.cells.pop();
      table.rowHeights.pop();
      return table;
    });
  }

  addTableColumn(): void {
    this.updateTable((table) => {
      table.columns += 1;
      table.cells.forEach((row) => row.push({ content: '' }));
      const maxOrder = table.columnSettings.reduce((max, col) => Math.max(max, col.order), -1);
      table.columnSettings.push({
        width: 120,
        order: maxOrder + 1,
        visible: true,
      });
      return table;
    });
  }

  removeTableColumn(): void {
    this.updateTable((table) => {
      if (table.columns <= 1) return table;
      table.columns -= 1;
      table.cells.forEach((row) => row.pop());
      table.columnSettings.pop();
      return table;
    });
  }

  onTableCellContentChange(row: number, col: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.updateTable((table) => {
      table.cells[row][col].content = value;
      // If content is cleared, also clear the field binding
      if (!value) {
        table.cells[row][col].fieldPath = undefined;
      }
      return table;
    });
  }

  onTableCellFieldChange(row: number, col: number, value: string | undefined): void {
    const el = this.element();
    if (!el || el.type !== 'table' || !el.table) return;

    const currentPath = el.table.cells[row][col].fieldPath;
    
    // GUARD: If value is undefined/empty but we know it should have a path, 
    // and the field explorer is currently empty (it means we are switching views)
    if (!value && currentPath && !this.isKeyInFields(currentPath)) {
      return;
    }

    this.updateTable((table) => {
      table.cells[row][col].fieldPath = value || undefined;
      if (value) {
        table.cells[row][col].content = `{{${value}}}`;
      }
      return table;
    });
  }

  onTableRowHeightChange(row: number, event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.updateTable((table) => {
      table.rowHeights[row] = Number.isFinite(value) ? Math.max(24, value) : table.rowHeights[row];
      return table;
    });
  }

  onTableColumnWidthChange(col: number, event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.updateTable((table) => {
      table.columnSettings[col].width = Number.isFinite(value) ? Math.max(48, value) : table.columnSettings[col].width;
      return table;
    });
  }

  onTableColumnOrderChange(col: number, event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.updateTable((table) => {
      table.columnSettings[col].order = Number.isFinite(value) ? value : table.columnSettings[col].order;
      return table;
    });
  }

  onTableColumnVisibilityChange(col: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.updateTable((table) => {
      if (!checked) {
        const visibleCount = table.columnSettings.filter((setting) => setting.visible).length;
        if (visibleCount <= 1) return table;
      }
      table.columnSettings[col].visible = checked;
      return table;
    });
  }

  onTableDynamicRowsChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.updateTable((table) => {
      table.dynamicRows = checked;
      return table;
    });
  }

  onTableFullWidthChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.updateTable((table) => {
      if (checked) {
        // Store original widths before scaling
        table.previousWidths = table.columnSettings.map(c => c.width);

        const visibleCols = table.columnSettings.filter(c => c.visible);
        const currentTotal = visibleCols.reduce((sum, c) => sum + c.width, 0);
        const targetWidth = 790;
        
        if (currentTotal > 0 && currentTotal < targetWidth) {
          const ratio = targetWidth / currentTotal;
          table.columnSettings.forEach(c => {
            if (c.visible) {
              c.width = Math.round(c.width * ratio);
            }
          });
        }
      } else if (table.previousWidths) {
        // Restore previous widths when fullWidth is unchecked
        table.columnSettings.forEach((c, idx) => {
          if (table.previousWidths && table.previousWidths[idx] !== undefined) {
            c.width = table.previousWidths[idx];
          }
        });
        table.previousWidths = undefined;
      }
      table.fullWidth = checked;
      return table;
    });
  }

  onTableDatasetChange(value: string | undefined): void {
    const el = this.element();
    if (!el || el.type !== 'table') return;

    // GUARD: Prevent auto-reset by browser during view transitions
    if (!value && el.datasetPath && !this.isPathInDatasets(el.datasetPath)) {
      return;
    }

    this.templateService.updateElement(el.id, { datasetPath: value || undefined });
  }

  tableRowIndexes(table: TableData): number[] {
    return Array.from({ length: table.rows }, (_, i) => i);
  }

  orderedColumnIndexes(table: TableData): number[] {
    const settings = table.columnSettings?.length === table.columns
      ? table.columnSettings
      : Array.from({ length: table.columns }, (_v, index) => ({ width: 120, order: index, visible: true }));
    return settings
      .map((setting, index) => ({ index, setting }))
      .sort((a, b) => a.setting.order - b.setting.order || a.index - b.index)
      .map(({ index }) => index);
  }

  tablePreviewWidth(table: TableData): number {
    const settings = table.columnSettings?.length === table.columns
      ? table.columnSettings
      : Array.from({ length: table.columns }, (_v, index) => ({ width: 120, order: index, visible: true }));
    const visibleColumns = settings.filter((setting) => setting.visible);
    if (visibleColumns.length === 0) return 120;
    return visibleColumns.reduce((sum, setting) => sum + setting.width, 0);
  }

  tablePreviewHeight(table: TableData): number {
    const rowHeights = table.rowHeights?.length === table.rows
      ? table.rowHeights
      : Array.from({ length: table.rows }, () => 36);
    if (rowHeights.length === 0) return 36;
    return rowHeights.reduce((sum, height) => sum + height, 0);
  }

  tableRowHeight(table: TableData, rowIndex: number): number {
    return table.rowHeights?.[rowIndex] ?? 36;
  }

  tableColumnWidth(table: TableData, colIndex: number): number {
    return table.columnSettings?.[colIndex]?.width ?? 120;
  }

  tableColumnOrder(table: TableData, colIndex: number): number {
    return table.columnSettings?.[colIndex]?.order ?? colIndex;
  }

  tableColumnVisible(table: TableData, colIndex: number): boolean {
    return table.columnSettings?.[colIndex]?.visible ?? true;
  }

  deleteElement(): void {
    const el = this.element();
    if (el) this.templateService.deleteSelectedElements();
  }

  duplicateSelected(): void {
    this.templateService.duplicateSelectedElements();
  }

  deleteSelected(): void {
    this.templateService.deleteSelectedElements();
  }

  private updateStyle(patch: Partial<ElementStyle>): void {
    const el = this.element();
    if (el) this.templateService.updateElement(el.id, { style: { ...el.style, ...patch } });
  }

  private updateTable(mutator: (table: TableData) => TableData): void {
    const el = this.element();
    if (!el || !el.table) return;
    const cloned = this.cloneTable(el.table);
    const nextTable = mutator(cloned);
    this.templateService.updateElement(el.id, { table: nextTable });
  }

  private cloneTable(table: TableData): TableData {
    const rowHeights = table.rowHeights?.length === table.rows
      ? [...table.rowHeights]
      : Array.from({ length: table.rows }, () => 36);

    const columnSettings = table.columnSettings?.length === table.columns
      ? table.columnSettings.map((setting) => ({ ...setting }))
      : Array.from({ length: table.columns }, (_v, index) => ({
          width: 120,
          order: index,
          visible: true,
        }));

    return {
      rows: table.rows,
      columns: table.columns,
      cells: table.cells.map((row) => row.map((cell) => ({ ...cell }))),
      rowHeights,
      columnSettings,
      dynamicRows: table.dynamicRows,
    };
  }

  private flattenLeafFields(fields: Field[]): Field[] {
    const leaves: Field[] = [];
    for (const field of fields) {
      if (field.children?.length) {
        leaves.push(...this.flattenLeafFields(field.children));
      } else {
        leaves.push(field);
      }
    }
    return leaves;
  }

  isPathInDatasets(path: string): boolean {
    return this.arrayFields().some(a => a.path === path);
  }

  isKeyInFields(key: string): boolean {
    return this.filteredLeafFields().some(f => f.key === key);
  }

  readonly focusedCell = this.templateService.focusedTableCell;

  setFocusedCell(row: number, col: number): void {
    const el = this.element();
    if (el) {
      this.templateService.setFocusedTableCell(el.id, row, col);
    }
  }

  onTableCellStyleChange(patch: Partial<ElementStyle>): void {
    const focus = this.focusedCell();
    const el = this.element();
    if (!focus || !el || focus.elementId !== el.id) return;
    
    this.updateTable((table) => {
      const cell = table.cells[focus.row][focus.col];
      cell.style = { ...(cell.style || {}), ...patch };
      return table;
    });
  }

  resetTableCellStyle(): void {
    const focus = this.focusedCell();
    const el = this.element();
    if (!focus || !el || focus.elementId !== el.id) return;
    
    this.updateTable((table) => {
      table.cells[focus.row][focus.col].style = undefined;
      return table;
    });
  }
}
