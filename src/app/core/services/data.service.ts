import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ReportData } from '../models/report.model';
import { Field } from '../models/field.model';

export interface Dataset {
  name: string;
  path: string;
  sample: any;
  count: number;
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private rawData: any = null;
  readonly rawResponse = signal<any>(null);
  private dataSubject = new BehaviorSubject<ReportData[]>([]);
  readonly datasets = signal<Dataset[]>([]);
  readonly activeDataset = signal<Dataset | null>(null);

  data$: Observable<ReportData[]> = this.dataSubject.asObservable();

  async getData(endpoint: string): Promise<Dataset[]> {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`HTTP error! status: status: ${response.status}`);
    const res = await response.json();
    this.rawData = res;
    this.rawResponse.set(res);
    
    const datasets: Dataset[] = [];
    const isRootArray = Array.isArray(res);
    
    // Add a root dataset option
    datasets.push({
      name: isRootArray ? 'Default (Full Context)' : 'Document Detail (Root)',
      path: '',
      sample: isRootArray ? res[0] : res,
      count: isRootArray ? res.length : 1
    });

    this.findDatasets(res, '', datasets);
    this.datasets.set(datasets);

    // ============================================================
    // 🐛 DEBUG: Print everything loaded from API
    // ============================================================
    console.group('%c📦 DataService.getData() — API Load Debug', 'color:#4CAF50;font-size:14px;font-weight:bold');
    console.log('%c🔵 Raw API Response:', 'color:#2196F3;font-weight:bold', res);
    console.log('%c📂 Datasets found:', 'color:#FF9800;font-weight:bold', datasets.length);
    datasets.forEach((ds, i) => {
      console.group(`%c  [${i}] Dataset: "${ds.name}" | path: "${ds.path}" | count: ${ds.count}`, 'color:#9C27B0');
      console.log('    sample:', ds.sample);
      const fields = this.generateFieldsTree(ds.sample, ds.path.replace(/\[\d+\]/g, '').replace(/^0\.?/, ''));
      console.log('%c    Fields generated:', 'color:#00BCD4;font-weight:bold', fields.length);
      fields.forEach(f => {
        console.log(`      📌 key: "${f.key}" | label: "${f.label}" | type: ${f.type}${f.children?.length ? ` | children: ${f.children.length}` : ''}`);
        if (f.children?.length) {
          f.children.forEach(c => {
            console.log(`          ↳ key: "${c.key}" | label: "${c.label}" | type: ${c.type}`);
          });
        }
      });
      console.groupEnd();
    });
    console.groupEnd();
    // ============================================================

    // Only reset if current selection is invalid
    const current = this.activeDataset();
    const exists = datasets.find(d => d.path === current?.path);
    if (!exists) {
      this.selectDataset(datasets[0]);
    }

    return datasets;
  }

  private findDatasets(obj: any, path = '', datasets: Dataset[] = []): void {
    if (!obj || typeof obj !== 'object' || obj === null) return;

    if (Array.isArray(obj)) {
      if (path) {
        datasets.push({
          name: this.cleanPathForLabel(path),
          path: path,
          sample: obj[0],
          count: obj.length
        });
      }
      if (obj[0] && typeof obj[0] === 'object') {
        // Continue searching inside items, but don't add the [0] index as a separate dataset option
        this.findDatasets(obj[0], path ? `${path}[0]` : '0', datasets);
      }
      return;
    }

    // Only push as a dataset if it's a structural object and NOT a specific index iteration (e.g. [0])
    if (path && !path.endsWith(']')) {
      datasets.push({
        name: this.cleanPathForLabel(path),
        path: path,
        sample: obj,
        count: 1
      });
    }

    for (const key in obj) {
      const val = obj[key];
      const newPath = path ? `${path}.${key}` : key;
      if (val && typeof val === 'object') {
        this.findDatasets(val, newPath, datasets);
      }
    }
  }

  private cleanPathForLabel(path: string): string {
    // Remove leading '0.' or '[0].' or standalone '0'
    return path.replace(/^0\./, '').replace(/^\[0\]\./, '').replace(/^0$/, 'Item Detail');
  }

  selectDataset(dataset: Dataset) {
    this.activeDataset.set(dataset);
    const data = this.getValueByPath(this.rawData, dataset.path);
    this.dataSubject.next(Array.isArray(data) ? data : [data]);
  }

  private getValueByPath(obj: any, path: string) {
    if (!path) return obj;
    // Replace [index] with .index to unify splitting
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    const parts = normalizedPath.split('.').filter(p => p);
    
    return parts.reduce((acc, key) => {
      if (acc === undefined || acc === null) return undefined;
      
      if (Array.isArray(acc)) {
        if (key === '0') return acc;
        if (!isNaN(Number(key))) return acc[Number(key)];
        
        const plucked: any[] = [];
        for (const item of acc) {
          const val = item?.[key];
          if (val !== undefined) {
            if (Array.isArray(val)) {
              plucked.push(...val);
            } else {
              plucked.push(val);
            }
          }
        }
        return plucked.length > 0 ? plucked : undefined;
      }
      
      return acc[key];
    }, obj);
  }

  getFields(sampleData?: any): Field[] {
    const sample = sampleData || this.activeDataset()?.sample || (Array.isArray(this.rawData) ? this.rawData[0] : this.rawData);
    if (!sample) return [];
    return this.generateFieldsTree(sample);
  }

  getFieldsForPath(path: string): Field[] {
    const data = this.getValueByPath(this.rawData, path);
    const sample = Array.isArray(data) ? data[0] : data;
    if (!sample) return [];
    
    // Use the path as prefix, but clean it from array notation for user expressions
    const cleanedPrefix = path.replace(/\[\d+\]/g, '').replace(/^0\.?/, '');
    return this.generateFieldsTree(sample, cleanedPrefix);
  }

  private generateFieldsTree(sample: any, prefix = '', parentLabel = ''): Field[] {
    if (!sample || typeof sample !== 'object') return [];
    
    const fields: Field[] = [];
    Object.keys(sample).forEach(key => {
      const value = sample[key];
      const newPath = prefix ? `${prefix}.${key}` : key;
      const label = this.formatLabel(key);
      const type = this.inferType(value);
      const fullLabel = parentLabel ? `${parentLabel} » ${label}` : label;
      
      const field: Field = {
        key: newPath,
        label: label,
        path: newPath,
        type: type as any,
        isExpanded: false,
        fullLabel: fullLabel
      };

      if (type === 'object' && value !== null && !Array.isArray(value)) {
        field.children = this.generateFieldsTree(value, newPath, fullLabel);
      } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        // Recurse into array item to show its fields
        field.children = this.generateFieldsTree(value[0], newPath, fullLabel);
      }
      
      fields.push(field);
    });
    return fields;
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
