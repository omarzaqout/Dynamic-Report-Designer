import { Injectable, signal, computed } from '@angular/core';
import { ReportTemplate, TemplateSection, TemplateElement, SectionType, DEFAULT_STYLE } from '../models/template.model';

const INITIAL_TEMPLATE: ReportTemplate = {
  id: 'report-1',
  name: 'Employee Report',
  sections: [
    {
      id: 'section-reportHeader-1',
      type: 'reportHeader',
      label: 'Report Header',
      height: 80,
      repeatPerRow: false,
      elements: [
        {
          id: 'el-title',
          type: 'text',
          content: 'Title Report',
          position: { x: 20, y: 20 },
          style: { ...DEFAULT_STYLE, fontSize: 20, fontWeight: 'bold', color: '#1e3a5f' },
        },
      ],
    },
    {
      id: 'section-pageHeader-1',
      type: 'pageHeader',
      label: 'Page Header',
      height: 40,
      repeatPerRow: false,
      elements: [
      ],
    },
    {
      id: 'section-details-1',
      type: 'details',
      label: 'Details',
      height: 36,
      repeatPerRow: true,
      elements: [],
    },
    {
      id: 'section-footer-1',
      type: 'footer',
      label: 'Footer',
      height: 50,
      repeatPerRow: false,
      elements: [
        {
          id: 'el-footer',
          type: 'text',
          content: 'Generated on {{new Date().toLocaleDateString()}} — Total Records: 5',
          position: { x: 20, y: 16 },
          style: { ...DEFAULT_STYLE, fontSize: 10, color: '#888', fontStyle: 'italic' },
        },
      ],
    },
  ],
};

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private _template = signal<ReportTemplate>(structuredClone(INITIAL_TEMPLATE));
  private _selectedElementIds = signal<string[]>([]);
  private _clipboardElements = signal<TemplateElement[]>([]);
  
  private _history: ReportTemplate[] = [];
  private _redoStack: ReportTemplate[] = [];
  private _isHistoryNavigating = false;

  readonly template = this._template.asReadonly();
  readonly selectedElementIds = this._selectedElementIds.asReadonly();

  constructor() {
    this.loadFromStorage();
  }

  readonly selectedElementId = computed(() => {
    const ids = this._selectedElementIds();
    return ids.length === 1 ? ids[0] : null;
  });
  
  readonly selectedElement = computed(() => {
    const id = this.selectedElementId();
    if (!id) return null;
    for (const section of this._template().sections) {
      const el = section.elements.find((e) => e.id === id);
      if (el) return el;
    }
    return null;
  });

  readonly selectedElementSection = computed<SectionType | null>(() => {
    const id = this.selectedElementId();
    if (!id) return null;
    for (const section of this._template().sections) {
      if (section.elements.some((e) => e.id === id)) return section.type;
    }
    return null;
  });

  private pushToHistory(): void {
    if (this._isHistoryNavigating) return;
    const current = structuredClone(this._template());
    this._history.push(current);
    if (this._history.length > 50) this._history.shift();
    this._redoStack = []; 
    this.saveToStorage();
  }

  undo(): void {
    if (this._history.length === 0) return;
    this._isHistoryNavigating = true;
    const currentSnapshot = structuredClone(this._template());
    this._redoStack.push(currentSnapshot);
    const prev = this._history.pop()!;
    this._template.set(prev);
    this._isHistoryNavigating = false;
  }

  redo(): void {
    if (this._redoStack.length === 0) return;
    this._isHistoryNavigating = true;
    const currentSnapshot = structuredClone(this._template());
    this._history.push(currentSnapshot);
    const next = this._redoStack.pop()!;
    this._template.set(next);
    this._isHistoryNavigating = false;
  }

  private saveToStorage(): void {
    localStorage.setItem('report_template_draft', JSON.stringify(this._template()));
  }

  private loadFromStorage(): void {
    const saved = localStorage.getItem('report_template_draft');
    if (saved) {
      try {
        this._template.set(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load template from storage', e);
      }
    }
  }

  exportAsJson(): void {
    const data = JSON.stringify(this._template(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this._template().name || 'report'}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  selectElement(id: string | null, multi: boolean = false): void {
    if (!id) {
      this._selectedElementIds.set([]);
      return;
    }
    this._selectedElementIds.update(ids => {
      if (multi) {
        return ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id];
      }
      return [id];
    });
  }

  selectElements(ids: string[], append: boolean = false): void {
    this._selectedElementIds.update(existing => {
      if (append) {
        const unique = new Set([...existing, ...ids]);
        return Array.from(unique);
      }
      return ids;
    });
  }

  deleteSelectedElements(): void {
    const ids = this._selectedElementIds();
    if (!ids.length) return;
    this.pushToHistory();
    this._template.update((t) => {
      const sections = t.sections.map((s) => ({
        ...s,
        elements: s.elements.filter((el) => !ids.includes(el.id)),
      }));
      return { ...t, sections };
    });
    this._selectedElementIds.set([]);
  }

  copySelectedElements(): void {
    const ids = this._selectedElementIds();
    if (!ids.length) return;
    const copied: TemplateElement[] = [];
    this._template().sections.forEach(s => {
      s.elements.forEach(el => {
        if (ids.includes(el.id)) {
          try {
            copied.push(JSON.parse(JSON.stringify(el)));
          } catch(e) {
            console.error('Failed to copy', e);
          }
        }
      });
    });
    this._clipboardElements.set(copied);
  }

  pasteElements(): void {
    const copied = this._clipboardElements();
    if (!copied.length) return;
    
    let targetSectionId = this._template().sections[0]?.id;
    const ids = this._selectedElementIds();
    if (ids.length > 0) {
      const sec = this._template().sections.find(s => s.elements.some(e => ids.includes(e.id)));
      if (sec) targetSectionId = sec.id;
    }

    if (!targetSectionId) return;

    this.pushToHistory();
    const newIds: string[] = [];
    this._template.update(t => {
      const sections = t.sections.map(s => {
        if (s.id !== targetSectionId) return s;
        const newElements = copied.map(el => {
          const newId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          newIds.push(newId);
          return {
            ...el,
            id: newId,
            position: { x: el.position.x + 20, y: el.position.y + 20 }
          };
        });
        return { ...s, elements: [...s.elements, ...newElements] };
      });
      return { ...t, sections };
    });
    this._selectedElementIds.set(newIds);
  }

  duplicateSelectedElements(): void {
    this.copySelectedElements();
    this.pasteElements();
  }

  addElement(sectionId: string, element: Omit<TemplateElement, 'id'>): void {
    this.pushToHistory();
    const id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) =>
        s.id === sectionId
          ? { ...s, elements: [...s.elements, { ...element, id }] }
          : s
      ),
    }));
    this._selectedElementIds.set([id]);
  }

  updateElement(id: string, patch: Partial<Omit<TemplateElement, 'id'>>): void {
    this.pushToHistory();
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        elements: s.elements.map((el) =>
          el.id === id ? { ...el, ...patch, style: patch.style ? { ...el.style, ...patch.style } : el.style } : el
        ),
      })),
    }));
  }

  updateElementPosition(id: string, x: number, y: number): void {
    const selectedIds = this._selectedElementIds();
    
    if (selectedIds.includes(id) && selectedIds.length > 1) {
      // Logic for group move delta is handled via moveSelectedElements called from component
      this._updateSingleElementPosition(id, x, y);
    } else {
      this._updateSingleElementPosition(id, x, y);
    }
  }

  moveSelectedElements(dx: number, dy: number): void {
    const ids = this._selectedElementIds();
    if (!ids.length) return;
    // We don't push to history on every mouse move frame, maybe on dragEnd?
    // For now we do it here but it will bloat history. 
    // Optimization: only push on dragStart or dragEnd.
    this._template.update(t => {
      const sections = t.sections.map(s => ({
        ...s,
        elements: s.elements.map(el => {
          if (!ids.includes(el.id)) return el;
          return {
            ...el,
            position: {
              x: Math.max(0, el.position.x + dx),
              y: Math.max(0, el.position.y + dy)
            }
          };
        })
      }));
      return { ...t, sections };
    });
  }

  private _updateSingleElementPosition(id: string, x: number, y: number): void {
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        elements: s.elements.map((el) =>
          el.id === id ? { ...el, position: { x: Math.max(0, x), y: Math.max(0, y) } } : el
        ),
      })),
    }));
  }

  removeElement(id: string): void {
    this.pushToHistory();
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        elements: s.elements.filter((el) => el.id !== id),
      })),
    }));
    this._selectedElementIds.update(ids => ids.filter(i => i !== id));
  }

  removeSection(id: string): void {
    this.pushToHistory();
    this._template.update((t) => ({
      ...t,
      sections: t.sections.filter((s) => s.id !== id),
    }));
  }

  updateSectionHeight(sectionId: string, height: number): void {
    this.pushToHistory();
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) =>
        s.id === sectionId ? { ...s, height: Math.max(30, height) } : s
      ),
    }));
  }

  updateSectionRepeat(sectionId: string, repeatPerRow: boolean): void {
    this._template.update(t => ({
      ...t,
      sections: t.sections.map(s => s.id === sectionId ? { ...s, repeatPerRow } : s)
    }));
    this.pushToHistory();
  }

  updateSectionRepeatOnPage(sectionId: string, repeatOnEveryPage: boolean): void {
    this._template.update(t => ({
      ...t,
      sections: t.sections.map(s => s.id === sectionId ? { ...s, repeatOnEveryPage } : s)
    }));
    this.pushToHistory();
  }

  addSection(type: SectionType): void {
    this.pushToHistory();
    const typeCount = this._template().sections.filter((s) => s.type === type).length;
    const index = typeCount + 1;
    const id = `section-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    const labelMap: Record<SectionType, string> = {
      reportHeader: 'Report Header',
      pageHeader: 'Page Header',
      details: 'Details',
      footer: 'Footer'
    };
    
    const baseLabel = labelMap[type];
    const newSection: TemplateSection = {
      id,
      type,
      label: index === 1 ? baseLabel : `${baseLabel} ${index}`,
      height: 80,
      repeatPerRow: type === 'details',
      elements: [],
    };

    this._template.update((t) => {
      const sections = [...t.sections];
      let insertIndex = sections.length;
      
      if (type === 'reportHeader') {
        const lastIdx = sections.map(s => s.type).lastIndexOf('reportHeader');
        insertIndex = lastIdx !== -1 ? lastIdx + 1 : 0;
      } else if (type === 'pageHeader') {
        const lastSame = sections.map(s => s.type).lastIndexOf('pageHeader');
        if (lastSame !== -1) {
          insertIndex = lastSame + 1;
        } else {
          const lastPrev = sections.map(s => s.type).lastIndexOf('reportHeader');
          insertIndex = lastPrev !== -1 ? lastPrev + 1 : 0;
        }
      } else if (type === 'details') {
        const footerIndex = sections.findIndex(s => s.type === 'footer');
        insertIndex = footerIndex !== -1 ? footerIndex : sections.length;
      } else if (type === 'footer') {
        insertIndex = sections.length;
      }
      
      sections.splice(insertIndex, 0, newSection);
      return { ...t, sections };
    });
  }

  resetTemplate(): void {
    this.pushToHistory();
    this._template.set(structuredClone(INITIAL_TEMPLATE));
    this._selectedElementIds.set([]);
  }
}
