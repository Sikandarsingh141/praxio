import { Injectable, OnDestroy } from '@angular/core';
import { ComponentPortal } from '@angular/cdk/portal';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { LoaderComponent } from './loader.component';

@Injectable({ providedIn: 'root' })
export class LoaderService implements OnDestroy {
  private static readonly SHOW_DELAY_MS = 150;
  private readonly overlayRef: OverlayRef;
  private readonly activeOwners = new Set<object>();
  private showTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly overlay: Overlay) {
    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
      hasBackdrop: true,
      backdropClass: 'praxio-loader-backdrop',
      panelClass: 'praxio-loader-panel',
    });
    this.overlayRef.overlayElement.parentElement?.classList.add('praxio-loader-wrapper');
  }

  showLoader(owner: object): void {
    if (this.activeOwners.has(owner)) {
      return;
    }

    this.activeOwners.add(owner);
    if (this.activeOwners.size !== 1 || this.overlayRef.hasAttached()) {
      return;
    }

    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      if (this.activeOwners.size > 0 && !this.overlayRef.hasAttached()) {
        this.overlayRef.attach(new ComponentPortal(LoaderComponent));
      }
    }, LoaderService.SHOW_DELAY_MS);
  }

  hideLoader(owner: object): void {
    this.activeOwners.delete(owner);
    if (this.activeOwners.size > 0) {
      return;
    }

    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    if (this.overlayRef.hasAttached()) {
      this.overlayRef.detach();
    }
  }

  ngOnDestroy(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    this.overlayRef.dispose();
    this.activeOwners.clear();
  }
}
