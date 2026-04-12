import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateElement } from '../../../../core/models/template.model';

@Component({
  selector: 'app-canvas-element',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #elRef
      class="canvas-el"
      [class.selected]="selected"
      [style.left.px]="element.position.x"
      [style.top.px]="element.position.y"
      [style.fontSize.px]="element.style.fontSize"
      [style.fontWeight]="element.style.fontWeight"
      [style.fontStyle]="element.style.fontStyle"
      [style.textDecoration]="element.style.textDecoration"
      [style.color]="element.style.color"
      (mousedown)="onMouseDown($event)"
      (click)="onClick($event)"
    >
      <span class="el-text">{{ element.content }}</span>
      @if (selected) {
        <div class="resize-handles">
          <div class="handle tl"></div>
          <div class="handle tr"></div>
          <div class="handle bl"></div>
          <div class="handle br"></div>
        </div>
        <button class="delete-btn" (click)="onDelete($event)" title="Delete element">&#10005;</button>
      }
    </div>
  `,
  styles: [`
    .canvas-el {
      position: absolute;
      cursor: move;
      white-space: nowrap;
      border: 1px solid transparent;
      padding: 2px 4px;
      border-radius: 3px;
      line-height: 1.4;
      transition: border-color 0.1s;
      min-width: 20px;
      box-sizing: border-box;
    }
    .canvas-el:hover { border-color: rgba(59,130,246,0.4); }
    .canvas-el.selected {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59,130,246,0.25);
    }
    .el-text { pointer-events: none; display: block; }
    .resize-handles { position: absolute; inset: 0; pointer-events: none; }
    .handle {
      position: absolute;
      width: 7px; height: 7px;
      background: #fff;
      border: 1px solid #3b82f6;
      border-radius: 2px;
    }
    .handle.tl { top: -4px; left: -4px; }
    .handle.tr { top: -4px; right: -4px; }
    .handle.bl { bottom: -4px; left: -4px; }
    .handle.br { bottom: -4px; right: -4px; }
    .delete-btn {
      position: absolute;
      top: -12px;
      right: -12px;
      width: 18px;
      height: 18px;
      background: #ef4444;
      color: #fff;
      border: none;
      border-radius: 50%;
      font-size: 9px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      line-height: 1;
      pointer-events: all;
    }
    .delete-btn:hover { background: #dc2626; }
  `],
})
export class CanvasElementComponent implements OnInit, OnDestroy {
  @Input({ required: true }) element!: TemplateElement;
  @Input() selected = false;
  @Output() positionChange = new EventEmitter<{ x: number; y: number }>();
  @Output() select = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();

  @ViewChild('elRef') elRef!: ElementRef<HTMLDivElement>;

  private isDragging = false;
  private startMouseX = 0;
  private startMouseY = 0;
  private startElX = 0;
  private startElY = 0;

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
    this.select.emit(this.element.id);
  }

  onMouseDown(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('delete-btn')) return;
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

  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    const dx = event.clientX - this.startMouseX;
    const dy = event.clientY - this.startMouseY;
    this.positionChange.emit({
      x: Math.max(0, this.startElX + dx),
      y: Math.max(0, this.startElY + dy),
    });
  }

  private onMouseUp(): void {
    this.isDragging = false;
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    document.removeEventListener('mouseup', this.mouseUpHandler);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.delete.emit(this.element.id);
  }
}
