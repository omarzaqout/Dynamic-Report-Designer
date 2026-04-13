import { Component, Input, Output, EventEmitter, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateSection, TemplateElement, SectionType, DEFAULT_STYLE } from '../../../../core/models/template.model';
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

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, event.clientX - rect.left - 4);
    const y = Math.max(0, event.clientY - rect.top - 10);

    const staticType = event.dataTransfer?.getData('application/static-type');
    if (staticType) {
      this.elementAdd.emit({
        sectionType: this.section.type,
        element: {
          type: staticType as 'text' | 'image',
          content: staticType === 'text' ? 'Double click to edit' : undefined,
          position: { x, y },
          style: { ...DEFAULT_STYLE },
        },
      });
      return;
    }

    const fieldKey = event.dataTransfer?.getData('application/field-key');
    if (!fieldKey) return;

    this.elementAdd.emit({
      sectionType: this.section.type,
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
