import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-account-selection-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './account-selection.page.html',
  styleUrl: './account-selection.page.scss',
})
export class AccountSelectionPage {}
