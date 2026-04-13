import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectionStrategy, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateElement } from '../../../../core/models/template.model';
import { TemplateService } from '../../../../core/services/template.service';

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
  @Input() selected = false;
  @Output() positionChange = new EventEmitter<{ x: number; y: number }>();
  @Output() select = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();

  @ViewChild('elRef') elRef!: ElementRef<HTMLDivElement>;

  private templateService = inject(TemplateService);

  isEditingInline = false;
  private isDragging = false;
  private isResizing = false;
  private startMouseX = 0;
  private startMouseY = 0;
  private startElX = 0;
  private startElY = 0;
  private resizeStartWidth = 0;
  private resizeStartHeight = 0;
  private resizeStartFontSize = 12;

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
      this.select.emit(this.element.id);
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
    if (target.classList.contains('delete-btn') || target.classList.contains('resize-handle')) return;
    event.preventDefault();
    event.stopPropagation();
    this.select.emit(this.element.id);
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

    this.isResizing = true;
    this.startMouseX = event.clientX;
    this.startMouseY = event.clientY;

    if (this.element.type === 'image') {
      const imgEl = this.elRef.nativeElement.querySelector('.el-image') as HTMLImageElement | null;
      this.resizeStartWidth = this.element.size?.width ?? imgEl?.clientWidth ?? 120;
      this.resizeStartHeight = this.element.size?.height ?? imgEl?.clientHeight ?? 120;
    } else {
      this.resizeStartFontSize = this.element.style.fontSize;
    }

    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
  }

  private onMouseMove(event: MouseEvent): void {
    if (this.isDragging) {
      const dx = event.clientX - this.startMouseX;
      const dy = event.clientY - this.startMouseY;
      this.positionChange.emit({
        x: Math.max(0, this.startElX + dx),
        y: Math.max(0, this.startElY + dy),
      });
      return;
    }

    if (!this.isResizing) return;
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
    this.isDragging = false;
    this.isResizing = false;
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('mouseup', this.mouseUpHandler);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.delete.emit(this.element.id);
  }
}
