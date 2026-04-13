import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateService } from '../../../../core/services/template.service';
import { CanvasSectionComponent } from '../canvas-section/canvas-section.component';
import { TemplateElement } from '../../../../core/models/template.model';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, CanvasSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './canvas.component.html',
  styleUrl: './canvas.component.css',
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

  onElementAdd(event: { sectionId: string; element: Omit<TemplateElement, 'id'> }): void {
    this.templateService.addElement(event.sectionId, event.element);
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

  onSectionResize(event: { sectionId: string; height: number }): void {
    this.templateService.updateSectionHeight(event.sectionId, event.height);
  }

  onSectionDelete(id: string): void {
    this.templateService.removeSection(id);
  }

  onSectionRepeatChange(event: { sectionId: string; repeatPerRow: boolean }): void {
    this.templateService.updateSectionRepeat(event.sectionId, event.repeatPerRow);
  }

  addDetailsSection(): void {
    this.templateService.addDetailsSection();
  }
}
