import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ReportData } from '../models/report.model';
import { Field } from '../models/field.model';

const MOCK_DATA: ReportData[] = [
  { name: 'Omar', age: 25, city: 'Ramallah', department: 'Engineering', salary: 5500, joinDate: '2021-03-15' },
  { name: 'Ali', age: 30, city: 'Nablus', department: 'Marketing', salary: 4800, joinDate: '2019-07-22' },
  { name: 'Sara', age: 27, city: 'Hebron', department: 'Engineering', salary: 6200, joinDate: '2020-11-01' },
  { name: 'Rania', age: 32, city: 'Ramallah', department: 'HR', salary: 4200, joinDate: '2018-05-10' },
  { name: 'Khalid', age: 28, city: 'Jenin', department: 'Finance', salary: 5100, joinDate: '2022-01-08' },
];

@Injectable({ providedIn: 'root' })
export class DataService {
  private dataSubject = new BehaviorSubject<ReportData[]>(MOCK_DATA);

  data$: Observable<ReportData[]> = this.dataSubject.asObservable();

  getFields(): Field[] {
    const sample = MOCK_DATA[0];
    return Object.keys(sample).map((key) => ({
      key,
      label: this.formatLabel(key),
      type: this.inferType(sample[key]),
    }));
  }

  private formatLabel(key: string): string {
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
  }

  private inferType(value: unknown): 'text' | 'number' | 'date' {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    return 'text';
  }
}
