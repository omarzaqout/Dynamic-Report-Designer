import { Component, inject, computed, ChangeDetectionStrategy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateService } from '../../../../core/services/template.service';
import { DataService } from '../../../../core/services/data.service';
import { RenderService, RenderedReport, RenderedSection } from '../../../../core/services/render.service';
import { ReportData } from '../../../../core/models/report.model';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-preview-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-host">
      <div class="preview-toolbar">
        <div class="preview-title">
          <span class="preview-icon">&#9654;</span>
          <span>Live Preview</span>
          <span class="live-badge">LIVE</span>
        </div>
        <div class="preview-stats">
          <span class="stat">{{ dataRows().length }} records</span>
          <span class="stat">{{ renderedSectionCount() }} rendered sections</span>
        </div>
      </div>

      <div class="preview-scroll">
        <div class="preview-page">
          @for (section of renderedReport().sections; track $index) {
            <div
              class="preview-section"
              [class]="'ps-' + section.sectionType"
              [style.min-height.px]="section.height"
            >
              @if (section.elements.length === 0) {
                <div class="empty-section">{{ section.label }} — no content</div>
              } @else {
                <div class="section-body" [style.position]="'relative'" [style.height.px]="section.height">
                  @for (el of section.elements; track el.id) {
                    <div
                      class="preview-el"
                      [style.left.px]="el.x"
                      [style.top.px]="el.y"
                      [style.fontSize.px]="el.style.fontSize"
                      [style.fontWeight]="el.style.fontWeight"
                      [style.fontStyle]="el.style.fontStyle"
                      [style.textDecoration]="el.style.textDecoration"
                      [style.color]="el.style.color"
                      [class.is-image]="el.type === 'image'"
                    >
                      @if (el.type === 'image') {
                        @if (el.imageUrl) {
                          <img [src]="el.imageUrl" [style.display]="'block'" [style.maxWidth.px]="250" [style.maxHeight.px]="250" />
                        }
                      } @else {
                        {{ el.content }}
                      }
                    </div>
                  }
                </div>
              }
            </div>
            @if (section.isDetail && !isLastDetail($index)) {
              <div class="row-divider"></div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .preview-host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #f8fafc;
      overflow: hidden;
    }
    .preview-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      min-height: 42px;
    }
    .preview-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }
    .preview-icon { color: #10b981; }
    .live-badge {
      font-size: 9px;
      font-weight: 700;
      background: #d1fae5;
      color: #059669;
      padding: 2px 6px;
      border-radius: 10px;
      letter-spacing: 0.5px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    .preview-stats { display: flex; gap: 12px; }
    .stat { font-size: 11px; color: #94a3b8; }
    .preview-scroll {
      flex: 1;
      overflow: auto;
      padding: 20px;
    }
    .preview-scroll::-webkit-scrollbar { width: 8px; }
    .preview-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .preview-page {
      width: 794px;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    .preview-section {
      border-bottom: 1px solid #f1f5f9;
      position: relative;
    }
    .ps-reportHeader { background: #fffef7; border-left: 3px solid #f59e0b; }
    .ps-pageHeader { background: #f8fbff; border-left: 3px solid #3b82f6; }
    .ps-details { background: #fff; border-left: 3px solid #e2e8f0; }
    .ps-footer { background: #fafafa; border-left: 3px solid #8b5cf6; }
    .section-body { position: relative; overflow: hidden; }
    .preview-el { position: absolute; white-space: nowrap; line-height: 1.4; }
    .empty-section {
      padding: 12px 16px;
      font-size: 11px;
      color: #cbd5e1;
      font-style: italic;
    }
    .row-divider { height: 1px; background: #f1f5f9; }
  `],
})
export class PreviewPanelComponent implements OnInit {
  private templateService = inject(TemplateService);
  private dataService = inject(DataService);
  private renderService = inject(RenderService);

  readonly dataRows = toSignal(this.dataService.data$, { initialValue: [] as ReportData[] });

  readonly renderedReport = computed<RenderedReport>(() => {
    const template = this.templateService.template();
    const data = this.dataRows();
    return this.renderService.renderReport(data, template);
  });

  readonly renderedSectionCount = computed(() => this.renderedReport().sections.length);

  ngOnInit(): void {}

  isLastDetail(index: number): boolean {
    const sections = this.renderedReport().sections;
    const remaining = sections.slice(index + 1);
    return !remaining.some((s) => s.isDetail);
  }
}
