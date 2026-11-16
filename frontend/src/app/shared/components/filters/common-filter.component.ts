import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export type FilterFieldType =
  | 'text'
  | 'select'
  | 'multi-select'
  | 'date'
  | 'date-range'
  | 'number'
  | 'number-range'
  | 'checkbox'
  | 'radio';

export interface FilterOption {
  label: string;
  value: string | number;
}

export interface FilterFieldConfig {
  key: string;
  label: string;
  type: FilterFieldType;
  placeholder?: string;
  options?: FilterOption[];
  defaultValue?: FilterValue;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export interface FilterConfig {
  title?: string;
  fields: FilterFieldConfig[];
}

export type FilterRangeValue = { from?: string; to?: string };
export type NumberRangeValue = { min?: number | null; max?: number | null };
export type FilterValue =
  | string
  | number
  | boolean
  | Array<string | number>
  | FilterRangeValue
  | NumberRangeValue
  | null
  | undefined;
export type FilterValues = Record<string, FilterValue>;

@Component({
  selector: 'app-common-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="filter-toolbar">
      <button
        class="filter-trigger"
        [class.active]="activeFilterCount > 0"
        type="button"
        aria-haspopup="dialog"
        [attr.aria-expanded]="drawerOpen"
        (click)="toggleDrawer()"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16M7 12h10m-7 6h4" />
        </svg>
        <span>Filter</span>
        @if (activeFilterCount > 0) {
          <span class="filter-count">{{ activeFilterCount }}</span>
        }
      </button>

      @if (activeFilterCount > 0) {
        <div class="active-filters" aria-label="Applied filters">
          @for (chip of activeChips; track chip.key) {
            <button
              type="button"
              class="filter-chip"
              [attr.aria-label]="'Remove ' + chip.label + ' filter'"
              (click)="removeFilter(chip.key)"
            >
              <span>{{ chip.label }}: {{ chip.value }}</span>
              <span aria-hidden="true">×</span>
            </button>
          }
          <button type="button" class="clear-applied" (click)="clearApplied()">
            Clear filters
          </button>
        </div>
      }
    </div>

    @if (drawerOpen) {
      <div class="filter-backdrop" (click)="closeDrawer()" role="presentation">
        <section
          class="filter-drawer"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="config.title || 'Filters'"
          (click)="$event.stopPropagation()"
        >
          <header class="drawer-header">
            <div>
              <span class="drawer-eyebrow">REFINE RESULTS</span>
              <h2>{{ config.title || 'Filters' }}</h2>
            </div>
            <button
              type="button"
              class="close-button"
              aria-label="Close filters"
              (click)="closeDrawer()"
            >
              ×
            </button>
          </header>

          <div class="drawer-content">
            @for (field of config.fields; track field.key) {
              <div class="filter-field">
                @switch (field.type) {
                  @case ('text') {
                    <label [for]="field.key">{{ field.label }}</label>
                    <input
                      [id]="field.key"
                      type="text"
                      [placeholder]="field.placeholder || ''"
                      [required]="field.required || false"
                      [ngModel]="textValue(field.key)"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="updateValue(field.key, $event)"
                    />
                  }
                  @case ('select') {
                    <label [for]="field.key">{{ field.label }}</label>
                    <select
                      [id]="field.key"
                      [required]="field.required || false"
                      [ngModel]="textValue(field.key)"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="updateValue(field.key, $event)"
                    >
                      <option value="">{{ field.placeholder || 'Any' }}</option>
                      @for (option of field.options || []; track option.value) {
                        <option [value]="option.value">{{ option.label }}</option>
                      }
                    </select>
                  }
                  @case ('multi-select') {
                    <label [for]="field.key">{{ field.label }}</label>
                    <select
                      [id]="field.key"
                      multiple
                      [required]="field.required || false"
                      [value]="selectedValues(field.key)"
                      (change)="updateMultiSelect(field.key, $event)"
                    >
                      @for (option of field.options || []; track option.value) {
                        <option [value]="option.value">{{ option.label }}</option>
                      }
                    </select>
                  }
                  @case ('date') {
                    <label [for]="field.key">{{ field.label }}</label>
                    <input
                      [id]="field.key"
                      type="date"
                      [required]="field.required || false"
                      [ngModel]="textValue(field.key)"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="updateValue(field.key, $event)"
                    />
                  }
                  @case ('date-range') {
                    <fieldset>
                      <legend>{{ field.label }}</legend>
                      <div class="range-fields">
                        <label [for]="field.key + '-from'">
                          From
                          <input
                            [id]="field.key + '-from'"
                            type="date"
                            [ngModel]="rangeValue(field.key).from || ''"
                            [ngModelOptions]="{ standalone: true }"
                            (ngModelChange)="updateRange(field.key, 'from', $event)"
                          />
                        </label>
                        <label [for]="field.key + '-to'">
                          To
                          <input
                            [id]="field.key + '-to'"
                            type="date"
                            [ngModel]="rangeValue(field.key).to || ''"
                            [ngModelOptions]="{ standalone: true }"
                            (ngModelChange)="updateRange(field.key, 'to', $event)"
                          />
                        </label>
                      </div>
                    </fieldset>
                  }
                  @case ('number') {
                    <label [for]="field.key">{{ field.label }}</label>
                    <input
                      [id]="field.key"
                      type="number"
                      [min]="field.min ?? null"
                      [max]="field.max ?? null"
                      [step]="field.step ?? 1"
                      [required]="field.required || false"
                      [placeholder]="field.placeholder || ''"
                      [ngModel]="numberValue(field.key)"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="updateNumber(field.key, $event)"
                    />
                  }
                  @case ('number-range') {
                    <fieldset>
                      <legend>{{ field.label }}</legend>
                      <div class="range-fields">
                        <label [for]="field.key + '-min'">
                          Minimum
                          <input
                            [id]="field.key + '-min'"
                            type="number"
                            [min]="field.min ?? null"
                            [step]="field.step ?? 1"
                            [ngModel]="numberRangeValue(field.key).min ?? ''"
                            [ngModelOptions]="{ standalone: true }"
                            (ngModelChange)="updateNumberRange(field.key, 'min', $event)"
                          />
                        </label>
                        <label [for]="field.key + '-max'">
                          Maximum
                          <input
                            [id]="field.key + '-max'"
                            type="number"
                            [max]="field.max ?? null"
                            [step]="field.step ?? 1"
                            [ngModel]="numberRangeValue(field.key).max ?? ''"
                            [ngModelOptions]="{ standalone: true }"
                            (ngModelChange)="updateNumberRange(field.key, 'max', $event)"
                          />
                        </label>
                      </div>
                    </fieldset>
                  }
                  @case ('checkbox') {
                    <label class="choice">
                      <input
                        type="checkbox"
                        [checked]="booleanValue(field.key)"
                        (change)="updateValue(field.key, $any($event.target).checked)"
                      />
                      <span>{{ field.label }}</span>
                    </label>
                  }
                  @case ('radio') {
                    <fieldset>
                      <legend>{{ field.label }}</legend>
                      <div class="choices">
                        @for (option of field.options || []; track option.value) {
                          <label class="choice" [for]="field.key + '-' + $index">
                            <input
                              [id]="field.key + '-' + $index"
                              type="radio"
                              [name]="'filter-' + field.key"
                              [value]="option.value"
                              [checked]="textValue(field.key) === StringValue(option.value)"
                              (change)="updateValue(field.key, option.value)"
                            />
                            <span>{{ option.label }}</span>
                          </label>
                        }
                      </div>
                    </fieldset>
                  }
                }
              </div>
            } @empty {
              <p class="no-fields">No filters are available for this list.</p>
            }
          </div>

          <footer class="drawer-footer">
            <button type="button" class="clear-draft" (click)="clearDraft()">Clear all</button>
            <button type="button" class="apply-button" (click)="applyFilters()">
              Apply filters
            </button>
          </footer>
        </section>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      color: #304537;
    }
    .filter-toolbar,
    .active-filters {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.55rem;
    }
    .filter-trigger {
      display: inline-flex;
      min-height: 2.5rem;
      align-items: center;
      gap: 0.45rem;
      padding: 0.55rem 0.8rem;
      border: 1px solid #dfe7df;
      border-radius: 0.65rem;
      background: #fff;
      color: #43594a;
      font: inherit;
      font-size: 0.8rem;
      font-weight: 650;
      cursor: pointer;
    }
    .filter-trigger:hover,
    .filter-trigger.active {
      border-color: #315d4b;
      background: #f1f6f1;
      color: #315d4b;
    }
    .filter-trigger svg {
      width: 1rem;
      height: 1rem;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-width: 1.8;
    }
    .filter-count {
      display: grid;
      min-width: 1.2rem;
      height: 1.2rem;
      place-items: center;
      border-radius: 999px;
      background: #315d4b;
      color: #fff;
      font-size: 0.68rem;
    }
    .filter-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.36rem 0.55rem;
      border: 1px solid #dfe7df;
      border-radius: 999px;
      background: #f7faf7;
      color: #43594a;
      font: inherit;
      font-size: 0.7rem;
      cursor: pointer;
    }
    .filter-chip span:last-child {
      font-size: 1rem;
      line-height: 0.8;
    }
    .clear-applied,
    .clear-draft {
      border: 0;
      background: transparent;
      color: #526e5a;
      font: inherit;
      font-size: 0.75rem;
      font-weight: 650;
      cursor: pointer;
    }
    .filter-backdrop {
      position: fixed;
      z-index: 1000;
      inset: 0;
      display: flex;
      justify-content: flex-end;
      background: rgb(20 31 25 / 42%);
    }
    .filter-drawer {
      display: flex;
      width: min(27rem, 100%);
      height: 100%;
      flex-direction: column;
      background: #fff;
      box-shadow: -0.75rem 0 2rem rgb(20 31 25 / 12%);
      animation: drawer-enter 180ms ease-out;
    }
    .drawer-header,
    .drawer-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.1rem 1.25rem;
      border-bottom: 1px solid #edf1ed;
    }
    .drawer-header h2 {
      margin: 0.2rem 0 0;
      font-size: 1.25rem;
      letter-spacing: -0.025em;
    }
    .drawer-eyebrow {
      color: #668271;
      font-size: 0.63rem;
      font-weight: 750;
      letter-spacing: 0.12em;
    }
    .close-button {
      display: grid;
      width: 2rem;
      height: 2rem;
      place-items: center;
      border: 0;
      border-radius: 0.5rem;
      background: #f2f6f2;
      color: #52645a;
      font-size: 1.4rem;
      cursor: pointer;
    }
    .drawer-content {
      flex: 1;
      overflow: auto;
      padding: 1.1rem 1.25rem;
    }
    .filter-field {
      display: grid;
      gap: 0.5rem;
      margin-bottom: 1.1rem;
    }
    .filter-field > label,
    fieldset legend {
      color: #46594d;
      font-size: 0.78rem;
      font-weight: 650;
    }
    .filter-field input:not([type='checkbox']):not([type='radio']),
    .filter-field select {
      box-sizing: border-box;
      width: 100%;
      min-height: 2.55rem;
      padding: 0.6rem 0.7rem;
      border: 1px solid #dfe7df;
      border-radius: 0.6rem;
      background: #fff;
      color: #304537;
      font: inherit;
      font-size: 0.8rem;
    }
    .filter-field select[multiple] {
      min-height: 6rem;
    }
    fieldset {
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }
    .range-fields,
    .choices {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.65rem;
      margin-top: 0.5rem;
    }
    .range-fields label {
      display: grid;
      gap: 0.35rem;
      color: #77867c;
      font-size: 0.7rem;
    }
    .choice {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      color: #53645a;
      font-size: 0.78rem;
      cursor: pointer;
    }
    .choices {
      grid-template-columns: 1fr;
    }
    .no-fields {
      color: #77867c;
      font-size: 0.82rem;
    }
    .drawer-footer {
      position: sticky;
      bottom: 0;
      justify-content: flex-end;
      border-top: 1px solid #edf1ed;
      border-bottom: 0;
      background: #fff;
    }
    .apply-button {
      min-height: 2.55rem;
      padding: 0.6rem 0.95rem;
      border: 0;
      border-radius: 0.6rem;
      background: #315d4b;
      color: #fff;
      font: inherit;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
    }
    @keyframes drawer-enter {
      from {
        transform: translateX(100%);
      }
      to {
        transform: translateX(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .filter-drawer {
        animation: none;
      }
    }
  `,
})
export class CommonFilterComponent {
  @Input({ required: true }) config: FilterConfig = { fields: [] };
  @Input() appliedFilters: FilterValues = {};
  @Output() readonly filtersChange = new EventEmitter<FilterValues>();

  drawerOpen = false;
  private draftFilters: FilterValues = {};

  get activeChips(): Array<{ key: string; label: string; value: string }> {
    return this.config.fields.flatMap((field) => {
      const value = this.appliedFilters[field.key];
      return this.isActive(field, value)
        ? [{ key: field.key, label: field.label, value: this.formatValue(field, value) }]
        : [];
    });
  }

  get activeFilterCount(): number {
    return this.activeChips.length;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDrawer();
  }

  toggleDrawer(): void {
    if (this.drawerOpen) {
      this.closeDrawer();
      return;
    }
    this.draftFilters = { ...this.appliedFilters };
    this.drawerOpen = true;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
  }

  applyFilters(): void {
    const filters = this.normalized(this.draftFilters);
    this.appliedFilters = filters;
    this.drawerOpen = false;
    this.filtersChange.emit(filters);
  }

  clearDraft(): void {
    this.draftFilters = Object.fromEntries(
      this.config.fields
        .filter((field) => field.defaultValue !== undefined)
        .map((field) => [field.key, this.cloneValue(field.defaultValue)]),
    );
  }

  clearApplied(): void {
    this.appliedFilters = {};
    this.draftFilters = {};
    this.filtersChange.emit({});
  }

  removeFilter(key: string): void {
    const filters = { ...this.appliedFilters };
    delete filters[key];
    this.appliedFilters = filters;
    this.draftFilters = { ...filters };
    this.filtersChange.emit(filters);
  }

  textValue(key: string): string {
    const value = this.draftFilters[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  }

  numberValue(key: string): number | null {
    const value = this.draftFilters[key];
    return typeof value === 'number' ? value : null;
  }

  booleanValue(key: string): boolean {
    return this.draftFilters[key] === true;
  }

  selectedValues(key: string): string[] {
    const value = this.draftFilters[key];
    return Array.isArray(value) ? value.map(String) : [];
  }

  rangeValue(key: string): FilterRangeValue {
    const value = this.draftFilters[key];
    return value && typeof value === 'object' && 'from' in value
      ? (value as FilterRangeValue)
      : {};
  }

  numberRangeValue(key: string): NumberRangeValue {
    const value = this.draftFilters[key];
    return value && typeof value === 'object' && ('min' in value || 'max' in value)
      ? (value as NumberRangeValue)
      : {};
  }

  StringValue(value: string | number): string {
    return String(value);
  }

  updateValue(key: string, value: FilterValue): void {
    this.draftFilters = { ...this.draftFilters, [key]: value };
  }

  updateNumber(key: string, value: string | number | null): void {
    this.updateValue(key, value === '' || value === null ? null : Number(value));
  }

  updateMultiSelect(key: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    this.updateValue(
      key,
      Array.from(target.selectedOptions, (option) => option.value),
    );
  }

  updateRange(key: string, bound: 'from' | 'to', value: string): void {
    const range = { ...this.rangeValue(key), [bound]: value || undefined };
    this.updateValue(key, range.from || range.to ? range : null);
  }

  updateNumberRange(key: string, bound: 'min' | 'max', value: string | number | null): void {
    const range = {
      ...this.numberRangeValue(key),
      [bound]: value === '' || value === null ? undefined : Number(value),
    };
    this.updateValue(key, range.min !== undefined || range.max !== undefined ? range : null);
  }

  private normalized(values: FilterValues): FilterValues {
    return Object.fromEntries(
      this.config.fields.flatMap((field) => {
        const value = values[field.key];
        return this.isActive(field, value) ? [[field.key, this.cloneValue(value)]] : [];
      }),
    );
  }

  private isActive(field: FilterFieldConfig, value: FilterValue): boolean {
    if (value === undefined || value === null || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') {
      return Object.values(value).some(
        (bound) => bound !== undefined && bound !== null && bound !== '',
      );
    }
    if (typeof value === 'boolean') return value;
    return value !== field.defaultValue;
  }

  private formatValue(field: FilterFieldConfig, value: FilterValue): string {
    if (Array.isArray(value)) {
      return value
        .map((item) => field.options?.find((option) => option.value === item)?.label ?? String(item))
        .join(', ');
    }
    if (typeof value === 'object' && value) {
      if ('from' in value || 'to' in value) {
        const range = value as FilterRangeValue;
        return [range.from, range.to].filter(Boolean).join(' – ');
      }
      const range = value as NumberRangeValue;
      return [range.min, range.max].filter((bound) => bound !== undefined).join(' – ');
    }
    return field.options?.find((option) => option.value === value)?.label ?? String(value);
  }

  private cloneValue(value: FilterValue): FilterValue {
    if (Array.isArray(value)) return [...value];
    if (value && typeof value === 'object') return { ...value };
    return value;
  }
}
