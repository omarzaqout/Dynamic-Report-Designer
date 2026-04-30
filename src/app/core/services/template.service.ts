import { Injectable, signal, computed } from '@angular/core';
import { ReportTemplate, TemplateSection, TemplateElement, TableData, SectionType, ElementStyle } from '../models/template.model';
import { ReportData } from '../models/report.model';

@Injectable({
  providedIn: 'root',
})
export class TemplateService {
  private readonly STORAGE_KEY = 'alfa_report_template_draft';
  
  private _template = signal<ReportTemplate>({
    id: 'template-1',
    name: 'New Report',
    sections: [
      { id: 'sh-1', type: 'reportHeader', label: 'Report Header', height: 40, repeatPerRow: false, elements: [] },
      { id: 'ph-1', type: 'pageHeader', label: 'Page Header', height: 30, repeatPerRow: false, elements: [] },
      { id: 'det-1', type: 'details', label: 'Details', height: 40, repeatPerRow: true, elements: [] },
      { id: 'ft-1', type: 'footer', label: 'Page Footer', height: 30, repeatPerRow: false, repeatOnEveryPage: true, elements: [] }
    ],
  });

  readonly template = computed(() => this._template());
  readonly selectedElementIds = signal<string[]>([]);
  readonly focusedTableCell = signal<{ elementId: string; row: number; col: number } | null>(null);

  // Aliases for compatibility
  readonly selectedElementId = computed(() => {
    const ids = this.selectedElementIds();
    return ids.length === 1 ? ids[0] : null;
  });

  readonly selectedElement = computed(() => {
    const id = this.selectedElementId();
    if (!id) return null;
    for (const s of this._template().sections) {
      const el = s.elements.find((e) => e.id === id);
      if (el) return el;
    }
    return null;
  });

  readonly selectedElementSection = computed(() => {
    const id = this.selectedElementId();
    if (!id) return null;
    for (const s of this._template().sections) {
      if (s.elements.some((e) => e.id === id)) return s;
    }
    return null;
  });

  private history: ReportTemplate[] = [];
  private historyIndex = -1;
  private clipboard: TemplateElement[] = [];

  constructor() {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage(): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this._template.set(parsed);
      } catch (e) {
        console.error('Failed to load saved template draft', e);
      }
    }
  }

  private persistToLocalStorage(t: ReportTemplate): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(t));
  }

  get templateValue(): ReportTemplate {
    return this._template();
  }

  setTemplate(template: ReportTemplate): void {
    this._template.set(template);
    this.persistToLocalStorage(template);
    this.pushToHistory();
  }

  // --- SELECTION ---
  selectElement(id: string | null, isMulti = false): void {
    if (!id) {
      this.selectedElementIds.set([]);
      this.focusedTableCell.set(null);
      return;
    }

    if (isMulti) {
      const current = this.selectedElementIds();
      if (current.includes(id)) {
        this.selectedElementIds.set(current.filter(i => i !== id));
      } else {
        this.selectedElementIds.set([...current, id]);
      }
    } else {
      this.selectedElementIds.set([id]);
    }
    this.focusedTableCell.set(null);
  }

  selectElements(ids: string[], isMulti = false): void {
    if (isMulti) {
      const current = this.selectedElementIds();
      const combined = Array.from(new Set([...current, ...ids]));
      this.selectedElementIds.set(combined);
    } else {
      this.selectedElementIds.set(ids);
    }
  }

  // --- ELEMENT MANAGEMENT ---
  addElement(sectionId: string, element: Omit<TemplateElement, 'id'>): void {
    const newElement: TemplateElement = {
      ...element,
      id: 'el-' + Math.random().toString(36).substring(2, 11),
    };

    this._template.update((t: ReportTemplate) => {
      const updated = {
        ...t,
        sections: t.sections.map((s: TemplateSection) => 
          s.id === sectionId ? { ...s, elements: [...s.elements, newElement] } : s
        )
      };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
    this.selectElement(newElement.id);
  }

  removeElement(elementId: string): void {
    this._template.update((t: ReportTemplate) => {
      const updated = {
        ...t,
        sections: t.sections.map((s: TemplateSection) => ({
          ...s,
          elements: s.elements.filter((el: TemplateElement) => el.id !== elementId),
        })),
      };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
  }

  updateElement(id: string, partial: Partial<TemplateElement>): void {
    this._template.update((t: ReportTemplate) => {
      const updated = {
        ...t,
        sections: t.sections.map((s: TemplateSection) => ({
          ...s,
          elements: s.elements.map((el: TemplateElement) =>
            el.id === id ? { ...el, ...partial } : el
          ),
        })),
      };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
  }

  updateStylesBulk(ids: string[], patch: Partial<ElementStyle>): void {
    this._template.update((t: ReportTemplate) => {
      const updated = {
        ...t,
        sections: t.sections.map((s: TemplateSection) => ({
          ...s,
          elements: s.elements.map((el: TemplateElement) =>
            ids.includes(el.id) ? { ...el, style: { ...el.style, ...patch } } : el
          ),
        })),
      };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
  }

  getElementById(id: string): TemplateElement | null {
    for (const s of this._template().sections) {
      const el = s.elements.find(e => e.id === id);
      if (el) return el;
    }
    return null;
  }

  moveSelectedElements(dx: number, dy: number): void {
    const ids = this.selectedElementIds();
    if (ids.length === 0) return;

    this._template.update((t) => {
      const updated = {
        ...t,
        sections: t.sections.map((s: TemplateSection) => ({
          ...s,
          elements: s.elements.map((el: TemplateElement) => {
            if (ids.includes(el.id)) {
              return { ...el, position: { x: el.position.x + dx, y: el.position.y + dy } };
            }
            return el;
          })
        }))
      };
      this.persistToLocalStorage(updated);
      return updated;
    });
  }

  deleteSelectedElements(): void {
    const ids = this.selectedElementIds();
    if (ids.length === 0) return;

    this._template.update((t) => {
      const updated = {
        ...t,
        sections: t.sections.map((s: TemplateSection) => ({
          ...s,
          elements: s.elements.filter((el: TemplateElement) => !ids.includes(el.id)),
        })),
      };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.selectedElementIds.set([]);
    this.pushToHistory();
  }

  duplicateSelectedElements(): void {
    const ids = this.selectedElementIds();
    if (ids.length === 0) return;

    this._template.update((t) => {
      let newSelection: string[] = [];
      const updatedSections = t.sections.map((s: TemplateSection) => {
        const toDup = s.elements.filter(el => ids.includes(el.id));
        if (toDup.length === 0) return s;

        const newEls = toDup.map(el => {
          const newId = 'el-' + Math.random().toString(36).substring(2, 11);
          newSelection.push(newId);
          return {
            ...JSON.parse(JSON.stringify(el)),
            id: newId,
            position: { x: el.position.x + 20, y: el.position.y + 20 }
          };
        });
        return { ...s, elements: [...s.elements, ...newEls] };
      });

      const updated = { ...t, sections: updatedSections };
      this.persistToLocalStorage(updated);
      setTimeout(() => this.selectedElementIds.set(newSelection));
      return updated;
    });
    this.pushToHistory();
  }

  // --- SECTION MANAGEMENT ---
  addSection(type: SectionType): void {
    const newSection: TemplateSection = {
      id: 'section-' + Math.random().toString(36).substring(2, 11),
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      height: 40,
      repeatPerRow: type === 'details',
      elements: [],
    };
    this._template.update((t) => {
      const order: Record<string, number> = { reportHeader: 1, pageHeader: 2, details: 3, footer: 4 };
      const newSections = [...t.sections, newSection].sort((a, b) => (order[a.type] || 99) - (order[b.type] || 99));
      const updated = { ...t, sections: newSections };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
  }

  removeSection(id: string): void {
    this._template.update((t) => {
      const updated = { ...t, sections: t.sections.filter(s => s.id !== id) };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
  }

  updateSectionHeight(sectionId: string, height: number): void {
    this._template.update((t) => {
      const updated = { ...t, sections: t.sections.map(s => s.id === sectionId ? { ...s, height } : s) };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
  }

  updateSectionDataset(sectionId: string, datasetPath: string): void {
    this._template.update((t) => {
      const updated = { ...t, sections: t.sections.map(s => s.id === sectionId ? { ...s, datasetPath } : s) };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
  }

  updateSectionRepeat(sectionId: string, repeat: boolean): void {
    this._template.update((t) => {
      const updated = { ...t, sections: t.sections.map(s => s.id === sectionId ? { ...s, repeatPerRow: repeat } : s) };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
  }

  updateSectionRepeatOnPage(sectionId: string, repeat: boolean): void {
    this._template.update((t) => {
      const updated = { ...t, sections: t.sections.map(s => s.id === sectionId ? { ...s, repeatOnEveryPage: repeat } : s) };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
  }

  // --- CLIPBOARD ---
  copySelectedElements(): void {
    const ids = this.selectedElementIds();
    const els: TemplateElement[] = [];
    this._template().sections.forEach(s => {
      s.elements.forEach(el => {
        if (ids.includes(el.id)) els.push(JSON.parse(JSON.stringify(el)));
      });
    });
    this.clipboard = els;
  }

  pasteElements(): void {
    if (this.clipboard.length === 0) return;
    const targetSection = this._template().sections.find(s => s.type === 'details') || this._template().sections[0];
    if (!targetSection) return;

    this._template.update((t) => {
      const newSelection: string[] = [];
      const newEls = this.clipboard.map(el => {
        const newId = 'el-' + Math.random().toString(36).substring(2, 11);
        newSelection.push(newId);
        return { ...el, id: newId, position: { x: el.position.x + 10, y: el.position.y + 10 } };
      });

      const updated = {
        ...t,
        sections: t.sections.map(s => s.id === targetSection.id ? { ...s, elements: [...s.elements, ...newEls] } : s)
      };
      this.persistToLocalStorage(updated);
      setTimeout(() => this.selectedElementIds.set(newSelection));
      return updated;
    });
    this.pushToHistory();
  }

  setFocusedTableCell(elementId: string, row: number, col: number): void {
    if (elementId === '' || row === -1) {
      this.focusedTableCell.set(null);
    } else {
      this.focusedTableCell.set({ elementId, row, col });
    }
  }

  // --- TABLE HELPERS ---
  updateTableCell(elementId: string, row: number, col: number, data: any): void {
    this._template.update((t) => {
      const updated = {
        ...t,
        sections: t.sections.map(s => ({
          ...s,
          elements: s.elements.map(el => {
            if (el.id === elementId && el.table) {
              const cells = el.table.cells.map((r: any, ri: number) => 
                ri === row ? r.map((c: any, ci: number) => ci === col ? { ...c, ...data } : c) : r
              );
              return { ...el, table: { ...el.table, cells } };
            }
            return el;
          })
        }))
      };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
  }

  updateElementPosition(id: string, x: number, y: number): void {
    this.updateElement(id, { position: { x, y } });
  }

  // --- HISTORY & PERSISTENCE ---
  pushToHistory(): void {
    const current = JSON.parse(JSON.stringify(this._template()));
    if (this.historyIndex < this.history.length - 1) this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(current);
    if (this.history.length > 50) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  undo(): void {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this._template.set(JSON.parse(JSON.stringify(this.history[this.historyIndex])));
    }
  }

  redo(): void {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this._template.set(JSON.parse(JSON.stringify(this.history[this.historyIndex])));
    }
  }

  exportTemplate(): void {
    const blob = new Blob([JSON.stringify(this._template(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `template-${Date.now()}.json`;
    link.click();
  }

  exportAsJson(): void { this.exportTemplate(); }

  importTemplate(file: File): Promise<void> {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = JSON.parse(e.target?.result as string);
          this.setTemplate(content);
          res();
        } catch (err) { rej('Invalid JSON'); }
      };
      reader.readAsText(file);
    });
  }

  resetTemplate(): void {
    this.setTemplate({
      id: 'template-' + Date.now(),
      name: 'New Report',
      sections: [
        { id: 'sh-1', type: 'reportHeader', label: 'Report Header', height: 40, repeatPerRow: false, elements: [] },
        { id: 'ph-1', type: 'pageHeader', label: 'Page Header', height: 30, repeatPerRow: false, elements: [] },
        { id: 'det-1', type: 'details', label: 'Details', height: 40, repeatPerRow: true, elements: [] },
        { id: 'ft-1', type: 'footer', label: 'Page Footer', height: 30, repeatPerRow: false, repeatOnEveryPage: true, elements: [] }
      ]
    });
  }

  updateTemplateMargin(margin: { top: number; right: number; bottom: number; left: number }): void {
    this._template.update(t => {
      const updated = { ...t, margin };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
  }

  updateDataSourceUrl(url: string): void {
    this._template.update(t => {
      const updated = { ...t, dataSourceUrl: url };
      this.persistToLocalStorage(updated);
      return updated;
    });
    this.pushToHistory();
  }
}
