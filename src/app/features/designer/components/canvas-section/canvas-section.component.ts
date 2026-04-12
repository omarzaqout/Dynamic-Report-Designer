import { Component, Input, Output, EventEmitter, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateSection, TemplateElement, SectionType, DEFAULT_STYLE } from '../../../../core/models/template.model';
import { CanvasElementComponent } from '../canvas-element/canvas-element.component';

@Component({
  selector: 'app-canvas-section',
  standalone: true,
  imports: [CommonModule, CanvasElementComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="section-wrapper" [class]="'section-type-' + section.type">
      <div class="section-label-bar">
        <span class="section-badge" [class]="'badge-' + section.type">{{ section.type }}</span>
        <span class="section-title">{{ section.label }}</span>
        @if (section.type === 'details') {
          <span class="detail-hint">repeats per row</span>
        }
        <div class="section-actions">
          <button class="resize-btn" (mousedown)="startResize($event)" title="Drag to resize section">&#8597;</button>
        </div>
      </div>
      <div
        class="section-canvas"
        [style.height.px]="section.height"
        [class.drag-over]="isDragOver()"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave()"
        (drop)="onDrop($event)"
        (click)="onCanvasClick()"
      >
        @for (el of section.elements; track el.id) {
          <app-canvas-element
            [element]="el"
            [selected]="selectedElementId === el.id"
            (positionChange)="onPositionChange(el.id, $event)"
            (select)="elementSelect.emit($event)"
            (delete)="elementDelete.emit($event)"
          />
        }
        @if (section.elements.length === 0) {
          <div class="empty-hint">
            <span>Drop fields here</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .section-wrapper { margin-bottom: 2px; }
    .section-label-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 10px;
      height: 26px;
      background: #f1f5f9;
      border-left: 3px solid #cbd5e1;
      border-bottom: 1px solid #e2e8f0;
    }
    .section-type-reportHeader .section-label-bar { border-left-color: #f59e0b; background: #fffbeb; }
    .section-type-pageHeader .section-label-bar { border-left-color: #3b82f6; background: #eff6ff; }
    .section-type-details .section-label-bar { border-left-color: #10b981; background: #f0fdf4; }
    .section-type-footer .section-label-bar { border-left-color: #8b5cf6; background: #faf5ff; }
    .section-badge {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 1px 6px;
      border-radius: 10px;
    }
    .badge-reportHeader { background: #fef3c7; color: #d97706; }
    .badge-pageHeader { background: #dbeafe; color: #2563eb; }
    .badge-details { background: #d1fae5; color: #059669; }
    .badge-footer { background: #ede9fe; color: #7c3aed; }
    .section-title { font-size: 11px; font-weight: 600; color: #475569; }
    .detail-hint { font-size: 10px; color: #9ca3af; font-style: italic; }
    .section-actions { margin-left: auto; }
    .resize-btn {
      background: none; border: none; cursor: ns-resize;
      color: #94a3b8; font-size: 14px; padding: 0 4px; line-height: 1;
    }
    .resize-btn:hover { color: #475569; }
    .section-canvas {
      position: relative;
      background: #fff;
      border-left: 3px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      overflow: hidden;
      transition: background 0.1s;
    }
    .section-type-reportHeader .section-canvas { border-left-color: #f59e0b; }
    .section-type-pageHeader .section-canvas { border-left-color: #3b82f6; }
    .section-type-details .section-canvas { border-left-color: #10b981; }
    .section-type-footer .section-canvas { border-left-color: #8b5cf6; }
    .section-canvas.drag-over { background: rgba(59,130,246,0.04); outline: 2px dashed #3b82f6; outline-offset: -2px; }
    .empty-hint {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      color: #cbd5e1;
      pointer-events: none;
      font-style: italic;
    }
  `],
})
export class CanvasSectionComponent {
  @Input({ required: true }) section!: TemplateSection;
  @Input() selectedElementId: string | null = null;

  @Output() elementAdd = new EventEmitter<{ sectionType: SectionType; element: Omit<TemplateElement, 'id'> }>();
  @Output() elementSelect = new EventEmitter<string>();
  @Output() elementDelete = new EventEmitter<string>();
  @Output() elementMove = new EventEmitter<{ id: string; x: number; y: number }>();
  @Output() sectionResize = new EventEmitter<{ sectionType: SectionType; height: number }>();

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
    const fieldKey = event.dataTransfer?.getData('application/field-key');
    const fieldLabel = event.dataTransfer?.getData('application/field-label');
    if (!fieldKey) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, event.clientX - rect.left - 4);
    const y = Math.max(0, event.clientY - rect.top - 10);

    this.elementAdd.emit({
      sectionType: this.section.type,
      element: {
        type: 'text',
        content: `{{${fieldKey}}}`,
        position: { x, y },
        style: { ...DEFAULT_STYLE },
        boundField: fieldKey,
      },
    });
  }

  onCanvasClick(): void {
    this.elementSelect.emit('');
  }

  onPositionChange(id: string, pos: { x: number; y: number }): void {
    this.elementMove.emit({ id, ...pos });
  }

  startResize(event: MouseEvent): void {
    event.preventDefault();
    this.resizeStartY = event.clientY;
    this.resizeStartHeight = this.section.height;

    this.resizeMoveHandler = (e: MouseEvent) => {
      const dy = e.clientY - this.resizeStartY;
      this.sectionResize.emit({ sectionType: this.section.type, height: Math.max(30, this.resizeStartHeight + dy) });
    };
    this.resizeUpHandler = () => {
      document.removeEventListener('mousemove', this.resizeMoveHandler);
      document.removeEventListener('mouseup', this.resizeUpHandler);
    };
    document.addEventListener('mousemove', this.resizeMoveHandler);
    document.addEventListener('mouseup', this.resizeUpHandler);
  }
}
