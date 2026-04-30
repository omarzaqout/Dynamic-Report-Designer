import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectionStrategy, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableCell, TableData, TemplateElement } from '../../../../core/models/template.model';
import { TemplateService } from '../../../../core/services/template.service';

type ResizeMode = 'none' | 'element' | 'table-col' | 'table-row' | 'table-bounds';

@Component({
  selector: 'app-canvas-element',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './canvas-element.component.html',
  styleUrl: './canvas-element.component.css',
})
export class CanvasElementComponent implements OnInit, OnDestroy {
  @Input({ required: true }) element!: TemplateElement;
  @Input() set selected(val: boolean) {
    this._selected = val;
    if (!val) {
      this.isEditingInline = false;
      this.editingCell = null;
    }
  }
  get selected(): boolean { return this._selected; }
  private _selected = false;
  @Output() positionChange = new EventEmitter<{ x: number; y: number }>();
  @Output() select = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
  @Output() dragEnd = new EventEmitter<void>();

  @ViewChild('elRef') elRef!: ElementRef<HTMLDivElement>;

  public templateService = inject(TemplateService);
  readonly focusedCell = this.templateService.focusedTableCell;

  isEditingInline = false;
  editingCell: { row: number; col: number } | null = null;
  readonly activeCellDrop = signal<{ row: number; col: number } | null>(null);
  private isDragging = false;
  private resizeMode: ResizeMode = 'none';
  private startMouseX = 0;
  private startMouseY = 0;
  private startElX = 0;
  private startElY = 0;
  private resizeStartWidth = 0;
  private resizeStartHeight = 0;
  private resizeStartFontSize = 12;
  private resizeColumnIndex: number | null = null;
  private resizeRowIndex: number | null = null;
  private resizeStartColumnWidth = 0;
  private resizeStartRowHeight = 0;

  private mouseMoveHandler!: (e: MouseEvent) => void;
  private mouseUpHandler!: (e: MouseEvent) => void;

  ngOnInit(): void {
    this.mouseMoveHandler = (e: MouseEvent) => this.onMouseMove(e);
    this.mouseUpHandler = () => this.onMouseUp();
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('mouseup', this.mouseUpHandler);
  }

  onClick(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.isEditingInline) {
      // Clear focused cell on single click to allow manual deselection
      this.templateService.setFocusedTableCell('', -1, -1);
    }
  }

  onDblClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.element.type === 'text') {
      this.isEditingInline = true;
      setTimeout(() => {
        const area = this.elRef.nativeElement.querySelector('.inline-edit') as HTMLTextAreaElement;
        if (area) { area.focus(); area.select(); }
      });
    }
  }

  onInlineBlur(event: Event): void {
    this.isEditingInline = false;
    const val = (event.target as HTMLTextAreaElement).value;
    this.templateService.updateElement(this.element.id, { content: val });
  }

  onInlineKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      (event.target as HTMLTextAreaElement).blur();
    }
  }

  onMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (
      target.classList.contains('delete-btn') ||
      target.classList.contains('resize-handle') ||
      target.classList.contains('table-col-resizer') ||
      target.classList.contains('table-row-resizer')
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    
    const isMulti = event.ctrlKey || event.metaKey || event.shiftKey;
    this.templateService.selectElement(this.element.id, isMulti);
    
    this.isDragging = true;
    this.startMouseX = event.clientX;
    this.startMouseY = event.clientY;
    this.startElX = this.element.position.x;
    this.startElY = this.element.position.y;
    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
  }

  onResizeMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.select.emit(this.element.id);

    this.startMouseX = event.clientX;
    this.startMouseY = event.clientY;

    if (this.element.type === 'table' && this.element.table) {
      const visibleColumns = this.visibleColumnIndexes();
      this.resizeColumnIndex = visibleColumns.length > 0 ? visibleColumns[visibleColumns.length - 1] : 0;
      this.resizeRowIndex = Math.max(0, this.element.table.rows - 1);
      this.resizeStartColumnWidth = this.columnWidth(this.resizeColumnIndex);
      this.resizeStartRowHeight = this.rowHeight(this.resizeRowIndex);
      this.resizeMode = 'table-bounds';
    } else if (this.element.type === 'image') {
      const imgEl = this.elRef.nativeElement.querySelector('.el-image') as HTMLImageElement | null;
      this.resizeStartWidth = this.element.size?.width ?? imgEl?.clientWidth ?? 120;
      this.resizeStartHeight = this.element.size?.height ?? imgEl?.clientHeight ?? 120;
      this.resizeMode = 'element';
    } else {
      this.resizeStartFontSize = this.element.style.fontSize;
      this.resizeMode = 'element';
    }

    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
  }

  onTableColumnResizeStart(event: MouseEvent, colIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.select.emit(this.element.id);
    this.startMouseX = event.clientX;
    this.resizeColumnIndex = colIndex;
    this.resizeStartColumnWidth = this.columnWidth(colIndex);
    this.resizeMode = 'table-col';
    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
  }

  onTableRowResizeStart(event: MouseEvent, rowIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.select.emit(this.element.id);
    this.startMouseY = event.clientY;
    this.resizeRowIndex = rowIndex;
    this.resizeStartRowHeight = this.rowHeight(rowIndex);
    this.resizeMode = 'table-row';
    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
  }

  private onMouseMove(event: MouseEvent): void {
    if (this.isDragging) {
      const dx = event.clientX - this.startMouseX;
      const dy = event.clientY - this.startMouseY;
      
      const selectedIds = this.templateService.selectedElementIds();
      if (selectedIds.length > 1 && selectedIds.includes(this.element.id)) {
        // We move the whole selection group by the delta since LAST mouse move
        // Actually simpler: move by delta from start, but we need to update startMouse every time or similar.
        // Better: delta from start position.
        // But moveSelectedElements uses relative addition.
        // So we calculate delta since LAST frame.
        const currentDx = event.clientX - this.startMouseX;
        const currentDy = event.clientY - this.startMouseY;
        
        // We use the start position and absolute delta to avoid accumulation errors if we wanted,
        // but moveSelectedElements is additive. Let's use it frame-by-frame.
        this.templateService.moveSelectedElements(event.movementX, event.movementY);
      } else {
        const CANVAS_WIDTH = 794;
        const domEl = document.getElementById(this.element.id);
        const elementWidth = domEl ? domEl.offsetWidth : (this.element.size?.width || 100);
        
        this.positionChange.emit({
          x: Math.max(0, Math.min(CANVAS_WIDTH - elementWidth, this.startElX + dx)),
          y: Math.max(0, this.startElY + dy),
        });
      }
      return;
    }

    if (this.resizeMode === 'none') return;

    if (this.resizeMode === 'table-col') {
      const dx = event.clientX - this.startMouseX;
      this.resizeTableColumn(this.resizeColumnIndex, this.resizeStartColumnWidth + dx);
      return;
    }

    if (this.resizeMode === 'table-row') {
      const dy = event.clientY - this.startMouseY;
      this.resizeTableRow(this.resizeRowIndex, this.resizeStartRowHeight + dy);
      return;
    }

    if (this.resizeMode === 'table-bounds') {
      const dx = event.clientX - this.startMouseX;
      const dy = event.clientY - this.startMouseY;
      
      // Update start positions to be current after applying delta for frame-by-frame 
      // or just use total delta and initial state. 
      // Let's use movementX/Y for simplicity or total delta from start.
      this.resizeTableUniformly(event.movementX, event.movementY);
      return;
    }

    const dx = event.clientX - this.startMouseX;
    if (this.element.type === 'image') {
      const dy = event.clientY - this.startMouseY;
      this.templateService.updateElement(this.element.id, {
        size: {
          width: Math.max(40, Math.round(this.resizeStartWidth + dx)),
          height: Math.max(40, Math.round(this.resizeStartHeight + dy)),
        },
      });
      return;
    }

    const fontDelta = Math.round(dx / 4);
    const nextFontSize = Math.max(8, Math.min(120, this.resizeStartFontSize + fontDelta));
    this.templateService.updateElement(this.element.id, {
      style: {
        ...this.element.style,
        fontSize: nextFontSize,
      },
    });
  }

  private onMouseUp(): void {
    this.dragEnd.emit();
    this.isDragging = false;
    this.resizeMode = 'none';
    this.resizeColumnIndex = null;
    this.resizeRowIndex = null;
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('mouseup', this.mouseUpHandler);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.delete.emit(this.element.id);
  }

  getTableRows(): TableCell[][] {
    return this.element.table?.cells ?? [];
  }

  displayCell(cell: TableCell): string {
    if (cell.imageUrl) return 'IMAGE';
    if (cell.fieldPath) return `{{${cell.fieldPath}}}`;
    return cell.content || '';
  }

  tableRowIndexes(): number[] {
    const table = this.element.table;
    return table ? Array.from({ length: table.rows }, (_, i) => i) : [];
  }

  visibleColumnIndexes(): number[] {
    const table = this.element.table;
    if (!table) return [];
    const settings = table.columnSettings?.length === table.columns
      ? table.columnSettings
      : Array.from({ length: table.columns }, (_v, index) => ({ width: 120, order: index, visible: true }));
    return settings
      .map((setting, index) => ({ index, setting }))
      .filter(({ setting }) => setting.visible)
      .sort((a, b) => a.setting.order - b.setting.order || a.index - b.index)
      .map(({ index }) => index);
  }

  rowHeight(rowIndex: number): number {
    return this.element.table?.rowHeights?.[rowIndex] ?? 36;
  }

  columnWidth(colIndex: number): number {
    return this.element.table?.columnSettings?.[colIndex]?.width ?? 120;
  }

  tableWidth(): number {
    const visibleColumns = this.visibleColumnIndexes();
    if (visibleColumns.length === 0) return 120;
    return visibleColumns.reduce((sum, colIndex) => sum + this.columnWidth(colIndex), 0);
  }

  tableHeight(): number {
    const rows = this.tableRowIndexes();
    if (rows.length === 0) return 36;
    return rows.reduce((sum, rowIndex) => sum + this.rowHeight(rowIndex), 0);
  }

  columnBoundaryOffsets(): Array<{ colIndex: number; left: number }> {
    const visibleColumns = this.visibleColumnIndexes();
    const result: Array<{ colIndex: number; left: number }> = [];
    let offset = 0;
    for (let i = 0; i < visibleColumns.length - 1; i += 1) {
      const colIndex = visibleColumns[i];
      offset += this.columnWidth(colIndex);
      result.push({ colIndex, left: offset });
    }
    return result;
  }

  rowBoundaryOffsets(): Array<{ rowIndex: number; top: number }> {
    const rows = this.tableRowIndexes();
    const result: Array<{ rowIndex: number; top: number }> = [];
    let offset = 0;
    for (let i = 0; i < rows.length - 1; i += 1) {
      const rowIndex = rows[i];
      offset += this.rowHeight(rowIndex);
      result.push({ rowIndex, top: offset });
    }
    return result;
  }

  private resizeTableColumn(colIndex: number | null, nextWidth: number): void {
    if (colIndex === null) return;
    const CANVAS_WIDTH = 794;
    this.updateTable((table) => {
      const otherTotal = table.columnSettings.reduce((sum, c, idx) => sum + (idx !== colIndex && c.visible ? c.width : 0), 0);
      let finalWidth = Math.max(24, Math.round(nextWidth));
      
      if (otherTotal + finalWidth > CANVAS_WIDTH) {
        finalWidth = CANVAS_WIDTH - otherTotal;
      }

      table.columnSettings[colIndex].width = finalWidth;
      return table;
    });
  }

  private resizeTableRow(rowIndex: number | null, nextHeight: number): void {
    if (rowIndex === null) return;
    this.updateTable((table) => {
      table.rowHeights[rowIndex] = Math.max(24, Math.round(nextHeight));
      return table;
    });
  }

  private resizeTableUniformly(moveX: number, moveY: number): void {
    const CANVAS_WIDTH = 794;
    this.updateTable((table) => {
      // Scale columns uniformly
      const visibleCols = this.visibleColumnIndexes();
      if (visibleCols.length > 0) {
        const currentTotal = visibleCols.reduce((sum, idx) => sum + table.columnSettings[idx].width, 0);
        let effectiveMoveX = moveX;
        
        if (currentTotal + effectiveMoveX > CANVAS_WIDTH) {
          effectiveMoveX = CANVAS_WIDTH - currentTotal;
        }

        const dxPerCol = effectiveMoveX / visibleCols.length;
        visibleCols.forEach(idx => {
          table.columnSettings[idx].width = Math.max(20, table.columnSettings[idx].width + dxPerCol);
        });
      }
      // Scale rows uniformly
      if (table.rows > 0) {
        const dyPerRow = moveY / table.rows;
        table.rowHeights = table.rowHeights.map(h => Math.max(16, h + dyPerRow));
      }
      return table;
    });
  }

  private updateTable(mutator: (table: TableData) => TableData): void {
    if (!this.element.table) return;
    const cloned: TableData = {
      rows: this.element.table.rows,
      columns: this.element.table.columns,
      cells: this.element.table.cells.map((row) => row.map((cell) => ({ ...cell }))),
      rowHeights:
        this.element.table.rowHeights?.length === this.element.table.rows
          ? [...this.element.table.rowHeights]
          : Array.from({ length: this.element.table.rows }, () => 36),
      columnSettings:
        this.element.table.columnSettings?.length === this.element.table.columns
          ? this.element.table.columnSettings.map((setting) => ({ ...setting }))
          : Array.from({ length: this.element.table.columns }, (_v, index) => ({ width: 120, order: index, visible: true })),
    };
    const next = mutator(cloned);
    this.templateService.updateElement(this.element.id, { table: next });
  }

  onCellDragOver(event: DragEvent, row: number, col: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeCellDrop.set({ row, col });
  }

  onCellDragLeave(event: DragEvent, _row: number, _col: number): void {
    event.stopPropagation();
    this.activeCellDrop.set(null);
  }

  onCellDrop(event: DragEvent, row: number, col: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeCellDrop.set(null);
    
    // 1. Static Elements (Images)
    const staticType = event.dataTransfer?.getData('application/static-type');
    if (staticType === 'image') {
      this.templateService.updateTableCell(this.element.id, row, col, {
        imageUrl: 'https://placehold.co/100x100?text=Image' // Default placeholder
      });
      return;
    }

    // 2. Fields
    const fieldPath = event.dataTransfer?.getData('application/field-key');
    if (fieldPath) {
      this.templateService.updateTableCell(this.element.id, row, col, {
        content: `{{${fieldPath}}}`,
        fieldPath: fieldPath
      });
      return;
    }

    // 3. Fallback for JSON format
    const dataJson = event.dataTransfer?.getData('application/json');
    if (dataJson) {
      try {
        const data = JSON.parse(dataJson);
        if (data.type === 'field' && data.field) {
          this.templateService.updateTableCell(this.element.id, row, col, {
            content: `{{${data.field.path}}}`,
            fieldPath: data.field.path
          });
        }
      } catch (e) {
        console.error('Error dropping on table cell', e);
      }
    }
  }

  onCellDblClick(event: MouseEvent, row: number, col: number): void {
    event.stopPropagation();
    
    // Notify Service to highlight cell in Right Panel with element context
    this.templateService.setFocusedTableCell(this.element.id, row, col);
    this.templateService.selectElement(this.element.id);
    
    this.editingCell = { row, col };
    setTimeout(() => {
      const input = this.elRef.nativeElement.querySelector('.cell-edit-input') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  onCellEditBlur(event: Event, row: number, col: number): void {
    this.editingCell = null;
    const value = (event.target as HTMLInputElement).value;
    
    // Check if the user manually typed or kept a field expression
    let fieldPath = '';
    const fieldMatch = value.match(/^{{(.+)}}$/);
    if (fieldMatch) {
      fieldPath = fieldMatch[1].trim();
    }

    this.templateService.updateTableCell(this.element.id, row, col, {
      content: value,
      fieldPath: fieldPath
    });
  }

  onCellEditKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      (event.target as HTMLInputElement).blur();
    }
  }
}
