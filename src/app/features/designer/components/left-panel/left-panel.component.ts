import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../../core/services/data.service';
import { TemplateService } from '../../../../core/services/template.service';
import { Field } from '../../../../core/models/field.model';

@Component({
  selector: 'app-left-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="left-panel">
      <div class="panel-header">
        <span class="panel-icon">&#9783;</span>
        <span class="panel-title">Field Explorer</span>
      </div>

      <div class="api-loader">
        <div class="api-input-group">
          <label>API Endpoint</label>
          <div class="input-row">
            <input
              type="text"
              [value]="apiUrl()"
              (input)="apiUrl.set($any($event.target).value)"
              placeholder="https://jsonplaceholder.typicode.com/users"
              class="api-input"
            />
            <button (click)="loadData()" [disabled]="isLoading()" class="load-btn">
              {{ isLoading() ? '...' : 'Load' }}
            </button>
          </div>
        </div>
        @if (errorMsg()) {
          <div class="error-msg">{{ errorMsg() }}</div>
        }
      </div>

      <ng-template #fieldNode let-field let-level="level">
        <div
          class="field-item"
          [style.padding-left.px]="level * 16 + 8"
          [attr.data-field-key]="field.key"
          [attr.data-field-label]="field.label"
          [attr.data-field-type]="field.type"
          [attr.draggable]="!field.children"
          (dragstart)="!field.children && onDragStart($event, field)"
          (dragend)="onDragEnd()"
          [class.dragging]="draggingKey() === field.key"
          [class.is-parent]="field.children"
        >
          @if (field.children) {
            <button class="expand-btn" (click)="toggleExpand(field, $event)">
              {{ field.isExpanded ? '▼' : '▶' }}
            </button>
          } @else {
            <span class="field-type-badge" [class]="'type-' + field.type">
              {{ typeIcon(field.type) }}
            </span>
          }
          <span class="field-name">{{ field.label }}</span>
        </div>
        
        @if (field.children && field.isExpanded) {
          @for (child of field.children; track child.key) {
            <ng-container *ngTemplateOutlet="fieldNode; context: { $implicit: child, level: level + 1 }"></ng-container>
          }
        }
      </ng-template>

      <div class="section-label">Data Fields</div>
      <div class="fields-list">
        @if (fields().length === 0 && !isLoading() && !errorMsg()) {
          <div class="empty-state">No fields available</div>
        }
        @for (field of fields(); track field.key) {
          <ng-container *ngTemplateOutlet="fieldNode; context: { $implicit: field, level: 0 }"></ng-container>
        }
      </div>

      <div class="section-label">Static Elements</div>
      <div class="fields-list" style="flex: 0 0 auto; max-height: 150px;">
        <div
          class="field-item"
          draggable="true"
          (dragstart)="onStaticDragStart($event, 'text')"
          (dragend)="onDragEnd()"
          [class.dragging]="draggingKey() === 'static-text'"
        >
          <span class="field-type-badge type-text">T</span>
          <span class="field-name">Text Element</span>
        </div>
        <div
          class="field-item"
          draggable="true"
          (dragstart)="onStaticDragStart($event, 'image')"
          (dragend)="onDragEnd()"
          [class.dragging]="draggingKey() === 'static-image'"
        >
          <span class="field-type-badge type-date">Img</span>
          <span class="field-name">Image Element</span>
        </div>
      </div>

      <div class="section-label">Template Sections</div>
      <div class="sections-list">
        @for (section of sections(); track section.type) {
          <div class="section-item" [class]="'section-' + section.type">
            <span class="section-dot"></span>
            <span class="section-name">{{ section.label }}</span>
            <span class="section-count">{{ section.elements.length }}</span>
          </div>
        }
      </div>

      <div class="panel-footer">
        <div class="stat-row">
          <span class="stat-label">Total Fields</span>
          <span class="stat-value">{{ fields().length }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Total Elements</span>
          <span class="stat-value">{{ totalElements() }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .left-panel {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #1a2035;
      color: #e2e8f0;
      overflow: hidden;
    }
    .panel-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 16px 10px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .panel-icon { font-size: 16px; color: #60a5fa; }
    .panel-title { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; color: #f1f5f9; text-transform: uppercase; }
    .api-loader {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .api-input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .api-input-group label {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .input-row { display: flex; gap: 6px; }
    .api-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: #e2e8f0;
      padding: 6px 8px;
      font-size: 11px;
      outline: none;
      min-width: 0;
    }
    .api-input:focus { border-color: #3b82f6; }
    .load-btn {
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 0 12px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .load-btn:hover:not(:disabled) { background: #2563eb; }
    .load-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .error-msg {
      color: #ef4444;
      font-size: 10px;
      margin-top: 6px;
    }
    .expand-btn {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 10px;
      cursor: pointer;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .empty-state {
      padding: 12px;
      color: #94a3b8;
      font-size: 11px;
      text-align: center;
    }
    .is-parent { background: rgba(255, 255, 255, 0.015); cursor: default; }
    .is-parent:active { cursor: default; }
    .section-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #475569;
      padding: 10px 16px 4px;
    }
    .fields-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 8px;
    }
    .fields-list::-webkit-scrollbar { width: 4px; }
    .fields-list::-webkit-scrollbar-track { background: transparent; }
    .fields-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
    .field-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 8px;
      border-radius: 6px;
      cursor: grab;
      transition: background 0.15s;
      margin-bottom: 2px;
      user-select: none;
    }
    .field-item:hover { background: rgba(59,130,246,0.15); }
    .field-item:active { cursor: grabbing; }
    .field-item.dragging { opacity: 0.4; }
    .field-type-badge {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .type-text { background: rgba(34,197,94,0.2); color: #4ade80; }
    .type-number { background: rgba(251,146,60,0.2); color: #fb923c; }
    .type-date { background: rgba(96,165,250,0.2); color: #60a5fa; }
    .field-name { font-size: 12px; color: #cbd5e1; flex: 1; }
    .field-key-hint { font-size: 10px; color: #475569; font-family: monospace; }
    .sections-list { padding: 4px 8px 8px; }
    .section-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 5px;
      margin-bottom: 2px;
    }
    .section-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }
    .section-reportHeader .section-dot { background: #f59e0b; }
    .section-pageHeader .section-dot { background: #3b82f6; }
    .section-details .section-dot { background: #10b981; }
    .section-footer .section-dot { background: #8b5cf6; }
    .section-name { font-size: 11px; color: #94a3b8; flex: 1; }
    .section-count {
      font-size: 10px; background: rgba(255,255,255,0.08);
      color: #64748b; border-radius: 10px; padding: 1px 6px;
    }
    .panel-footer {
      border-top: 1px solid rgba(255,255,255,0.07);
      padding: 10px 16px;
    }
    .stat-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .stat-label { font-size: 10px; color: #475569; }
    .stat-value { font-size: 11px; font-weight: 600; color: #60a5fa; }
  `],
})
export class LeftPanelComponent {
  private dataService = inject(DataService);
  private templateService = inject(TemplateService);

  readonly apiUrl = signal('https://jsonplaceholder.typicode.com/users');
  readonly isLoading = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly fields = signal<Field[]>(this.dataService.getFields());
  readonly draggingKey = signal<string | null>(null);

  readonly sections = computed(() => this.templateService.template().sections);

  readonly totalElements = computed(() =>
    this.templateService.template().sections.reduce((sum, s) => sum + s.elements.length, 0)
  );

  async loadData() {
    if (!this.apiUrl()) return;
    this.isLoading.set(true);
    this.errorMsg.set(null);
    try {
      const data = await this.dataService.getData(this.apiUrl());
      if (!data || data.length === 0) {
        this.errorMsg.set('No fields available');
        this.fields.set([]);
      } else {
        this.fields.set(this.dataService.getFields(data[0]));
      }
    } catch (err) {
      this.errorMsg.set('Invalid API -> ' + (err as Error).message);
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleExpand(field: Field, event: Event) {
    event.stopPropagation();
    field.isExpanded = !field.isExpanded;
  }

  onDragStart(event: DragEvent, field: Field): void {
    if (field.children) return; 
    event.dataTransfer?.setData('application/field-key', field.path || field.key);
    event.dataTransfer?.setData('application/field-label', field.label);
    event.dataTransfer?.setData('application/field-type', field.type);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    this.draggingKey.set(field.key);
  }

  onDragEnd(): void {
    this.draggingKey.set(null);
  }

  onStaticDragStart(event: DragEvent, type: string): void {
    event.dataTransfer?.setData('application/static-type', type);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    this.draggingKey.set(`static-${type}`);
  }

  typeIcon(type: string): string {
    return type === 'number' ? '#' : type === 'date' ? 'D' : type === 'object' ? '{}' : type === 'array' ? '[]' : 'T';
  }
}
