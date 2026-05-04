import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { TemplateService } from '../../core/services/template.service';
import { DataService } from '../../core/services/data.service';
import { PreviewPanelComponent } from '../designer/components/preview-panel/preview-panel.component';
import { API_CONFIG } from '../../core/config/api.config';


@Component({
  selector: 'app-print',
  standalone: true,
  imports: [CommonModule, PreviewPanelComponent],
  template: `
    <div class="print-wrapper" *ngIf="isLoaded">
      <app-preview-panel></app-preview-panel>
    </div>
    <div *ngIf="!isLoaded" class="loading">
      Preparing report for printing...
    </div>
  `,
  styles: [`
    .print-wrapper { background: white; width: 100%; height: 100%; }
    .loading { padding: 50px; text-align: center; font-family: sans-serif; }
    :host ::ng-deep .preview-container { padding: 0 !important; margin: 0 !important; box-shadow: none !important; }
    :host ::ng-deep .page { margin: 0 !important; border: none !important; box-shadow: none !important; }
  `]
})
export class PrintComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private templateService = inject(TemplateService);
  private dataService = inject(DataService);
  
  isLoaded = false;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const docentry = this.route.snapshot.paramMap.get('docentry');
    const stageId = this.route.snapshot.paramMap.get('stageId');

    console.log('PrintComponent: Initializing with params:', { id, docentry, stageId });

    if (!id || id === 'null' || id === 'undefined') {
      console.error('PrintComponent: No valid template ID provided');
      return;
    }

    try {
      // 1. Load the template (Check for injected template first)
      const injectedTemplate = (window as any).externalReportTemplate;
      
      if (injectedTemplate) {
        console.log('PrintComponent: Using INJECTED template from window.externalReportTemplate');
        this.templateService.currentReportId.set(injectedTemplate.id);
        this.templateService.setTemplate(injectedTemplate.data);
      } else {
        console.log('PrintComponent: No injected template found, loading from DB:', id);
        await this.templateService.loadTemplateFromDb(id);
      }
      console.log('PrintComponent: Template initialization complete');
      
      // 2. Fetch or Inject Data
      const injectedData = (window as any).externalReportData;
      
      if (injectedData) {
        console.log('PrintComponent: Using INJECTED data from window.externalReportData');
        this.dataService.setData(injectedData);
      } else if (docentry && docentry !== '0' && stageId && stageId !== '0') {
        const baseUrl = API_CONFIG.externalApiBaseUrl;
        const apiUrl = `${baseUrl}/api/productionOrder/orderDetail/${docentry}/${stageId}`;
        console.log('PrintComponent: No injected data found, fetching from external API:', apiUrl);
        try {
          await this.dataService.getData(apiUrl);
          console.log('PrintComponent: External data fetched successfully');
        } catch (dataError) {
          console.error('PrintComponent: Failed to fetch external data. Proceeding with empty data.', dataError);
        }
      } else {
        console.warn('PrintComponent: No data source available (no injected data or valid docentry/stageId)');
      }
      
      // Even if data fails, we show the template (isLoaded = true)
      this.isLoaded = true;
      console.log('PrintComponent: Render state set to LOADED');
      
      // We give it 3 seconds to be safe since PreviewPanel has complex layout logic.
      setTimeout(() => {
        console.log('PrintComponent: Setting isReportReady = true');
        (window as any).isReportReady = true;
      }, 3000);

    } catch (error) {
      console.error('PrintComponent: CRITICAL initialization failure', error);
      // We don't set isLoaded to true here so the error is evident (stays in loading or we could show error)
    }
  }

}
