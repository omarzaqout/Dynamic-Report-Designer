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

      <div class="search-box">
        <input
          type="text"
          placeholder="Search fields..."
          (input)="onSearch($event)"
          class="search-input"
        />
      </div>

      <div class="section-label">Data Fields</div>
      <div class="fields-list">
        @for (field of filteredFields(); track field.key) {
          <div
            class="field-item"
            [attr.data-field-key]="field.key"
            [attr.data-field-label]="field.label"
            [attr.data-field-type]="field.type"
            draggable="true"
            (dragstart)="onDragStart($event, field)"
            (dragend)="onDragEnd()"
            [class.dragging]="draggingKey() === field.key"
          >
            <span class="field-type-badge" [class]="'type-' + field.type">
              {{ typeIcon(field.type) }}
            </span>
            <span class="field-name">{{ field.label }}</span>
            <span class="field-key-hint">{{ field.key }}</span>
          </div>
        }
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
    .search-box { padding: 10px 12px 6px; }
    .search-input {
      width: 100%;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      color: #e2e8f0;
      padding: 6px 10px;
      font-size: 12px;
      box-sizing: border-box;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-input::placeholder { color: #64748b; }
    .search-input:focus { border-color: #3b82f6; }
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

  readonly fields = signal<Field[]>(this.dataService.getFields());
  readonly searchQuery = signal('');
  readonly draggingKey = signal<string | null>(null);

  readonly filteredFields = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return q ? this.fields().filter((f) => f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)) : this.fields();
  });

  readonly sections = computed(() => this.templateService.template().sections);

  readonly totalElements = computed(() =>
    this.templateService.template().sections.reduce((sum, s) => sum + s.elements.length, 0)
  );

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  onDragStart(event: DragEvent, field: Field): void {
    event.dataTransfer?.setData('application/field-key', field.key);
    event.dataTransfer?.setData('application/field-label', field.label);
    event.dataTransfer?.setData('application/field-type', field.type);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    this.draggingKey.set(field.key);
  }

  onDragEnd(): void {
    this.draggingKey.set(null);
  }

  typeIcon(type: string): string {
    return type === 'number' ? '#' : type === 'date' ? 'D' : 'T';
  }
}
