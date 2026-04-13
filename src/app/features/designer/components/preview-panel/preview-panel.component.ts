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
    return this.renderService.renderReport(data, template);
  });

  readonly renderedSectionCount = computed(() => this.renderedReport().sections.length);

  ngOnInit(): void {}

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
    let maxContentY = 0;
    for (const el of section.elements) {
      let elHeight = 30;
      if (el.type === 'table' && el.table) {
        elHeight = this.tableHeight(el.table);
      } else if (el.type === 'image' && el.size) {
        elHeight = el.size.height;
      } else if (el.style) {
        elHeight = Math.max(30, el.style.fontSize * 1.5);
      }
      const bottomY = el.y + elHeight;
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
}
