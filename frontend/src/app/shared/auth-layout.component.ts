import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AccountSelectionPage } from '../auth/account-selection.page';
import { CustomerRegisterPage } from '../auth/customer-register.page';
import { ShopRegisterPage } from '../auth/shop-register.page';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayout {
  readonly registrationMode = signal(false);
  readonly loginMode = signal(true);
  readonly accountSelectionMode = signal(false);
  readonly customerRegistrationMode = signal(false);
  readonly shopRegistrationMode = signal(false);

  setContentMode(component: unknown): void {
    const registrationMode =
      component instanceof AccountSelectionPage ||
      component instanceof CustomerRegisterPage ||
      component instanceof ShopRegisterPage;
    this.registrationMode.set(registrationMode);
    this.loginMode.set(!registrationMode);
    this.accountSelectionMode.set(component instanceof AccountSelectionPage);
    this.customerRegistrationMode.set(component instanceof CustomerRegisterPage);
    this.shopRegistrationMode.set(component instanceof ShopRegisterPage);
  }
}
