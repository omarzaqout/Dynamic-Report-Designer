import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../../../core/services/data.service';
import { TemplateService } from '../../../../core/services/template.service';
import { Field } from '../../../../core/models/field.model';
import { TemplateSection } from '../../../../core/models/template.model';

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

  readonly apiUrl = signal('');
  readonly isLoading = signal(false);
  readonly errorMsg = signal<string | null>(null);

  readonly datasets = this.dataService.datasets;
  readonly activeDataset = this.dataService.activeDataset;

  readonly fields = computed(() => {
    // Accessing activeDataset() ensures this re-runs when it changes
    const active = this.activeDataset();
    return this.dataService.getFields();
  });

  readonly draggingKey = signal<string | null>(null);
  readonly collapsed = signal<Record<string, boolean>>({});

  toggleSection(key: string): void {
    this.collapsed.update(c => ({ ...c, [key]: !c[key] }));
  }

  isSectionCollapsed(key: string): boolean {
    return this.collapsed()[key] ?? false;
  }

  readonly sections = computed(() => this.templateService.template().sections);

  readonly totalElements = computed(() =>
    this.templateService.template().sections.reduce((sum: number, s: TemplateSection) => sum + s.elements.length, 0)
  );

  async loadData() {
    if (!this.apiUrl()) return;
    this.isLoading.set(true);
    this.errorMsg.set(null);
    try {
      await this.dataService.getData(this.apiUrl());
      if (this.datasets().length === 0 && !this.activeDataset()) {
        this.errorMsg.set('No datasets found in response');
      }
    } catch (err) {
      this.errorMsg.set('Invalid API -> ' + (err as Error).message);
    } finally {
      this.isLoading.set(false);
    }
  }

  onDatasetChange(event: Event) {
    const path = (event.target as HTMLSelectElement).value;
    const dataset = this.datasets().find(d => d.path === path);
    if (dataset) {
      this.dataService.selectDataset(dataset);
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

  onStaticDragStart(event: DragEvent, type: 'text' | 'image' | 'table'): void {
    event.dataTransfer?.setData('application/static-type', type);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
    this.draggingKey.set(`static-${type}`);
  }

  typeIcon(type: string): string {
    return type === 'number' ? '#' : type === 'date' ? 'D' : type === 'object' ? '{}' : type === 'array' ? '[]' : 'T';
  }
}
