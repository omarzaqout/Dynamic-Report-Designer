import { Component, Input, Output, EventEmitter, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateSection, TemplateElement, DEFAULT_STYLE, TableData } from '../../../../core/models/template.model';
import { CanvasElementComponent } from '../canvas-element/canvas-element.component';
import { TemplateService } from '../../../../core/services/template.service';
import { DataService } from '../../../../core/services/data.service';
import { computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { normalizeStoredText } from '../../../../core/utils/bidi-text.util';

@Component({
  selector: 'app-canvas-section',
  standalone: true,
  imports: [CommonModule, CanvasElementComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './canvas-section.component.html',
  styleUrl: './canvas-section.component.css',
})
export class CanvasSectionComponent {
  private templateService = inject(TemplateService);
  private dataService = inject(DataService);
  private visibleColumnsCache = new WeakMap<TableData, number[]>();
  private dynamicRowHeightCache = new WeakMap<TableData, Map<number, number>>();
  
  @Input({ required: true }) section!: TemplateSection;
  @Input() selectedElementId: string | null = null;
  readonly selectedElementIds = this.templateService.selectedElementIds;
  readonly template = this.templateService.template;

  readonly datasets = this.dataService.datasets;
  readonly arrayFields = computed(() => {
    return this.datasets().map(ds => ({
      label: ds.name,
      path: ds.path,
      count: ds.count
    }));
  });

  @Output() elementAdd = new EventEmitter<{ sectionId: string; element: Omit<TemplateElement, 'id'> }>();
  @Output() elementSelect = new EventEmitter<string>();
  @Output() elementDelete = new EventEmitter<string>();
  @Output() elementMove = new EventEmitter<{ id: string; x: number; y: number }>();
  @Output() sectionResize = new EventEmitter<{ sectionId: string; height: number }>();
  @Output() sectionRepeatChange = new EventEmitter<{ sectionId: string; repeatPerRow: boolean }>();
  @Output() sectionDelete = new EventEmitter<string>();

  private measureTextHeight(content: string, style: any, width: number, lineHeight: string = '1.3'): number {
    if (!content) return 0;

    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.style.width = `${width}px`;
    div.style.fontSize = `${style.fontSize || 12}px`;
    div.style.fontFamily = style.fontFamily || 'inherit';
    div.style.fontWeight = style.fontWeight || 'normal';
    div.style.fontStyle = style.fontStyle || 'normal';
    div.style.lineHeight = lineHeight;
    div.style.whiteSpace = style.whiteSpace || 'normal';
    const allowsWrap = style.whiteSpace === 'normal' || style.whiteSpace === 'pre-wrap' || style.whiteSpace === 'pre-line';
    div.style.wordBreak = allowsWrap ? 'break-word' : 'normal';
    div.style.overflowWrap = allowsWrap ? 'anywhere' : 'normal';
    div.style.padding = '0';
    div.style.margin = '0';
    div.style.boxSizing = 'border-box';
    div.textContent = normalizeStoredText(content);
    document.body.appendChild(div);
    const height = div.offsetHeight;
    document.body.removeChild(div);

    return height > 0 ? height + 2 : 0;
  }

  private getTableRowHeight(el: TemplateElement, rowIndex: number): number {
    const table = el.table;
    if (!table) return 36;

    const baseHeight = table.rowHeights?.[rowIndex] ?? 36;
    let tableCache = this.dynamicRowHeightCache.get(table);
    if (!tableCache) {
      tableCache = new Map<number, number>();
      this.dynamicRowHeightCache.set(table, tableCache);
    }
    const cachedHeight = tableCache.get(rowIndex);
    if (cachedHeight !== undefined) return cachedHeight;

    const rowCells = table.cells[rowIndex] || [];
    let maxHeight = baseHeight;

    let visibleColumns = this.visibleColumnsCache.get(table);
    if (!visibleColumns) {
      visibleColumns = (table.columnSettings?.length === table.columns
        ? table.columnSettings
        : Array.from({ length: table.columns }, (_v, index) => ({ width: 120, order: index, visible: true })))
        .map((setting, index) => ({ index, setting }))
        .filter(({ setting }) => setting.visible)
        .sort((a, b) => a.setting.order - b.setting.order || a.index - b.index)
        .map(({ index }) => index);
      this.visibleColumnsCache.set(table, visibleColumns);
    }

    for (const colIndex of visibleColumns) {
      const cell = rowCells[colIndex];
      if (!cell || !cell.content || cell.imageUrl || cell.isQRCode) continue;

      const whiteSpace = cell.style?.whiteSpace ?? el.style.whiteSpace ?? 'nowrap';
      const content = normalizeStoredText(cell.fieldPath ? `{{${cell.fieldPath}}}` : (cell.content || ''));
      if (whiteSpace === 'nowrap' && !content.includes('\n')) continue;

      const availableWidth = Math.max(10, (table.columnSettings?.[colIndex]?.width ?? 120) - 12);
      const measured = this.measureTextHeight(
        content,
        {
          ...el.style,
          ...cell.style,
          whiteSpace
        },
        availableWidth,
        '1.3'
      );

      maxHeight = Math.max(maxHeight, measured + 8);
    }

    const finalHeight = Math.round(maxHeight);
    tableCache.set(rowIndex, finalHeight);
    return finalHeight;
  }

  private getElementHeight(el: TemplateElement): number {
    if (el.type === 'table' && el.table) {
      return Array.from({ length: el.table.rows }, (_v, rowIndex) => this.getTableRowHeight(el, rowIndex))
        .reduce((a, b) => a + b, 0);
    } else if ((el.type === 'image' || el.type === 'line') && el.size) {
      return el.size.height;
    } else if (el.style) {
      return Math.max(30, el.style.fontSize * 1.5);
    }
    return 30;
  }

  get computedHeight(): number {
    let maxContentY = 0;
    for (const el of this.section.elements) {
      const elHeight = this.getElementHeight(el);
      const bottomY = el.position.y + elHeight;
      if (bottomY > maxContentY) maxContentY = bottomY;
    }
    // Match exactly the height or content, whichever is larger. 
    // No extra padding to avoid handle jumps.
    return Math.max(this.section.height, maxContentY);
  }

  alignmentLines = signal<{ x: number[], y: number[] }>({ x: [], y: [] });

  private _isDragOver = signal(false);
  readonly isDragOver = this._isDragOver.asReadonly();

  private resizeStartY = 0;
  private resizeStartHeight = 0;
  private resizeMoveHandler!: (e: MouseEvent) => void;
  private resizeUpHandler!: () => void;

  selectionBox = signal<{ x: number, y: number, width: number, height: number } | null>(null);
  private lassoStartX = 0;
  private lassoStartY = 0;
  private lassoIsAppend = false;
  private lassoMoveHandler!: (e: MouseEvent) => void;
  private lassoUpHandler!: () => void;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    this._isDragOver.set(true);
  }

  onDragLeave(): void {
    this._isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this._isDragOver.set(false);

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, event.clientX - rect.left - 4);
    const y = Math.max(0, event.clientY - rect.top - 10);

    const staticType = event.dataTransfer?.getData('application/static-type') as 'text' | 'image' | 'table' | 'line' | '';
    if (staticType) {
      this.elementAdd.emit({
        sectionId: this.section.id,
        element: {
          type: staticType,
          content: staticType === 'text' ? 'Double click to edit' : undefined,
          table: staticType === 'table' ? this.createTableData(2, 3) : undefined,
          size:
            staticType === 'image'
              ? { width: 120, height: 120 }
              : staticType === 'line'
                ? { width: 240, height: 2 }
              : staticType === 'table'
                ? { width: 360, height: 100 }
                : undefined,
          position: { x, y },
          style: { ...DEFAULT_STYLE, borderStyle: staticType === 'line' ? 'dotted' : DEFAULT_STYLE.borderStyle },
        },
      });
      return;
    }

    const fieldKey = event.dataTransfer?.getData('application/field-key');
    if (!fieldKey) return;

    this.elementAdd.emit({
      sectionId: this.section.id,
      element: {
        type: 'field',
        content: `{{${fieldKey}}}`,
        fieldPath: fieldKey,
        boundField: fieldKey,
        position: { x, y },
        style: { ...DEFAULT_STYLE },
      },
    });
  }

  startLasso(event: MouseEvent): void {
    if (!(event.target as HTMLElement).classList.contains('section-canvas')) return;
    
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.lassoStartX = event.clientX - rect.left;
    this.lassoStartY = event.clientY - rect.top;
    this.lassoIsAppend = event.ctrlKey || event.metaKey || event.shiftKey;
    this.selectionBox.set({ x: this.lassoStartX, y: this.lassoStartY, width: 0, height: 0 });

    this.lassoMoveHandler = (e: MouseEvent) => {
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      const x = Math.min(this.lassoStartX, currentX);
      const y = Math.min(this.lassoStartY, currentY);
      const width = Math.abs(currentX - this.lassoStartX);
      const height = Math.abs(currentY - this.lassoStartY);
      this.selectionBox.set({ x, y, width, height });
    };

    this.lassoUpHandler = () => {
      document.removeEventListener('mousemove', this.lassoMoveHandler);
      document.removeEventListener('mouseup', this.lassoUpHandler);
      
      const box = this.selectionBox();
      this.selectionBox.set(null);
      if (!box || (box.width < 5 && box.height < 5)) {
        if (!this.lassoIsAppend) this.templateService.selectElement(null);
        return;
      }

      const boxLeft = box.x;
      const boxTop = box.y;
      const boxRight = box.x + box.width;
      const boxBottom = box.y + box.height;
      
      const selectedIds: string[] = [];
      
      for (const el of this.section.elements) {
        let ew = (el.type === 'table' && el.table) 
          ? (el.table.columnSettings?.reduce((acc, c) => acc + (c.visible ? c.width : 0), 0) || 120) 
          : (el.size?.width || 120);
          
        let eh = (el.type === 'table' && el.table) 
          ? this.getElementHeight(el)
          : (el.size?.height || (el.style ? Math.max(24, el.style.fontSize * 1.5) : 36));

        const elL = el.position.x;
        const elT = el.position.y;
        const elR = elL + ew;
        const elB = elT + eh;

        const isOverlap = elL <= boxRight && elR >= boxLeft && elT <= boxBottom && elB >= boxTop;
        
        if (isOverlap) {
          selectedIds.push(el.id);
        }
      }
      
      if (selectedIds.length > 0) {
        this.templateService.selectElements(selectedIds, this.lassoIsAppend);
      } else if (!this.lassoIsAppend) {
        this.templateService.selectElement(null);
      }
    };
    
    document.addEventListener('mousemove', this.lassoMoveHandler);
    document.addEventListener('mouseup', this.lassoUpHandler);
  }

  onRepeatPerRowChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.sectionRepeatChange.emit({ sectionId: this.section.id, repeatPerRow: checked });
  }

  onRepeatOnPageChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.templateService.updateSectionRepeatOnPage(this.section.id, checked);
  }

  onSectionDatasetChange(value: string | undefined): void {
    this.templateService.updateSectionDataset(this.section.id, value || '');
  }

  isFirstSection(): boolean {
    return this.template().sections[0]?.id === this.section.id;
  }

  isLastSection(): boolean {
    const sections = this.template().sections;
    return sections[sections.length - 1]?.id === this.section.id;
  }

  onMoveSection(direction: 'up' | 'down', event: Event): void {
    event.stopPropagation();
    this.templateService.moveSection(this.section.id, direction);
  }

  onCanvasClick(event: MouseEvent): void {
    this.templateService.selectElement(null);
  }

  onPositionChange(id: string, pos: { x: number; y: number }): void {
    const snapThreshold = 4;
    let snappedX = pos.x;
    let snappedY = pos.y;
    const linesX: number[] = [];
    const linesY: number[] = [];

    const siblings = this.section.elements.filter((el) => el.id !== id);

    for (const sibling of siblings) {
      if (Math.abs(pos.x - sibling.position.x) < snapThreshold) {
        snappedX = sibling.position.x;
        linesX.push(snappedX);
        break;
      }
    }

    for (const sibling of siblings) {
      if (Math.abs(pos.y - sibling.position.y) < snapThreshold) {
        snappedY = sibling.position.y;
        linesY.push(snappedY);
        break;
      }
    }

    this.alignmentLines.set({ x: linesX, y: linesY });
    this.elementMove.emit({ id, x: snappedX, y: snappedY });
  }

  onDragEnd(): void {
    this.alignmentLines.set({ x: [], y: [] });
  }

  startResize(event: MouseEvent): void {
    event.preventDefault();
    this.resizeStartY = event.clientY;
    this.resizeStartHeight = this.section.height;

    this.resizeMoveHandler = (e: MouseEvent) => {
      const dy = e.clientY - this.resizeStartY;
      let targetHeight = Math.max(4, this.resizeStartHeight + dy);

      // Calculate the absolute minimum height needed to contain current elements without moving them
      let minRequiredHeight = 4;
      for (const el of this.section.elements) {
        const bottomY = el.position.y + this.getElementHeight(el);
        if (bottomY > minRequiredHeight) minRequiredHeight = bottomY;
      }

      // Constrain the height: cannot be smaller than the content
      const finalHeight = Math.max(targetHeight, minRequiredHeight);

      this.sectionResize.emit({ sectionId: this.section.id, height: finalHeight });
    };

    this.resizeUpHandler = () => {
      document.removeEventListener('mousemove', this.resizeMoveHandler);
      document.removeEventListener('mouseup', this.resizeUpHandler);
    };
    document.addEventListener('mousemove', this.resizeMoveHandler);
    document.addEventListener('mouseup', this.resizeUpHandler);
  }

  fitToContent(): void {
    let maxContentY = 0;
    for (const el of this.section.elements) {
      const elHeight = this.getElementHeight(el);
      const bottomY = el.position.y + elHeight;
      if (bottomY > maxContentY) maxContentY = bottomY;
    }
    
    // Set to 4 minimum to keep header/handle visible
    const newHeight = Math.max(4, Math.ceil(maxContentY));
    this.sectionResize.emit({ sectionId: this.section.id, height: newHeight });
  }

  private createTableData(rows: number, columns: number): TableData {
    return {
      rows,
      columns,
      cells: Array.from({ length: rows }, () =>
        Array.from({ length: columns }, () => ({ content: '' }))
      ),
      rowHeights: Array.from({ length: rows }, () => 36),
      columnSettings: Array.from({ length: columns }, (_v, index) => ({
        width: 120,
        order: index,
        visible: true,
      })),
    };
  }
}
