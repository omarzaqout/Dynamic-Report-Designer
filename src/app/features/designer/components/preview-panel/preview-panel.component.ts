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

      if (bands.length > 0) {
        const lastBand = bands[bands.length - 1];
        const bTop = lastBand.renderedY;

        // Only group elements if they start at roughly the same vertical position (Side-by-Side)
        // Sequential elements (one below the other) MUST be in separate bands so that 
        // if the top one grows, it pushes the entire next band down in flow.
        if (Math.abs(elTop - bTop) <= 4) {
          lastBand.elements.push(el);
          lastBand.height = Math.max(lastBand.height, elHeight);
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
      // Update band height based on ACTUAL heights of its elements
      let maxBandActualHeight = band.height;
      for (const el of band.elements) {
        const elActualHeight = this.getElementActualHeight(el);
        const elBottomRelativeToBand = (el.renderedY - band.renderedY) + elActualHeight;
        if (elBottomRelativeToBand > maxBandActualHeight) {
          maxBandActualHeight = elBottomRelativeToBand;
        }
      }
      band.height = maxBandActualHeight;
      
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

  private measureTextHeight(content: string, style: any, width: number, lineHeight: string = '1.4'): number {
    if (!content) return 0;
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.style.width = `${width}px`;
    div.style.fontSize = `${style.fontSize || 12}px`;
    div.style.fontFamily = style.fontFamily || 'inherit';
    div.style.fontWeight = style.fontWeight || 'normal';
    div.style.fontStyle = style.fontStyle || 'normal';
    div.style.lineHeight = lineHeight;
    div.style.whiteSpace = style.whiteSpace || 'normal';
    div.style.wordBreak = style.whiteSpace === 'normal' ? 'break-word' : 'normal';
    div.style.padding = '0';
    div.style.margin = '0';
    div.style.boxSizing = 'border-box';
    div.innerHTML = content;
    document.body.appendChild(div);
    const height = div.offsetHeight;
    document.body.removeChild(div);
    return height > 0 ? height + 2 : 0;
  }

  private getElementActualHeight(el: any): number {
    if (el.type === 'table' && el.table) {
      return this.tableHeight(el.table, true);
    }
    if (el.type === 'image') return el.size?.height || 100;
    const width = el.size?.width || 200;
    const measuredHeight = this.measureTextHeight(el.content || '', el.style || {}, width, '1.4');
    return Math.max(el.size?.height || 0, measuredHeight);
  }

  private getElementOriginalHeight(el: any, section: RenderedSection): number {
    const originalEl = section.templateSection?.elements?.find((e: any) => e.id === el.id);
    if (el.type === 'table') {
      if (originalEl?.table) return this.tableHeight(originalEl.table, false);
      if (el.table) return this.tableHeight(el.table, false);
    }
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

  rowHeight(table: TableData, rowIndex: number, dynamic: boolean = true): number {
    const baseHeight = table.rowHeights?.[rowIndex] ?? 36;
    if (!dynamic) return baseHeight;

    const rowCells = table.cells[rowIndex] || [];
    let maxHeight = baseHeight;

    for (let i = 0; i < rowCells.length; i++) {
      const cell = rowCells[i];
      // If content exists, we measure it. 
      // We check if whiteSpace is 'normal' (wrapping enabled) or if it's explicitly requested.
      const canWrap = cell.style?.whiteSpace === 'normal';
      
      if (cell.content) {
        const width = this.columnWidth(table, i);
        // Ensure we pass the same whiteSpace as in the HTML template
        const cellStyle = { 
          ...cell.style, 
          whiteSpace: cell.style?.whiteSpace ?? 'normal' 
        };
        
        const measured = this.measureTextHeight(
          cell.content, 
          cellStyle, 
          width, 
          '1.3'
        );
        
        const totalCellHeight = measured + 8;
        if (totalCellHeight > maxHeight) {
          maxHeight = totalCellHeight;
        }
      }
    }

    return Math.round(maxHeight);
  }

  columnWidth(table: TableData, colIndex: number): number {
    return table.columnSettings?.[colIndex]?.width ?? 120;
  }

  tableWidth(table: TableData): number {
    const cols = this.visibleColumnIndexes(table);
    if (cols.length === 0) return 120;
    return cols.reduce((sum, colIndex) => sum + this.columnWidth(table, colIndex), 0);
  }

  tableHeight(table: TableData, dynamic: boolean = true): number {
    if (table.rows === 0) return 36;
    return this.tableRowIndexes(table).reduce((sum, rowIndex) => sum + this.rowHeight(table, rowIndex, dynamic), 0);
  }

  protected encodeURIComponent(str: string): string {
    return encodeURIComponent(str);
  }
}
