import { Component, inject, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateService } from '../../../../core/services/template.service';
import { CanvasSectionComponent } from '../canvas-section/canvas-section.component';
import { TemplateElement } from '../../../../core/models/template.model';
import { UiService } from '../../../../core/services/ui.service';

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
  private uiService = inject(UiService);

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

  addSection(type: any): void {
    this.templateService.addSection(type);
  }

  undo(): void { this.templateService.undo(); }
  redo(): void { this.templateService.redo(); }
  exportJson(): void { this.templateService.exportAsJson(); }
  exportPdf(): void { 
    this.uiService.setView('preview');
    // Give a tiny delay for the view to switch before calling print dialog
    setTimeout(() => window.print(), 500);
  }
  resetTemplate(): void {
    if (confirm('Are you sure you want to reset the template? ALL changes will be lost.')) {
      this.templateService.resetTemplate();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName);
    if (isInput) return;

    const key = event.key.toLowerCase();
    if (key === 'escape') {
      this.templateService.selectElement(null);
    }
    if (key === 'delete' || key === 'backspace') {
      this.templateService.deleteSelectedElements();
    }
    
    if (event.ctrlKey || event.metaKey) {
      if (key === 'c') {
        event.preventDefault();
        event.stopPropagation();
        this.templateService.copySelectedElements();
      } else if (key === 'v') {
        event.preventDefault();
        event.stopPropagation();
        this.templateService.pasteElements();
      } else if (key === 'd') {
        event.preventDefault();
        event.stopPropagation();
        this.templateService.duplicateSelectedElements();
      } else if (key === 'z') {
        event.preventDefault();
        this.templateService.undo();
      } else if (key === 'y') {
        event.preventDefault();
        this.templateService.redo();
      }
    }
  }
}
