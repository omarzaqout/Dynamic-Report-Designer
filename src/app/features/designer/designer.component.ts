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
  template: `
    <div class="designer-host">
      <header class="designer-header">
        <div class="header-brand">
          <div class="brand-logo">&#9638;</div>
          <div class="brand-text">
            <span class="brand-name">Dynamic Report Designer</span>
            <span class="brand-sub">Template Engine</span>
          </div>
        </div>

        <nav class="header-nav">
          <button
            class="nav-btn"
            [class.active]="activeView() === 'design'"
            (click)="setView('design')"
          >
            <span>&#9998;</span> Design
          </button>
          <button
            class="nav-btn"
            [class.active]="activeView() === 'preview'"
            (click)="setView('preview')"
          >
            <span>&#9654;</span> Preview
          </button>
        </nav>

        <div class="header-actions">
          <div class="status-indicator">
            <span class="status-dot"></span>
            <span class="status-text">Auto-saved</span>
          </div>
          <button class="action-btn secondary" (click)="setView('preview')">
            Preview Report
          </button>
        </div>
      </header>

      <div class="designer-body">
        @if (activeView() === 'design') {
          <aside class="left-sidebar">
            <app-left-panel />
          </aside>

          <main class="canvas-area">
            <app-canvas />
          </main>

          <aside class="right-sidebar">
            <app-right-panel />
          </aside>
        }

        @if (activeView() === 'preview') {
          <div class="preview-full">
            <app-preview-panel />
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .designer-host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .designer-header {
      display: flex;
      align-items: center;
      padding: 0 20px;
      height: 54px;
      background: #0f172a;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      gap: 24px;
      flex-shrink: 0;
      z-index: 100;
    }
    .header-brand { display: flex; align-items: center; gap: 10px; }
    .brand-logo {
      width: 32px; height: 32px; background: #2563eb; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 16px;
    }
    .brand-name { display: block; font-size: 13px; font-weight: 700; color: #f1f5f9; letter-spacing: 0.2px; }
    .brand-sub { display: block; font-size: 10px; color: #475569; letter-spacing: 0.5px; text-transform: uppercase; }
    .header-nav { display: flex; gap: 4px; }
    .nav-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 14px; background: transparent; border: none;
      border-radius: 6px; color: #64748b; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all 0.15s;
    }
    .nav-btn:hover { background: rgba(255,255,255,0.05); color: #94a3b8; }
    .nav-btn.active { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .header-actions { margin-left: auto; display: flex; align-items: center; gap: 12px; }
    .status-indicator { display: flex; align-items: center; gap: 6px; }
    .status-dot { width: 7px; height: 7px; background: #10b981; border-radius: 50%; animation: blink 3s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    .status-text { font-size: 11px; color: #475569; }
    .action-btn {
      padding: 7px 16px; border-radius: 6px; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: all 0.15s; border: none;
    }
    .action-btn.secondary { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .action-btn.secondary:hover { background: rgba(59,130,246,0.25); }
    .designer-body {
      flex: 1;
      display: flex;
      overflow: hidden;
    }
    .left-sidebar {
      width: 240px;
      flex-shrink: 0;
      overflow: hidden;
      border-right: 1px solid rgba(255,255,255,0.05);
    }
    .canvas-area {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .right-sidebar {
      width: 260px;
      flex-shrink: 0;
      overflow: hidden;
    }
    .preview-full {
      flex: 1;
      overflow: hidden;
    }
  `],
})
export class DesignerComponent {
  readonly activeView = signal<ActiveView>('design');

  setView(view: ActiveView): void {
    this.activeView.set(view);
  }
}
