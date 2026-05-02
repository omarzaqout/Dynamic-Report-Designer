import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateService } from '../../../../core/services/template.service';
import { RenderService, RenderedSection } from '../../../../core/services/render.service';
import { TableData } from '../../../../core/models/template.model';
import { DataService } from '../../../../core/services/data.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-preview-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preview-panel.component.html',
  styleUrl: './preview-panel.component.css',
})
export class PreviewPanelComponent {
  private templateService = inject(TemplateService);
  private renderService = inject(RenderService);
  private dataService = inject(DataService);

  readonly template = this.templateService.template;
  readonly dataRows = toSignal(this.dataService.data$, { initialValue: [] });

  readonly renderedReport = computed(() => {
    const template = this.templateService.template();
    const data = this.dataRows();
    return this.renderService.renderReport(data, template, data);
  });

  readonly renderedSectionCount = computed(() => this.renderedReport().sections.length);

  readonly repeatingSections = computed(() => {
    return this.renderedReport().sections.filter((s: any) => s.sectionType === 'pageHeader' && s.templateSection?.repeatOnEveryPage);
  });

  readonly repeatingFooters = computed(() => {
    return this.renderedReport().sections.filter((s: any) => s.sectionType === 'footer' && s.templateSection?.repeatOnEveryPage);
  });

  readonly mainSections = computed(() => {
    return this.renderedReport().sections.filter((s: any) => {
      const isRepeatingHeader = s.sectionType === 'pageHeader' && s.templateSection?.repeatOnEveryPage;
      const isRepeatingFooter = s.sectionType === 'footer' && s.templateSection?.repeatOnEveryPage;
      return !isRepeatingHeader && !isRepeatingFooter;
    });
  });

  getBands(section: RenderedSection): any[] {
    const offsetElements = this.getElementsWithOffsets(section);
    if (offsetElements.length === 0) return [];

    const sorted = [...offsetElements].sort((a, b) => a.renderedY - b.renderedY);
    const bands: any[] = [];
    
    for (const el of sorted) {
      const elTop = el.renderedY;
      const elHeight = this.getElementActualHeight(el);
      const elBottom = elTop + elHeight;

      if (bands.length > 0) {
        const lastBand = bands[bands.length - 1];
        const bTop = lastBand.renderedY;
        const bBottom = lastBand.renderedY + lastBand.height;
        
        if (elTop <= bBottom + 2) {
          lastBand.elements.push(el);
          lastBand.height = Math.max(bBottom, elBottom) - lastBand.renderedY;
          continue;
        }
      }

      bands.push({
        id: el.id,
        renderedY: elTop,
        height: elHeight,
        marginTop: 0,
        elements: [el]
      });
    }

    let currentFlowBottom = 0;
    for (const band of bands) {
      band.marginTop = Math.max(0, band.renderedY - currentFlowBottom);
      currentFlowBottom = band.renderedY + band.height;
    }

    return bands;
  }

  getElementsWithOffsets(section: RenderedSection): any[] {
    const sorted = [...section.elements].sort((a, b) => a.y - b.y);
    const result: any[] = [];
    
    let currentFlowBottom = 0;

    for (const el of sorted) {
      const originalHeight = this.getElementOriginalHeight(el, section);
      let currentElOffset = 0;
      // SMART OFFSET (Push & Pull): 
      // Maintains the design's "Visual Proximity" by expanding or shrinking gaps 
      // based on the actual rendered content of elements above.
      for (const processed of result) {
        const actualH = this.getElementActualHeight(processed);
        const origH = processed.originalHeight;

        // If this element was originally positioned below the processed element
        if (processed.y + origH <= el.y + 2) {
          // Add the delta (positive if grew, negative if shrank)
          currentElOffset += (actualH - origH);
        }
      }

      // Final Rendered Y = Original Y + Accumulated Smart Offset
      const renderedY = Math.round(el.y + currentElOffset);
      let printMarginTop = 0;

      if (el.type === 'table') {
        printMarginTop = Math.max(0, renderedY - currentFlowBottom);
        const actualHeight = this.getElementActualHeight(el);
        currentFlowBottom += printMarginTop + actualHeight;
      }

      result.push({ ...el, originalHeight, renderedY, printMarginTop });
    }
    return result;
  }

  private getElementActualHeight(el: any): number {
    if (el.type === 'table' && el.table) {
      // The actual height is the sum of all rows (could be many more than in designer)
      return this.tableHeight(el.table);
    }
    if (el.size?.height) return el.size.height;
    return el.style?.fontSize ? el.style.fontSize * 1.5 : 30;
  }

  /** Height the element was given in the DESIGNER. */
  private getElementOriginalHeight(el: any, section: RenderedSection): number {
    const originalEl = section.templateSection?.elements?.find((e: any) => e.id === el.id);

    // 1. Fallback for tables: visually tables are dictated by their original rows in design
    if (el.type === 'table') {
      if (originalEl?.table) return this.tableHeight(originalEl.table);
      if (el.table) return this.tableHeight(el.table);
    }
    // 2. If it has a size set in the designer, that's our baseline for non-tables
    if (el.size?.height) return el.size.height;

    return el.style?.fontSize ? el.style.fontSize * 1.5 : 30;
  }

  private getSectionMinY(section: RenderedSection): number {
    if (!section.elements || section.elements.length === 0) return 0;
    return Math.min(...section.elements.map((el: any) => el.y));
  }

  getSectionHeight(section: RenderedSection): number {
    const offsetElements = this.getElementsWithOffsets(section);
    let maxContentY = 0;
    for (const el of offsetElements) {
      const elHeight = this.getElementActualHeight(el);
      const bottomY = el.renderedY + elHeight;
      if (bottomY > maxContentY) maxContentY = bottomY;
    }
    return Math.max(section.height, maxContentY);
  }

  print(): void {
    window.print();
  }

  /**
   * For center/right aligned text/field elements, estimate a min-width based on the
   * template placeholder (e.g. {{stageName}}) so the preview box is at least as
   * wide as the designer's box — ensuring text-align works regardless of value length.
   * The result is capped to the available page width to prevent overflowing into neighbors.
   */
  getTextElementMinWidth(el: any, section: RenderedSection): number | null {
    // Only apply to text/field elements that have explicit center or right alignment
    if (el.type === 'table' || el.type === 'image') return null;
    if (!el.style?.textAlign || el.style.textAlign === 'left') return null;

    // If the designer stored an explicit width, use it directly
    if (el.size?.width) return Math.min(el.size.width, 794 - el.x);

    // Find the original template element to read the placeholder content (e.g. {{stageName}})
    const templateEl = section.templateSection?.elements?.find((e: any) => e.id === el.id);
    const placeholder = templateEl?.content || '';
    if (!placeholder) return null;

    // Approximate character width: ~0.6 × fontSize per character (matches most fonts)
    const fontSize = el.style.fontSize || 12;
    const estimated = Math.max(60, placeholder.length * fontSize * 0.6);

    // Cap to available space so we never overflow into adjacent elements
    return Math.min(estimated, 794 - el.x);
  }

  isLastDetail(index: number): boolean {
    const sections = this.renderedReport().sections;
    const remaining = sections.slice(index + 1);
    return !remaining.some((s: any) => s.isDetail);
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
