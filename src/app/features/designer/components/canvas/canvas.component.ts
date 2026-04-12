import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateService } from '../../../../core/services/template.service';
import { CanvasSectionComponent } from '../canvas-section/canvas-section.component';
import { TemplateElement, SectionType } from '../../../../core/models/template.model';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, CanvasSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="canvas-host" (click)="deselect()">
      <div class="canvas-toolbar">
        <div class="canvas-title">
          <span class="canvas-icon">&#9638;</span>
          <span>{{ template().name }}</span>
        </div>
        <div class="canvas-info">
          <span class="info-chip">{{ sectionCount() }} sections</span>
          <span class="info-chip">{{ elementCount() }} elements</span>
        </div>
      </div>

      <div class="report-canvas">
        <div class="page-frame">
          @for (section of template().sections; track section.type) {
            <app-canvas-section
              [section]="section"
              [selectedElementId]="selectedId()"
              (elementAdd)="onElementAdd($event)"
              (elementSelect)="onElementSelect($event)"
              (elementDelete)="onElementDelete($event)"
              (elementMove)="onElementMove($event)"
              (sectionResize)="onSectionResize($event)"
            />
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .canvas-host {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #eef1f6;
      overflow: hidden;
    }
    .canvas-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      min-height: 42px;
    }
    .canvas-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }
    .canvas-icon { color: #3b82f6; font-size: 16px; }
    .canvas-info { display: flex; gap: 6px; }
    .info-chip {
      font-size: 11px;
      background: #f1f5f9;
      color: #64748b;
      padding: 2px 8px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
    }
    .report-canvas {
      flex: 1;
      overflow: auto;
      padding: 24px;
    }
    .report-canvas::-webkit-scrollbar { width: 8px; height: 8px; }
    .report-canvas::-webkit-scrollbar-track { background: #eef1f6; }
    .report-canvas::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .page-frame {
      background: #fff;
      width: 794px;
      min-height: 500px;
      margin: 0 auto;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06);
      border-radius: 3px;
      overflow: hidden;
    }
  `],
})
export class CanvasComponent {
  private templateService = inject(TemplateService);

  readonly template = this.templateService.template;
  readonly selectedId = this.templateService.selectedElementId;

  readonly sectionCount = () => this.template().sections.length;
  readonly elementCount = () => this.template().sections.reduce((s, sec) => s + sec.elements.length, 0);

  deselect(): void {
    this.templateService.selectElement(null);
  }

  onElementAdd(event: { sectionType: SectionType; element: Omit<TemplateElement, 'id'> }): void {
    this.templateService.addElement(event.sectionType, event.element);
  }

  onElementSelect(id: string): void {
    this.templateService.selectElement(id || null);
  }

  onElementDelete(id: string): void {
    this.templateService.removeElement(id);
  }

  onElementMove(event: { id: string; x: number; y: number }): void {
    this.templateService.updateElementPosition(event.id, event.x, event.y);
  }

  onSectionResize(event: { sectionType: SectionType; height: number }): void {
    this.templateService.updateSectionHeight(event.sectionType, event.height);
  }
}
