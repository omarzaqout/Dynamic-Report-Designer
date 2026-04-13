import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeftPanelComponent } from './components/left-panel/left-panel.component';
import { CanvasComponent } from './components/canvas/canvas.component';
import { RightPanelComponent } from './components/right-panel/right-panel.component';
import { PreviewPanelComponent } from './components/preview-panel/preview-panel.component';

type ActiveView = 'design' | 'preview';

@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [CommonModule, LeftPanelComponent, CanvasComponent, RightPanelComponent, PreviewPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './designer.component.html',
  styleUrl: './designer.component.css',
})
export class DesignerComponent {
  readonly activeView = signal<ActiveView>('design');

  setView(view: ActiveView): void {
    this.activeView.set(view);
  }
}
