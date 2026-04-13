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
          content: 'Employee Report',
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
        {
          id: 'el-ph-name',
          type: 'text',
          content: 'Name',
          position: { x: 20, y: 12 },
          style: { ...DEFAULT_STYLE, fontWeight: 'bold', fontSize: 11, color: '#555' },
        },
        {
          id: 'el-ph-age',
          type: 'text',
          content: 'Age',
          position: { x: 160, y: 12 },
          style: { ...DEFAULT_STYLE, fontWeight: 'bold', fontSize: 11, color: '#555' },
        },
        {
          id: 'el-ph-city',
          type: 'text',
          content: 'City',
          position: { x: 240, y: 12 },
          style: { ...DEFAULT_STYLE, fontWeight: 'bold', fontSize: 11, color: '#555' },
        },
      ],
    },
    {
      id: 'section-details-1',
      type: 'details',
      label: 'Details',
      height: 36,
      repeatPerRow: true,
      elements: [
        {
          id: 'el-d-name',
          type: 'text',
          content: '{{name}}',
          position: { x: 20, y: 10 },
          style: { ...DEFAULT_STYLE },
          boundField: 'name',
        },
        {
          id: 'el-d-age',
          type: 'text',
          content: '{{age}}',
          position: { x: 160, y: 10 },
          style: { ...DEFAULT_STYLE },
          boundField: 'age',
        },
        {
          id: 'el-d-city',
          type: 'text',
          content: '{{city}}',
          position: { x: 240, y: 10 },
          style: { ...DEFAULT_STYLE },
          boundField: 'city',
        },
      ],
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
  private _selectedElementId = signal<string | null>(null);

  readonly template = this._template.asReadonly();

  readonly selectedElementId = this._selectedElementId.asReadonly();

  readonly selectedElement = computed<TemplateElement | null>(() => {
    const id = this._selectedElementId();
    if (!id) return null;
    for (const section of this._template().sections) {
      const el = section.elements.find((e) => e.id === id);
      if (el) return el;
    }
    return null;
  });

  readonly selectedElementSection = computed<SectionType | null>(() => {
    const id = this._selectedElementId();
    if (!id) return null;
    for (const section of this._template().sections) {
      if (section.elements.some((e) => e.id === id)) return section.type;
    }
    return null;
  });

  selectElement(id: string | null): void {
    this._selectedElementId.set(id);
  }

  addElement(sectionId: string, element: Omit<TemplateElement, 'id'>): void {
    const id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) =>
        s.id === sectionId
          ? { ...s, elements: [...s.elements, { ...element, id }] }
          : s
      ),
    }));
    this._selectedElementId.set(id);
  }

  updateElement(id: string, patch: Partial<Omit<TemplateElement, 'id'>>): void {
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
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) => ({
        ...s,
        elements: s.elements.filter((el) => el.id !== id),
      })),
    }));
    if (this._selectedElementId() === id) this._selectedElementId.set(null);
  }

  removeSection(id: string): void {
    this._template.update((t) => ({
      ...t,
      sections: t.sections.filter((s) => s.id !== id),
    }));
  }

  updateSectionHeight(sectionId: string, height: number): void {
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) =>
        s.id === sectionId ? { ...s, height: Math.max(30, height) } : s
      ),
    }));
  }

  updateSectionRepeat(sectionId: string, repeatPerRow: boolean): void {
    this._template.update((t) => ({
      ...t,
      sections: t.sections.map((s) =>
        s.id === sectionId ? { ...s, repeatPerRow } : s
      ),
    }));
  }

  addDetailsSection(): void {
    const detailsCount = this._template().sections.filter((s) => s.type === 'details').length;
    const index = detailsCount + 1;
    const id = `section-details-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const detailsSection = {
      id,
      type: 'details' as const,
      label: index === 1 ? 'Details' : `Details ${index}`,
      height: 80,
      repeatPerRow: true,
      elements: [],
    };

    this._template.update((t) => ({
      ...t,
      sections: this.insertBeforeFooter(t.sections, detailsSection),
    }));
  }

  resetTemplate(): void {
    this._template.set(structuredClone(INITIAL_TEMPLATE));
    this._selectedElementId.set(null);
  }

  private insertBeforeFooter(sections: TemplateSection[], nextSection: TemplateSection): TemplateSection[] {
    const footerIndex = sections.findIndex((section) => section.type === 'footer');
    if (footerIndex === -1) return [...sections, nextSection];
    return [
      ...sections.slice(0, footerIndex),
      nextSection,
      ...sections.slice(footerIndex),
    ];
  }
}
