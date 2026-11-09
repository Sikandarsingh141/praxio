import { Directive, Input, OnDestroy } from '@angular/core';
import { LoaderService } from './loader.service';

@Directive({
  selector: '[appOverlayLoader]',
  standalone: true,
})
export class LoaderDirective implements OnDestroy {
  private readonly owner = {};

  constructor(private readonly loader: LoaderService) {}

  @Input()
  set appOverlayLoader(loading: boolean) {
    if (loading) {
      this.loader.showLoader(this.owner);
    } else {
      this.loader.hideLoader(this.owner);
    }
  }

  ngOnDestroy(): void {
    this.loader.hideLoader(this.owner);
  }
}
