import { Component, ChangeDetectionStrategy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeftPanelComponent } from './components/left-panel/left-panel.component';
import { CanvasComponent } from './components/canvas/canvas.component';
import { RightPanelComponent } from './components/right-panel/right-panel.component';
import { PreviewPanelComponent } from './components/preview-panel/preview-panel.component';
import { UiService } from '../../core/services/ui.service';

@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [CommonModule, LeftPanelComponent, CanvasComponent, RightPanelComponent, PreviewPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './designer.component.html',
  styleUrl: './designer.component.css',
})
export class DesignerComponent {
  private uiService = inject(UiService);
  readonly activeView = this.uiService.activeView;

  // Sidebar widths
  readonly leftWidth = signal(240);
  readonly rightWidth = signal(280);

  private isResizingLeft = false;
  private isResizingRight = false;

  setView(view: 'design' | 'preview'): void {
    this.uiService.setView(view);
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
