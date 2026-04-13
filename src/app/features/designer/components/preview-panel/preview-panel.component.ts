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
}
