import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/templates/templates.component').then(m => m.TemplatesComponent),
  },
  {
    path: 'designer',
    loadComponent: () => import('./features/designer/designer.component').then(m => m.DesignerComponent),
  },
  {
    path: 'designer/:id',
    loadComponent: () => import('./features/designer/designer.component').then(m => m.DesignerComponent),
  }
];
