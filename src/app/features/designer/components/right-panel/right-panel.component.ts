import { Component, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TemplateService } from '../../../../core/services/template.service';
import { DataService } from '../../../../core/services/data.service';
import { ElementStyle } from '../../../../core/models/template.model';

@Component({
  selector: 'app-right-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="right-panel">
      <div class="panel-header">
        <span class="panel-icon">&#9881;</span>
        <span class="panel-title">Properties</span>
      </div>

      @if (element(); as el) {
        <div class="props-content">
          <div class="prop-section">
            <div class="prop-section-title">Element Info</div>
            <div class="prop-row">
              <label>Type</label>
              <span class="badge-text">{{ el.type }}</span>
            </div>
            @if (el.boundField) {
              <div class="prop-row">
                <label>Bound Field</label>
                <span class="badge-field">{{ el.boundField }}</span>
              </div>
            }
            <div class="prop-row">
              <label>Section</label>
              <span class="badge-section">{{ sectionLabel() }}</span>
            </div>
          </div>

          <div class="prop-section">
            <div class="prop-section-title">Content</div>
            
            @if (el.type === 'text' || el.type === 'field') {
              <div class="prop-col">
                <label class="prop-label">Text / Expression</label>
                <textarea
                  class="prop-textarea"
                  [value]="el.content || ''"
                  (input)="onContentChange($event)"
                  rows="3"
                  [attr.placeholder]="placeholderHint"
                ></textarea>
                <div class="hint-text">Use <code>{{ '{' + '{field}' + '}' }}</code> for dynamic values. Expressions: <code>{{ '{' + '{age + 5}' + '}' }}</code></div>
              </div>

              <div class="prop-col">
                <label class="prop-label">Bind to Field</label>
                <select class="prop-select" [value]="el.boundField || ''" (change)="onBindField($event)">
                  <option value="">— None —</option>
                  @for (f of fields(); track f.key) {
                    <option [value]="f.key">{{ f.label }} ({{ f.key }})</option>
                  }
                </select>
              </div>
            }

            @if (el.type === 'image') {
              <div class="prop-col">
                <label class="prop-label">Upload Image</label>
                <input type="file" accept="image/*" (change)="onImageUpload($event)" style="font-size: 11px;" />
                @if (el.imageUrl) {
                  <img [src]="el.imageUrl" style="margin-top: 8px; max-width: 100%; max-height: 100px; border-radius: 4px; border: 1px solid #e2e8f0;"/>
                }
              </div>
            }
          </div>

          <div class="prop-section">
            <div class="prop-section-title">Typography</div>

            <div class="prop-row">
              <label>Font Size</label>
              <div class="stepper">
                <button (click)="adjustSize(-1)">&#8722;</button>
                <span>{{ el.style.fontSize }}px</span>
                <button (click)="adjustSize(1)">&#43;</button>
              </div>
            </div>

            <div class="prop-row">
              <label>Color</label>
              <div class="color-row">
                <input
                  type="color"
                  class="color-picker"
                  [value]="el.style.color"
                  (input)="onColorChange($event)"
                />
                <span class="color-hex">{{ el.style.color }}</span>
              </div>
            </div>

            <div class="prop-row">
              <label>Style</label>
              <div class="toggle-group">
                <button
                  class="toggle-btn"
                  [class.active]="el.style.fontWeight === 'bold'"
                  (click)="toggleBold()"
                  title="Bold"
                ><strong>B</strong></button>
                <button
                  class="toggle-btn"
                  [class.active]="el.style.fontStyle === 'italic'"
                  (click)="toggleItalic()"
                  title="Italic"
                ><em>I</em></button>
                <button
                  class="toggle-btn"
                  [class.active]="el.style.textDecoration === 'underline'"
                  (click)="toggleUnderline()"
                  title="Underline"
                ><u>U</u></button>
              </div>
            </div>
          </div>

          <div class="prop-section">
            <div class="prop-section-title">Position</div>
            <div class="prop-row">
              <label>X</label>
              <input
                type="number"
                class="prop-number"
                [value]="el.position.x"
                (change)="onXChange($event)"
                min="0"
              />
            </div>
            <div class="prop-row">
              <label>Y</label>
              <input
                type="number"
                class="prop-number"
                [value]="el.position.y"
                (change)="onYChange($event)"
                min="0"
              />
            </div>
          </div>

          <div class="danger-zone">
            <button class="delete-btn" (click)="deleteElement()">
              &#128465; Delete Element
            </button>
          </div>
        </div>
      } @else {
        <div class="empty-state">
          <div class="empty-icon">&#9654;</div>
          <div class="empty-title">No element selected</div>
          <div class="empty-hint">Click an element on the canvas to edit its properties</div>
        </div>
      }
    </div>
  `,
  styles: [`
    .right-panel {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #fff;
      border-left: 1px solid #e2e8f0;
      overflow: hidden;
    }
    .panel-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 14px 16px 10px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .panel-icon { font-size: 14px; color: #3b82f6; }
    .panel-title { font-size: 12px; font-weight: 700; letter-spacing: 0.5px; color: #1e293b; text-transform: uppercase; }
    .props-content { flex: 1; overflow-y: auto; padding-bottom: 16px; }
    .props-content::-webkit-scrollbar { width: 4px; }
    .props-content::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
    .prop-section { padding: 12px 14px 8px; border-bottom: 1px solid #f1f5f9; }
    .prop-section-title {
      font-size: 10px; font-weight: 700; letter-spacing: 0.8px;
      text-transform: uppercase; color: #94a3b8; margin-bottom: 10px;
    }
    .prop-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .prop-col { margin-bottom: 10px; }
    label { font-size: 11px; color: #64748b; }
    .prop-label { display: block; font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .badge-text, .badge-field, .badge-section {
      font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500;
    }
    .badge-text { background: #f1f5f9; color: #475569; }
    .badge-field { background: #dbeafe; color: #2563eb; font-family: monospace; }
    .badge-section { background: #f0fdf4; color: #16a34a; }
    .prop-textarea {
      width: 100%; box-sizing: border-box; padding: 6px 8px;
      border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px;
      font-family: monospace; resize: vertical; color: #1e293b;
      background: #f8fafc; line-height: 1.4; outline: none;
    }
    .prop-textarea:focus { border-color: #3b82f6; background: #fff; }
    .hint-text { font-size: 10px; color: #94a3b8; margin-top: 4px; line-height: 1.5; }
    .hint-text code { background: #f1f5f9; color: #475569; padding: 0 3px; border-radius: 3px; font-family: monospace; }
    .prop-select {
      width: 100%; padding: 5px 8px; border: 1px solid #e2e8f0;
      border-radius: 6px; font-size: 11px; background: #f8fafc; color: #1e293b;
      outline: none; box-sizing: border-box;
    }
    .prop-select:focus { border-color: #3b82f6; }
    .stepper { display: flex; align-items: center; gap: 8px; }
    .stepper button {
      width: 22px; height: 22px; background: #f1f5f9; border: 1px solid #e2e8f0;
      border-radius: 4px; cursor: pointer; font-size: 14px; line-height: 1;
      display: flex; align-items: center; justify-content: center; color: #475569;
    }
    .stepper button:hover { background: #e2e8f0; }
    .stepper span { font-size: 11px; font-weight: 600; color: #334155; min-width: 36px; text-align: center; }
    .color-row { display: flex; align-items: center; gap: 6px; }
    .color-picker { width: 28px; height: 24px; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1px; cursor: pointer; }
    .color-hex { font-size: 11px; font-family: monospace; color: #475569; }
    .toggle-group { display: flex; gap: 4px; }
    .toggle-btn {
      width: 26px; height: 26px; background: #f1f5f9; border: 1px solid #e2e8f0;
      border-radius: 4px; cursor: pointer; font-size: 12px; display: flex;
      align-items: center; justify-content: center; color: #475569;
    }
    .toggle-btn:hover { background: #e2e8f0; }
    .toggle-btn.active { background: #dbeafe; border-color: #93c5fd; color: #1d4ed8; }
    .prop-number {
      width: 70px; padding: 4px 8px; border: 1px solid #e2e8f0;
      border-radius: 5px; font-size: 12px; color: #1e293b;
      background: #f8fafc; outline: none; text-align: right;
    }
    .prop-number:focus { border-color: #3b82f6; }
    .danger-zone { padding: 12px 14px; }
    .delete-btn {
      width: 100%; padding: 7px; background: #fef2f2; border: 1px solid #fecaca;
      border-radius: 6px; color: #ef4444; font-size: 12px; font-weight: 500;
      cursor: pointer; transition: background 0.15s;
    }
    .delete-btn:hover { background: #fee2e2; }
    .empty-state {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 40px 20px; text-align: center;
    }
    .empty-icon { font-size: 32px; color: #e2e8f0; margin-bottom: 12px; }
    .empty-title { font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 6px; }
    .empty-hint { font-size: 11px; color: #cbd5e1; line-height: 1.6; }
  `],
})
export class RightPanelComponent {
  private templateService = inject(TemplateService);
  private dataService = inject(DataService);

  readonly placeholderHint = 'e.g. {{name}} or Hello {{name}}';
  readonly element = this.templateService.selectedElement;
  readonly fields = signal(this.dataService.getFields());
  readonly sectionLabel = computed(() => {
    const s = this.templateService.selectedElementSection();
    const map: Record<string, string> = {
      reportHeader: 'Report Header',
      pageHeader: 'Page Header',
      details: 'Details',
      footer: 'Footer',
    };
    return s ? (map[s] ?? s) : '';
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

  deleteElement(): void {
    const el = this.element();
    if (el) this.templateService.removeElement(el.id);
  }

  private updateStyle(patch: Partial<ElementStyle>): void {
    const el = this.element();
    if (el) this.templateService.updateElement(el.id, { style: { ...el.style, ...patch } });
  }
}
