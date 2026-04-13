import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiService {
  readonly activeView = signal<'design' | 'preview'>('design');

  setView(view: 'design' | 'preview'): void {
    this.activeView.set(view);
  }
}
