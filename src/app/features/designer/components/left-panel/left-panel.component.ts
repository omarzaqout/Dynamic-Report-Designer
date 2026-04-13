import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../../core/services/data.service';
import { TemplateService } from '../../../../core/services/template.service';
import { Field } from '../../../../core/models/field.model';

@Component({
  selector: 'app-left-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './left-panel.component.html',
  styleUrl: './left-panel.component.css',
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
