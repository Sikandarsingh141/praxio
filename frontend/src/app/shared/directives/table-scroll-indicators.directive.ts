import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  Renderer2,
  inject,
} from '@angular/core';

@Directive({
  selector: '[appTableScrollIndicators]',
  standalone: true,
})
export class TableScrollIndicatorsDirective implements AfterViewInit, OnDestroy {
  @Input() tableAppearance?: 'curved' | 'normal';

  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly renderer = inject(Renderer2);
  private readonly leftIndicator = this.createIndicator('left');
  private readonly rightIndicator = this.createIndicator('right');
  private readonly onScroll = (): void => this.updateIndicators();
  private readonly onResize = (): void => this.updateIndicators();
  private resizeObserver?: ResizeObserver;
  private contentObserver?: MutationObserver;
  private preferenceObserver?: MutationObserver;
  private unlistenScroll?: () => void;
  private observedTable?: HTMLTableElement;

  ngAfterViewInit(): void {
    this.renderer.addClass(this.host, 'table-scroll-indicators');
    this.renderer.appendChild(this.host, this.leftIndicator);
    this.renderer.appendChild(this.host, this.rightIndicator);
    this.unlistenScroll = this.renderer.listen(this.host, 'scroll', this.onScroll);
    this.document.defaultView?.addEventListener('resize', this.onResize);
    this.document.documentElement.setAttribute(
      'data-table-appearance',
      this.document.documentElement.getAttribute('data-table-appearance') ?? 'curved',
    );

    const ResizeObserverType = this.document.defaultView?.ResizeObserver;
    if (ResizeObserverType) {
      this.resizeObserver = new ResizeObserverType(this.onResize);
      this.resizeObserver.observe(this.host);
    }

    const MutationObserverType = this.document.defaultView?.MutationObserver;
    if (MutationObserverType) {
      this.contentObserver = new MutationObserverType(() => {
        this.observeTable();
        this.updateIndicators();
      });
      this.contentObserver.observe(this.host, { childList: true, subtree: true });

      this.preferenceObserver = new MutationObserverType(this.onResize);
      this.preferenceObserver.observe(this.document.documentElement, {
        attributeFilter: ['data-table-appearance'],
      });
    }

    this.observeTable();
    this.updateIndicators();
  }

  ngOnDestroy(): void {
    this.unlistenScroll?.();
    this.document.defaultView?.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
    this.contentObserver?.disconnect();
    this.preferenceObserver?.disconnect();
  }

  private createIndicator(side: 'left' | 'right'): HTMLElement {
    const indicator = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(indicator, 'table-scroll-indicator');
    this.renderer.addClass(indicator, `table-scroll-indicator-${side}`);
    this.renderer.setAttribute(indicator, 'aria-hidden', 'true');
    return indicator;
  }

  private observeTable(): void {
    const table = this.host.querySelector('table');
    if (table === this.observedTable) return;
    if (this.observedTable) this.resizeObserver?.unobserve(this.observedTable);
    this.observedTable = table ?? undefined;
    if (this.observedTable) this.resizeObserver?.observe(this.observedTable);
  }

  private updateIndicators(): void {
    const scrollWidth = this.host.scrollWidth;
    const clientWidth = this.host.clientWidth;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    const scrollLeft = Math.min(maxScroll, Math.max(0, this.host.scrollLeft));
    const canScroll = maxScroll > 1;
    const appearance =
      this.tableAppearance ??
      (this.document.documentElement.getAttribute('data-table-appearance') === 'normal'
        ? 'normal'
        : 'curved');
    const curved = appearance === 'curved';
    const leftVisible = canScroll && curved && scrollLeft > 1;
    const rightVisible = curved;
    const indicatorWidth = this.leftIndicator.getBoundingClientRect().width;

    this.setStyle(this.leftIndicator, 'left', `${scrollLeft}px`);
    this.setStyle(
      this.rightIndicator,
      'left',
      `${Math.max(0, scrollLeft + clientWidth - indicatorWidth)}px`,
    );
    this.setStyle(this.leftIndicator, 'height', `${this.host.clientHeight}px`);
    this.setStyle(this.rightIndicator, 'height', `${this.host.clientHeight}px`);
    this.setVisibility(this.leftIndicator, leftVisible);
    this.setVisibility(this.rightIndicator, rightVisible);
  }

  private setStyle(element: HTMLElement, property: string, value: string): void {
    if (element.style.getPropertyValue(property) !== value) {
      this.renderer.setStyle(element, property, value);
    }
  }

  private setVisibility(element: HTMLElement, visible: boolean): void {
    const visibility = visible ? 'visible' : 'hidden';
    const opacity = visible ? '1' : '0';
    this.setStyle(element, 'visibility', visibility);
    this.setStyle(element, 'opacity', opacity);
  }
}
