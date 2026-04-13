import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ReportData } from '../models/report.model';
import { Field } from '../models/field.model';



@Injectable({ providedIn: 'root' })
export class DataService {
  private dataSubject = new BehaviorSubject<ReportData[]>([]);

  data$: Observable<ReportData[]> = this.dataSubject.asObservable();

  async getData(endpoint: string): Promise<ReportData[]> {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const res = await response.json();
    const data = this.normalizeResponse(res);
    this.dataSubject.next(data);
    return data;
  }

  private normalizeResponse(res: any): ReportData[] {
    const data = res.data || res.users || res.items || res;
    return Array.isArray(data) ? data : data ? [data] : [];
  }

  getFields(sampleData?: any): Field[] {
    const sample = sampleData || this.dataSubject.value[0];
    if (!sample) return [];
    return this.generateFieldsTree(sample);
  }

  private generateFieldsTree(sample: any, prefix = ''): Field[] {
    if (!sample || typeof sample !== 'object') return [];
    return Object.keys(sample).map(key => {
      const value = sample[key];
      const path = prefix ? `${prefix}.${key}` : key;
      const type = this.inferType(value);
      
      const field: Field = {
        key: path,
        label: this.formatLabel(key),
        path: path,
        type: type as any,
        isExpanded: true
      };

      if (type === 'object' && value !== null && !Array.isArray(value)) {
        field.children = this.generateFieldsTree(value, path);
      }
      return field;
    });
  }

  private formatLabel(key: string): string {
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  }

  private inferType(value: unknown): string {
    if (Array.isArray(value)) return 'array';
    if (value !== null && typeof value === 'object') return 'object';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    return 'text';
  }
}
