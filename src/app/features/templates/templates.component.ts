import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../../core/config/api.config';

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
  
  templates = signal<Report[]>([]);
  isLoading = signal(true);

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.isLoading.set(true);
    this.http.get<Report[]>(`${API_CONFIG.reportApiBaseUrl}/reports`).subscribe({
      next: (data) => {
        this.templates.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.templates.set([]);
        this.isLoading.set(false);
      }
    });
  }

  createNewTemplate(): void {
    this.router.navigate(['/designer']);
  }

  editTemplate(id: string): void {
    this.router.navigate(['/designer', id]);
  }

  testPrint(id: string): void {
    const docentry = '1478';
    const stageId = '3';
    window.open(`${API_CONFIG.reportApiBaseUrl}/reports/print/${id}/${docentry}/${stageId}`, '_blank');
  }

  deleteTemplate(id: string): void {
    if (confirm('Are you sure you want to delete this template?')) {
      // Optimistic update: remove from UI immediately
      const currentTemplates = this.templates();
      this.templates.set(currentTemplates.filter(t => t.id !== id));

      this.http.delete(`${API_CONFIG.reportApiBaseUrl}/reports/${id}`).subscribe({
        error: (err) => {
          alert('Failed to delete template');
          console.error(err);
          // Revert if failed
          this.loadTemplates();
        }
      });
    }
  }
}
