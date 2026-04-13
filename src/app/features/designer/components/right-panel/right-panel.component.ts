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
  templateUrl: './right-panel.component.html',
  styleUrl: './right-panel.component.css',
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
