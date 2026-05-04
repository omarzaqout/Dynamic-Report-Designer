import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface Report {
  id: string;
  name: string;
  type?: string;
  createdAt: string;
}

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.css'
})
export class TemplatesComponent implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);
  
  templates$: Observable<Report[]> | undefined;

  ngOnInit(): void {
    this.templates$ = this.http.get<Report[]>('http://localhost:3000/reports');
  }

  createNewTemplate(): void {
    this.router.navigate(['/designer']);
  }

  editTemplate(id: string): void {
    this.router.navigate(['/designer', id]);
  }

  testPrint(): void {
    // Sample docentry and stageId
    const docentry = '1478';
    const stageId = '3';
    window.open(`http://localhost:3000/reports/print/${docentry}/${stageId}`, '_blank');
  }
}
