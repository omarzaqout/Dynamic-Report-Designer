import { Component, Input, Output, EventEmitter, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateSection, TemplateElement, DEFAULT_STYLE, TableData } from '../../../../core/models/template.model';
import { CanvasElementComponent } from '../canvas-element/canvas-element.component';

@Component({
  selector: 'app-canvas-section',
  standalone: true,
  imports: [CommonModule, CanvasElementComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './canvas-section.component.html',
  styleUrl: './canvas-section.component.css',
})
export class CanvasSectionComponent {
  @Input({ required: true }) section!: TemplateSection;
  @Input() selectedElementId: string | null = null;

  @Output() elementAdd = new EventEmitter<{ sectionId: string; element: Omit<TemplateElement, 'id'> }>();
  @Output() elementSelect = new EventEmitter<string>();
  @Output() elementDelete = new EventEmitter<string>();
  @Output() elementMove = new EventEmitter<{ id: string; x: number; y: number }>();
  @Output() sectionResize = new EventEmitter<{ sectionId: string; height: number }>();
  @Output() sectionRepeatChange = new EventEmitter<{ sectionId: string; repeatPerRow: boolean }>();
  @Output() sectionDelete = new EventEmitter<string>();

  get computedHeight(): number {
    let maxContentY = 0;
    for (const el of this.section.elements) {
      let elHeight = 30;
      if (el.type === 'table' && el.table) {
        const rowHeights = el.table.rowHeights?.length ? el.table.rowHeights : Array.from({length: el.table.rows}, () => 36);
        elHeight = rowHeights.reduce((a, b) => a + b, 0);
      } else if (el.type === 'image' && el.size) {
        elHeight = el.size.height;
      } else if (el.style) {
        elHeight = Math.max(30, el.style.fontSize * 1.5);
      }
      const bottomY = el.position.y + elHeight;
      if (bottomY > maxContentY) maxContentY = bottomY;
    }
    return Math.max(this.section.height, maxContentY + 20);
  }

  alignmentLines = signal<{ x: number[], y: number[] }>({ x: [], y: [] });

  private _isDragOver = signal(false);
  readonly isDragOver = this._isDragOver.asReadonly();

  private resizeStartY = 0;
  private resizeStartHeight = 0;
  private resizeMoveHandler!: (e: MouseEvent) => void;
  private resizeUpHandler!: () => void;

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

    const staticType = event.dataTransfer?.getData('application/static-type') as 'text' | 'image' | 'table' | '';
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
              : staticType === 'table'
                ? { width: 360, height: 100 }
                : undefined,
          position: { x, y },
          style: { ...DEFAULT_STYLE },
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

  onRepeatPerRowChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.sectionRepeatChange.emit({ sectionId: this.section.id, repeatPerRow: checked });
  }

  onCanvasClick(): void {
    this.elementSelect.emit('');
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
      this.sectionResize.emit({ sectionId: this.section.id, height: Math.max(30, this.resizeStartHeight + dy) });
    };
    this.resizeUpHandler = () => {
      document.removeEventListener('mousemove', this.resizeMoveHandler);
      document.removeEventListener('mouseup', this.resizeUpHandler);
    };
    document.addEventListener('mousemove', this.resizeMoveHandler);
    document.addEventListener('mouseup', this.resizeUpHandler);
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
