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

  getElementsWithOffsets(section: RenderedSection): any[] {
    const sorted = [...section.elements].sort((a, b) => a.y - b.y);
    const result: any[] = [];
    
    let currentFlowBottom = 0;
    const sectionTopY = this.getSectionMinY(section);

    for (const el of sorted) {
      const originalHeight = this.getElementOriginalHeight(el);
      let currentElOffset = 0;
      const relativeY = el.y - sectionTopY;

      for (const processed of result) {
        const actualH = this.getElementActualHeight(processed);
        const origH = processed.originalHeight;

        if (actualH > origH) {
          if (el.y >= processed.y + origH - 2) {
            currentElOffset += (actualH - origH);
          }
        }
      }

      const renderedY = Math.round(relativeY + currentElOffset);
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
      return this.tableHeight(el.table);
    }
    if (el.type === 'image' && el.size) {
      return el.size.height;
    }
    return el.style?.fontSize ? el.style.fontSize * 1.5 : 30;
  }

  private getElementOriginalHeight(el: any): number {
    if (el.size?.height) return el.size.height;
    if (el.type === 'table' && el.table && el.designerRows != null) {
      const designerRowHeights = (el.table.rowHeights as number[]).slice(0, el.designerRows);
      if (designerRowHeights.length > 0) {
        return designerRowHeights.reduce((s, h) => s + h, 0);
      }
    }
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
    return Math.max(section.height, maxContentY + 20);
  }

  print(): void {
    window.print();
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
