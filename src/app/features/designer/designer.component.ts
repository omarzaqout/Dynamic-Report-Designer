import { Component, ChangeDetectionStrategy, inject, signal, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { LeftPanelComponent } from './components/left-panel/left-panel.component';
import { CanvasComponent } from './components/canvas/canvas.component';
import { RightPanelComponent } from './components/right-panel/right-panel.component';
import { PreviewPanelComponent } from './components/preview-panel/preview-panel.component';
import { UiService } from '../../core/services/ui.service';
import { TemplateService } from '../../core/services/template.service';

@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [CommonModule, LeftPanelComponent, CanvasComponent, RightPanelComponent, PreviewPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './designer.component.html',
  styleUrl: './designer.component.css',
})
export class DesignerComponent implements OnInit {
  private uiService = inject(UiService);
  private templateService = inject(TemplateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  
  readonly activeView = this.uiService.activeView;

  // Sidebar widths and visibility
  readonly leftWidth = signal(240);
  readonly rightWidth = signal(280);
  readonly showLeftPanel = signal(true);
  readonly showRightPanel = signal(true);

  toggleLeftPanel(): void {
    this.showLeftPanel.update(v => !v);
  }

  toggleRightPanel(): void {
    this.showRightPanel.update(v => !v);
  }

  private isResizingLeft = false;
  private isResizingRight = false;

  setView(view: 'design' | 'preview'): void {
    this.uiService.setView(view);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.templateService.loadTemplateFromDb(id).catch(err => alert('Failed to load template'));
    } else {
      this.templateService.resetTemplate();
    }
  }

  async saveToDb(): Promise<void> {
    const name = prompt('Enter a name for this template:', this.templateService.templateValue.name || 'New Report');
    if (!name) return;
    
    try {
      await this.templateService.saveTemplateToDb(name);
      alert('Template saved to database successfully!');
      this.router.navigate(['/']);
    } catch (error) {
      alert('Failed to save template');
    }
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  exportTemplate(): void {
    this.templateService.exportTemplate();
  }

  importTemplate(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.templateService.importTemplate(input.files[0])
        .then(() => {
          input.value = ''; // Reset input
          alert('Template imported successfully!');
        })
        .catch(err => alert('Error: ' + err));
    }
  }

  resetTemplate(): void {
    if (confirm('Are you sure you want to reset the template? All unsaved changes will be lost.')) {
      this.templateService.resetTemplate();
    }
  }

  onMouseDownLeft(event: MouseEvent) {
    this.isResizingLeft = true;
    this.setResizingStyle(true);
    event.preventDefault();
  }

  onMouseDownRight(event: MouseEvent) {
    this.isResizingRight = true;
    this.setResizingStyle(true);
    event.preventDefault();
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.isResizingLeft) {
      const newWidth = event.clientX;
      if (newWidth > 150 && newWidth < 600) {
        this.leftWidth.set(newWidth);
      }
    } else if (this.isResizingRight) {
      const newWidth = window.innerWidth - event.clientX;
      if (newWidth > 200 && newWidth < 600) {
        this.rightWidth.set(newWidth);
      }
    }
  }

  @HostListener('window:mouseup')
  onMouseUp() {
    this.isResizingLeft = false;
    this.isResizingRight = false;
    this.setResizingStyle(false);
  }

  private setResizingStyle(isResizing: boolean) {
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }
}
