import { Injectable, signal, computed, inject } from '@angular/core';
import { ReportTemplate, TemplateSection, TemplateElement, DEFAULT_STYLE, SectionType, TableData } from '../models/template.model';

const INITIAL_TEMPLATE: ReportTemplate = {
  id: 'temp-1',
  name: 'Monthly Employee Report',
  sections: [
    {
      id: 'section-rh-1',
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
      id: 'section-ph-1',
      type: 'pageHeader',
      label: 'Page Header',
      height: 40,
      repeatPerRow: false,
      elements: [],
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
      height: 40,
      repeatPerRow: false,
      elements: [
        {
          id: 'el-f-date',
          type: 'text',
          content: 'Printed on: ' + new Date().toLocaleDateString(),
          position: { x: 20, y: 15 },
          style: { ...DEFAULT_STYLE, fontSize: 10, color: '#999' },
        },
      ],
    },
  ],
};

@Injectable({ providedIn: 'root' })
export class TemplateService {
  private _template = signal<ReportTemplate>(INITIAL_TEMPLATE);
  readonly template = this._template.asReadonly();

  private _selectedElementIds = signal<string[]>([]);
  readonly selectedElementIds = this._selectedElementIds.asReadonly();

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

  readonly selectedElementSection = computed(() => {
    const id = this.selectedElementId();
    if (!id) return null;
    return this._template().sections.find((s) => s.elements.some((e) => e.id === id)) || null;
  });

  private history: string[] = [];
  private historyIndex = -1;
  private readonly STORAGE_KEY = 'report_template_draft';

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        this._template.set(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved template', e);
      }
    }
    this.pushToHistory();
  }

  private pushToHistory(): void {
    const currentState = JSON.stringify(this._template());
    if (this.historyIndex >= 0 && this.history[this.historyIndex] === currentState) return;

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(currentState);
    if (this.history.length > 50) this.history.shift();
    else this.historyIndex++;

    localStorage.setItem(this.STORAGE_KEY, currentState);
  }

  undo(): void {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this._template.set(JSON.parse(this.history[this.historyIndex]));
    }
  }

  redo(): void {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this._template.set(JSON.parse(this.history[this.historyIndex]));
    }
  }

  resetTemplate(): void {
    this._template.set(INITIAL_TEMPLATE);
    this._selectedElementIds.set([]);
    this.pushToHistory();
  }

  exportAsJson(): void {
    const data = JSON.stringify(this._template(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-template-${new Date().getTime()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  selectElement(id: string | null, append = false): void {
    if (!id) {
      this._selectedElementIds.set([]);
      return;
    }
    if (append) {
      const current = this._selectedElementIds();
      if (current.includes(id)) {
        this._selectedElementIds.set(current.filter((i) => i !== id));
      } else {
        this._selectedElementIds.set([...current, id]);
      }
    } else {
      this._selectedElementIds.set([id]);
    }
  }

  selectElements(ids: string[], append = false): void {
    if (append) {
      const current = this._selectedElementIds();
      const next = new Set([...current, ...ids]);
      this._selectedElementIds.set(Array.from(next));
    } else {
      this._selectedElementIds.set(ids);
    }
  }

  deleteSelectedElements(): void {
    const ids = this._selectedElementIds();
    if (ids.length === 0) return;

    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        elements: s.elements.filter((el) => !ids.includes(el.id)),
      })),
    }));
    this._selectedElementIds.set([]);
    this.pushToHistory();
  }

  private clipboard: any[] = [];

  copySelectedElements(): void {
    const ids = this._selectedElementIds();
    if (ids.length === 0) return;

    this.clipboard = [];
    this._template().sections.forEach((s) => {
      s.elements.forEach((el) => {
        if (ids.includes(el.id)) {
          this.clipboard.push({ ...el, sectionId: s.id });
        }
      });
    });
  }

  pasteElements(): void {
    if (this.clipboard.length === 0) return;

    const newIds: string[] = [];
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => {
        const toPaste = this.clipboard.filter((c) => c.sectionId === s.id);
        if (toPaste.length === 0) return s;

        const pasted = toPaste.map((c) => {
          const newId = 'el-' + Math.random().toString(36).substr(2, 9);
          newIds.push(newId);
          return {
            ...c,
            id: newId,
            position: { x: c.position.x + 20, y: c.position.y + 20 },
            sectionId: undefined,
          };
        });

        return { ...s, elements: [...s.elements, ...pasted] };
      }),
    }));

    this._selectedElementIds.set(newIds);
    this.pushToHistory();
  }

  duplicateSelectedElements(): void {
    this.copySelectedElements();
    this.pasteElements();
  }

  addElement(sectionId: string, element: Omit<TemplateElement, 'id'>): void {
    const newElement: TemplateElement = {
      ...element,
      id: 'el-' + Math.random().toString(36).substring(2, 11),
    };

    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) =>
        s.id === sectionId ? { ...s, elements: [...s.elements, newElement] } : s
      ),
    }));
    this.pushToHistory();
    this.selectElement(newElement.id);
  }

  removeElement(elementId: string): void {
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        elements: s.elements.filter((el) => el.id !== elementId),
      })),
    }));
    this.pushToHistory();
  }

  updateElement(id: string, partial: Partial<TemplateElement>): void {
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        elements: s.elements.map((el) =>
          el.id === id ? { ...el, ...partial } : el
        ),
      })),
    }));
    this.pushToHistory();
  }

  updateElementPosition(elementId: string, x: number, y: number): void {
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        elements: s.elements.map((el) =>
          el.id === elementId ? { ...el, position: { x, y } } : el
        ),
      })),
    }));
    // We don't push to history on every move to avoid filling history with drag steps
    // CanvasElement calls pushToHistory on mouseup if needed
  }

  moveSelectedElements(dx: number, dy: number): void {
    const ids = this._selectedElementIds();
    if (ids.length === 0) return;

    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        elements: s.elements.map((el) =>
          ids.includes(el.id)
            ? {
                ...el,
                position: { x: el.position.x + dx, y: el.position.y + dy },
              }
            : el
        ),
      })),
    }));
  }

  updateElementStyle(elementId: string, style: any): void {
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        elements: s.elements.map((el) =>
          el.id === elementId ? { ...el, style: { ...el.style, ...style } } : el
        ),
      })),
    }));
    this.pushToHistory();
  }

  updateElementSize(elementId: string, width: number, height: number): void {
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        elements: s.elements.map((el) =>
          el.id === elementId ? { ...el, size: { width, height } } : el
        ),
      })),
    }));
    this.pushToHistory();
  }

  updateTableData(elementId: string, table: TableData): void {
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        elements: s.elements.map((el) =>
          el.id === elementId ? { ...el, table } : el
        ),
      })),
    }));
    this.pushToHistory();
  }

  updateTableCell(elementId: string, row: number, col: number, data: { content: string; fieldPath: string }): void {
    this._template.update(t => {
      const newSections = t.sections.map(s => ({
        ...s,
        elements: s.elements.map(el => {
          if (el.id === elementId && el.table) {
            const newCells = el.table.cells.map((cellsRow, rIdx) => 
               rIdx === row ? cellsRow.map((cell, cIdx) => cIdx === col ? { ...cell, ...data } : cell) : cellsRow
            );
            return { ...el, table: { ...el.table, cells: newCells } };
          }
          return el;
        })
      }));
      return { ...t, sections: newSections };
    });
    this.pushToHistory();
  }

  updateSectionHeight(sectionId: string, height: number): void {
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) =>
        s.id === sectionId ? { ...s, height } : s
      ),
    }));
    this.pushToHistory();
  }

  removeSection(sectionId: string): void {
    this._template.update((t) => ({
      ...t,
      sections: t.sections.filter((s) => s.id !== sectionId),
    }));
    this.pushToHistory();
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
    const newSection: TemplateSection = {
      id: 'section-' + Math.random().toString(36).substring(2, 11),
      type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      height: 100,
      repeatPerRow: type === 'details',
      elements: [],
    };

    this._template.update((t) => {
      const SECTION_ORDER: Record<string, number> = {
        reportHeader: 1,
        pageHeader: 2,
        details: 3,
        footer: 4
      };
      
      const newSections = [...t.sections, newSection].sort((a, b) => 
        (SECTION_ORDER[a.type] || 99) - (SECTION_ORDER[b.type] || 99)
      );
      
      return { ...t, sections: newSections };
    });
    this.pushToHistory();
  }
}
