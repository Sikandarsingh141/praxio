import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TableScrollIndicatorsDirective } from './table-scroll-indicators.directive';

@Component({
  standalone: true,
  imports: [TableScrollIndicatorsDirective],
  template: `
    <div id="default-appearance" appTableScrollIndicators>
      <table><tbody><tr><td>Table content</td></tr></tbody></table>
    </div>
    <div id="normal-appearance" appTableScrollIndicators tableAppearance="normal">
      <table><tbody><tr><td>Table content</td></tr></tbody></table>
    </div>
  `,
})
class TableScrollHostComponent {}

describe('TableScrollIndicatorsDirective', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-table-appearance');
  });

  it('keeps the right edge curved while the left indicator follows scroll position', () => {
    const fixture = TestBed.createComponent(TableScrollHostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector(
      '#default-appearance',
    ) as HTMLElement;
    const left = host.querySelector('.table-scroll-indicator-left') as HTMLElement;
    const right = host.querySelector('.table-scroll-indicator-right') as HTMLElement;

    Object.defineProperties(host, {
      clientWidth: { configurable: true, value: 300 },
      clientHeight: { configurable: true, value: 120 },
      scrollWidth: { configurable: true, value: 600 },
      scrollLeft: { configurable: true, writable: true, value: 0 },
    });
    host.dispatchEvent(new Event('scroll'));

    expect(left.style.visibility).toBe('hidden');
    expect(right.style.visibility).toBe('visible');
    expect(left.style.left).toBe('0px');
    expect(Number.parseFloat(right.style.left)).toBeCloseTo(
      300 - right.getBoundingClientRect().width,
      2,
    );

    host.scrollLeft = 150;
    host.dispatchEvent(new Event('scroll'));
    expect(left.style.visibility).toBe('visible');
    expect(right.style.visibility).toBe('visible');
    expect(left.style.left).toBe('150px');
    expect(Number.parseFloat(right.style.left)).toBeCloseTo(
      450 - right.getBoundingClientRect().width,
      2,
    );

    host.scrollLeft = 300;
    host.dispatchEvent(new Event('scroll'));
    expect(left.style.visibility).toBe('visible');
    expect(right.style.visibility).toBe('visible');
    expect(left.style.left).toBe('300px');
    expect(Number.parseFloat(right.style.left)).toBeCloseTo(
      600 - right.getBoundingClientRect().width,
      2,
    );

    document.documentElement.setAttribute('data-table-appearance', 'normal');
    window.dispatchEvent(new Event('resize'));
    expect(left.style.visibility).toBe('hidden');
    expect(right.style.visibility).toBe('hidden');

    Object.defineProperty(host, 'scrollWidth', {
      configurable: true,
      value: 300,
    });
    host.scrollLeft = 0;
    document.documentElement.setAttribute('data-table-appearance', 'curved');
    window.dispatchEvent(new Event('resize'));
    host.dispatchEvent(new Event('scroll'));
    expect(left.style.visibility).toBe('hidden');
    expect(right.style.visibility).toBe('visible');

    fixture.destroy();
  });

  it('allows one table to use normal edges without changing the global preference', () => {
    const fixture = TestBed.createComponent(TableScrollHostComponent);
    fixture.detectChanges();

    const defaultRight = fixture.nativeElement.querySelector(
      '#default-appearance .table-scroll-indicator-right',
    ) as HTMLElement;
    const normalRight = fixture.nativeElement.querySelector(
      '#normal-appearance .table-scroll-indicator-right',
    ) as HTMLElement;

    expect(document.documentElement.getAttribute('data-table-appearance')).toBe('curved');
    expect(defaultRight.style.visibility).toBe('visible');
    expect(normalRight.style.visibility).toBe('hidden');

    fixture.destroy();
  });
});
