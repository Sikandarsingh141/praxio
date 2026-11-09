import { Component, DestroyRef, inject } from '@angular/core';
import { GoogleMapsModule } from '@angular/google-maps';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LoaderService } from './loaders/overlay/local/loader.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, GoogleMapsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly router = inject(Router);
  private readonly loader = inject(LoaderService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigationOwner = {};

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.loader.showLoader(this.navigationOwner);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.loader.hideLoader(this.navigationOwner);
      }
    });
  }
}
