import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { TechnicianInput, TechnicianEmploymentType } from './technicians.models';
import { TechniciansService } from './technicians.service';

const DEFAULT_SKILL_OPTIONS = [
  'Mobile Phone Repair',
  'Laptop Repair',
  'Desktop Repair',
  'Hardware',
  'Software',
  'Network',
  'Printer',
  'Accessories',
  'TV Repair',
  'Appliance Repair',
  'Refrigerator Repair',
  'AC Repair',
  'Washing Machine Repair',
  'Data Recovery',
];

@Component({
  selector: 'app-shop-technician-form-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './shop-technician-form.page.html',
  styleUrl: './shop-technician-form.page.scss',
})
export class ShopTechnicianFormPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly skillOptions = signal<string[]>([...DEFAULT_SKILL_OPTIONS]);
  readonly isSkillsDropdownOpen = signal(false);
  readonly submitting = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly selectedSkills = signal<string[]>(['Mobile Phone Repair']);
  readonly profileImageData = signal('');
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly technicianId = this.route.snapshot.paramMap.get('id');
  readonly editing = !!this.technicianId;

  private existingStatus: 'active' | 'inactive' = 'active';
  private existingAvailability: 'available' | 'on_leave' = 'available';

  readonly form = this.formBuilder.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(50)]],
    lastName: ['', [Validators.required, Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    countryCode: ['+91', Validators.required],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    password: ['', this.editing ? [] : [Validators.required, Validators.minLength(8), Validators.maxLength(72), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)]],
    confirmPassword: ['', this.editing ? [] : [Validators.required]],
    employeeId: ['', [Validators.required, Validators.maxLength(30)]],
    specialization: ['', [Validators.required, Validators.maxLength(120)]],
    experienceYears: [0, [Validators.required, Validators.min(0), Validators.max(80)]],
    employmentType: ['full_time' as TechnicianEmploymentType, Validators.required],
    joiningDate: ['', Validators.required],
    customSkill: [''],
  });

  get passwordsMismatch(): boolean {
    const pwd = this.form.controls.password.value;
    const cpwd = this.form.controls.confirmPassword.value;
    if (!cpwd) return false;
    return pwd !== cpwd;
  }

  constructor(
    private readonly router: Router,
    private readonly technicians: TechniciansService,
  ) {}

  ngOnInit(): void {
    if (!this.technicianId) return;
    this.loading.set(true);
    this.technicians
      .get(this.technicianId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (technician) => {
          this.form.patchValue({
            firstName: technician.firstName,
            lastName: technician.lastName,
            email: technician.email,
            countryCode: technician.countryCode,
            mobileNumber: technician.mobileNumber,
            employeeId: technician.employeeId,
            specialization: technician.specialization,
            experienceYears: technician.experienceYears,
            employmentType: technician.employmentType,
            joiningDate: technician.joiningDate?.slice(0, 10) ?? '',
          });
          this.existingStatus = technician.status ?? 'active';
          this.existingAvailability = technician.availability === 'on_leave' ? 'on_leave' : 'available';

          const techSkills = technician.skills ?? [];
          this.selectedSkills.set(techSkills);

          techSkills.forEach((skill) => {
            if (!this.skillOptions().some((s) => s.toLowerCase() === skill.toLowerCase())) {
              this.skillOptions.update((opts) => [...opts, skill]);
            }
          });

          this.profileImageData.set(technician.profileImageData ?? '');
        },
        error: (error: HttpErrorResponse) =>
          this.error.set(error.error?.message || 'Technician details could not be loaded.'),
      });
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((val) => !val);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((val) => !val);
  }

  toggleSkillsDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.isSkillsDropdownOpen.update((open) => !open);
  }

  isSkillSelected(skill: string): boolean {
    return this.selectedSkills().includes(skill);
  }

  toggleSkill(skill: string): void {
    if (this.isSkillSelected(skill)) {
      this.removeSkill(skill);
    } else {
      this.selectedSkills.update((skills) => [...skills, skill]);
    }
  }

  addSkill(): void {
    const skill = this.form.controls.customSkill.value.trim();
    if (skill) {
      if (!this.skillOptions().some((value) => value.toLowerCase() === skill.toLowerCase())) {
        this.skillOptions.update((opts) => [...opts, skill]);
      }
      if (!this.selectedSkills().some((value) => value.toLowerCase() === skill.toLowerCase())) {
        this.selectedSkills.update((skills) => [...skills, skill]);
      }
    }
    this.form.controls.customSkill.setValue('');
  }

  removeSkill(skill: string): void {
    this.selectedSkills.update((skills) => skills.filter((value) => value !== skill));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.skills-input-box')) {
      this.isSkillsDropdownOpen.set(false);
    }
  }

  async choosePhoto(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1_000_000) {
      this.error.set('Choose a JPG, PNG, or WebP photo smaller than 1 MB.');
      return;
    }
    this.error.set('');
    this.profileImageData.set(await this.readFile(file));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Review the highlighted fields and correct them before saving.');
      return;
    }
    const value = this.form.getRawValue();
    if (!this.editing && !value.password) {
      this.form.controls.password.markAsTouched();
      this.error.set('Password is required.');
      return;
    }
    if (value.password || value.confirmPassword) {
      if (value.password !== value.confirmPassword) {
        this.form.controls.confirmPassword.markAsTouched();
        this.error.set('Passwords do not match. Please ensure Password and Confirm Password match.');
        return;
      }
    }
    if (!this.selectedSkills().length) {
      this.error.set('Select at least one technician skill.');
      return;
    }
    this.error.set('');
    this.submitting.set(true);
    const input: TechnicianInput = {
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      email: value.email.trim(),
      countryCode: value.countryCode,
      mobileNumber: value.mobileNumber,
      employeeId: value.employeeId.trim(),
      skills: this.selectedSkills(),
      specialization: value.specialization.trim(),
      experienceYears: Number(value.experienceYears),
      employmentType: value.employmentType,
      joiningDate: value.joiningDate,
      status: this.existingStatus,
      availabilityPreference: this.existingAvailability,
      ...(this.profileImageData() ? { profileImageData: this.profileImageData() } : {}),
      ...(value.password ? { password: value.password } : {}),
    };
    const request = this.editing
      ? this.technicians.update(this.technicianId!, input)
      : this.technicians.create(input);
    request.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (technician) =>
        void this.router.navigate(['/shop/technicians', technician.id]),
      error: (error: HttpErrorResponse) =>
        this.error.set(error.error?.message || 'Technician could not be saved. Check email, phone, and employee ID.'),
    });
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Photo could not be read.'));
      reader.readAsDataURL(file);
    });
  }
}
