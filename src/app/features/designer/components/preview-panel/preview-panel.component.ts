import { Component, inject, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateService } from '../../../../core/services/template.service';
import { DataService } from '../../../../core/services/data.service';
import { RenderService, RenderedReport, RenderedSection } from '../../../../core/services/render.service';
import { ReportData } from '../../../../core/models/report.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { TableData } from '../../../../core/models/template.model';

@Component({
  selector: 'app-preview-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preview-panel.component.html',
  styleUrl: './preview-panel.component.css',
})
export class PreviewPanelComponent implements OnInit {
  private templateService = inject(TemplateService);
  private dataService = inject(DataService);
  private renderService = inject(RenderService);

  readonly dataRows = toSignal(this.dataService.data$, { initialValue: [] as ReportData[] });

  readonly renderedReport = computed<RenderedReport>(() => {
    const template = this.templateService.template();
    const data = this.dataRows();
    const rawData = this.dataService.rawResponse();
    return this.renderService.renderReport(data, template, rawData);
  });

  readonly renderedSectionCount = computed(() => this.renderedReport().sections.length);

  readonly repeatingSections = computed(() => 
    this.renderedReport().sections.filter(s => s.templateSection?.repeatOnEveryPage && s.sectionType !== 'footer')
  );

  readonly repeatingFooters = computed(() => 
    this.renderedReport().sections.filter(s => s.templateSection?.repeatOnEveryPage && s.sectionType === 'footer')
  );

  readonly repeatingSectionsHeight = computed(() => {
    return this.repeatingSections().reduce((sum, s) => sum + this.getSectionHeight(s), 0);
  });

  readonly repeatingFootersHeight = computed(() => {
    return this.repeatingFooters().reduce((sum, s) => sum + this.getSectionHeight(s), 0);
  });

  readonly mainSections = computed(() => 
    this.renderedReport().sections.filter(s => !s.templateSection?.repeatOnEveryPage)
  );

  ngOnInit(): void {}

  /**
   * Calculates dynamic Y offsets for elements to prevent overlapping
   * when tables or images grow beyond their original designer height.
   *
   * BUG FIX: `processed.originalHeight` was always `undefined` before.
   * We now read the original height from `el.size?.height` (set by the designer)
   * or fall back to a font-based estimate.
   */
  getElementsWithOffsets(section: RenderedSection): any[] {
    const sorted = [...section.elements].sort((a, b) => a.y - b.y);
    const result: any[] = [];
    
    // We track the bottom of the last flow element (table) to compute exact margins
    let currentFlowBottom = 0;

    // Calculate section start Y to convert absolute designer Y to relative preview Y
    const sectionTopY = this.getSectionMinY(section);

    for (const el of sorted) {
      // 1. Get relative Y from designer (Absolute Y - Section Start Y)
      const relativeY = Math.round(el.y - sectionTopY);

      // 2. In Preview, we strictly follow the designer's Y.
      // We removed the 'push-down' logic to avoid random offsets and gaps.
      const renderedY = relativeY;
      let printMarginTop = 0;

      // In print mode, tables must be placed in normal document flow to paginate properly.
      // We calculate their margin-top as the distance from the bottom of the previous table.
      if (el.type === 'table') {
        printMarginTop = Math.max(0, renderedY - currentFlowBottom);
        const actualHeight = this.getElementActualHeight(el);
        currentFlowBottom += printMarginTop + actualHeight;
      }

      result.push({ ...el, renderedY, printMarginTop });
    }
    return result;
  }

  /** Height the element occupies in the RENDERED output (after data expansion). */
  private getElementActualHeight(el: any): number {
    if (el.type === 'table' && el.table) {
      return this.tableHeight(el.table);
    }
    if (el.type === 'image' && el.size) {
      return el.size.height;
    }
    return el.style?.fontSize ? el.style.fontSize * 1.5 : 30;
  }

  /** Height the element was given in the DESIGNER (before data expansion). */
  private getElementOriginalHeight(el: any): number {
    // Images carry an explicit designer size
    if (el.size?.height) return el.size.height;

    // Tables: reconstruct the designer height from the ORIGINAL row count
    // using the per-row heights stored in the rendered table.
    // designerRows is the pre-expansion count saved by RenderService.
    if (el.type === 'table' && el.table && el.designerRows != null) {
      const designerRowHeights = (el.table.rowHeights as number[])
        .slice(0, el.designerRows);
      if (designerRowHeights.length > 0) {
        return designerRowHeights.reduce((s: number, h: number) => s + h, 0);
      }
    }

    // Fallback for text/field elements
    return el.style?.fontSize ? el.style.fontSize * 1.5 : 30;
  }

  private getSectionMinY(section: RenderedSection): number {
    if (!section.elements || section.elements.length === 0) return 0;
    return Math.min(...section.elements.map(el => el.y));
  }

  print(): void {
    window.print();
  }


  isLastDetail(index: number): boolean {
    const sections = this.renderedReport().sections;
    const remaining = sections.slice(index + 1);
    return !remaining.some((s) => s.isDetail);
  }

  tableRowIndexes(table: TableData): number[] {
    return Array.from({ length: table.rows }, (_, i) => i);
  }

  visibleColumnIndexes(table: TableData): number[] {
    const settings = table.columnSettings?.length === table.columns
      ? table.columnSettings
      : Array.from({ length: table.columns }, (_v, index) => ({ width: 120, order: index, visible: true }));
    return settings
      .map((setting, index) => ({ index, setting }))
      .filter(({ setting }) => setting.visible)
      .sort((a, b) => a.setting.order - b.setting.order || a.index - b.index)
      .map(({ index }) => index);
  }

  rowHeight(table: TableData, rowIndex: number): number {
    return table.rowHeights?.[rowIndex] ?? 36;
  }

  columnWidth(table: TableData, colIndex: number): number {
    return table.columnSettings?.[colIndex]?.width ?? 120;
  }

  getSectionHeight(section: RenderedSection): number {
    const offsetElements = this.getElementsWithOffsets(section);
    let maxContentY = 0;
    for (const el of offsetElements) {
      const elHeight = this.getElementActualHeight(el);
      const bottomY = el.renderedY + elHeight;
      if (bottomY > maxContentY) maxContentY = bottomY;
    }
    return Math.max(section.height, maxContentY + 20);
  }

  tableWidth(table: TableData): number {
    const cols = this.visibleColumnIndexes(table);
    if (cols.length === 0) return 120;
    return cols.reduce((sum, colIndex) => sum + this.columnWidth(table, colIndex), 0);
  }

  tableHeight(table: TableData): number {
    if (table.rows === 0) return 36;
    return this.tableRowIndexes(table).reduce((sum, rowIndex) => sum + this.rowHeight(table, rowIndex), 0);
  }

  protected encodeURIComponent(str: string): string {
    return encodeURIComponent(str);
  }
}
