import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ShopTechnicianFormPage } from './shop-technician-form.page';
import { TechniciansService } from './technicians.service';

describe('ShopTechnicianFormPage', () => {
  let component: ShopTechnicianFormPage;
  let fixture: ComponentFixture<ShopTechnicianFormPage>;
  let techniciansService: jasmine.SpyObj<TechniciansService>;
  let router: Router;

  beforeEach(async () => {
    techniciansService = jasmine.createSpyObj('TechniciansService', ['create', 'update', 'get']);

    await TestBed.configureTestingModule({
      imports: [ShopTechnicianFormPage],
      providers: [
        provideRouter([]),
        { provide: TechniciansService, useValue: techniciansService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    fixture = TestBed.createComponent(ShopTechnicianFormPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the add technician form without status and availability fields', () => {
    expect(component.editing).toBeFalse();
    expect(component.selectedSkills()).toContain('Mobile Phone Repair');

    const formEl = fixture.nativeElement.querySelector('.technician-form');
    expect(formEl).toBeTruthy();

    const bannerTitles = fixture.nativeElement.querySelectorAll('.card-banner h2');
    expect(bannerTitles.length).toBe(3);
    expect(bannerTitles[0].textContent).toContain('Personal Information');
    expect(bannerTitles[1].textContent).toContain('Profile Photo');
    expect(bannerTitles[2].textContent).toContain('Work Information');

    // Verify Status and Availability controls are NOT in the form
    const formLabels = Array.from(fixture.nativeElement.querySelectorAll('.label-text')).map(
      (el: any) => el.textContent.trim(),
    );
    expect(formLabels.some((txt) => txt.includes('Status'))).toBeFalse();
    expect(formLabels.some((txt) => txt.includes('Availability'))).toBeFalse();
  });

  it('toggles password and confirm password visibility', () => {
    expect(component.showPassword()).toBeFalse();
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBeTrue();
    component.togglePasswordVisibility();
    expect(component.showPassword()).toBeFalse();

    expect(component.showConfirmPassword()).toBeFalse();
    component.toggleConfirmPasswordVisibility();
    expect(component.showConfirmPassword()).toBeTrue();
    component.toggleConfirmPasswordVisibility();
    expect(component.showConfirmPassword()).toBeFalse();
  });

  it('detects password mismatch and blocks submission', () => {
    component.form.patchValue({
      firstName: 'Aman',
      lastName: 'Verma',
      email: 'amanverma@gmail.com',
      countryCode: '+91',
      mobileNumber: '6457374574',
      employeeId: 'FX-TCH-1001',
      specialization: 'Laptop & Mobile Repair',
      experienceYears: 2,
      employmentType: 'full_time',
      joiningDate: '2026-01-15',
      password: 'StrongPassword1',
      confirmPassword: 'DifferentPassword2',
    });

    expect(component.passwordsMismatch).toBeTrue();
    component.submit();

    expect(techniciansService.create).not.toHaveBeenCalled();
    expect(component.error()).toContain('Passwords do not match');
  });

  it('supports selecting and unselecting skills via checkboxes', () => {
    expect(component.isSkillSelected('Laptop Repair')).toBeFalse();

    // Toggle on
    component.toggleSkill('Laptop Repair');
    expect(component.isSkillSelected('Laptop Repair')).toBeTrue();
    expect(component.selectedSkills()).toContain('Laptop Repair');

    // Toggle off
    component.toggleSkill('Laptop Repair');
    expect(component.isSkillSelected('Laptop Repair')).toBeFalse();
    expect(component.selectedSkills()).not.toContain('Laptop Repair');
  });

  it('toggles skills dropdown and closes on outside click', () => {
    expect(component.isSkillsDropdownOpen()).toBeFalse();
    component.toggleSkillsDropdown();
    expect(component.isSkillsDropdownOpen()).toBeTrue();

    // Outside click closes it
    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    component.onDocumentClick({ target: outsideEl } as any);
    expect(component.isSkillsDropdownOpen()).toBeFalse();
    document.body.removeChild(outsideEl);
  });

  it('adds and removes custom skills properly', () => {
    component.form.controls.customSkill.setValue('Screen Replacement');
    component.addSkill();
    expect(component.selectedSkills()).toContain('Screen Replacement');
    expect(component.skillOptions()).toContain('Screen Replacement');
    expect(component.form.controls.customSkill.value).toBe('');

    component.removeSkill('Screen Replacement');
    expect(component.selectedSkills()).not.toContain('Screen Replacement');
  });

  it('submits valid technician input with matching password and confirm password', () => {
    techniciansService.create.and.returnValue(
      of({ id: 'tech-101', firstName: 'Aman', lastName: 'Verma' } as any),
    );

    component.form.patchValue({
      firstName: 'Aman',
      lastName: 'Verma',
      email: 'amanverma@gmail.com',
      countryCode: '+91',
      mobileNumber: '6457374574',
      password: 'StrongPassword1',
      confirmPassword: 'StrongPassword1',
      employeeId: 'FX-TCH-1001',
      specialization: 'Laptop & Mobile Repair',
      experienceYears: 2,
      employmentType: 'full_time',
      joiningDate: '2026-01-15',
    });

    expect(component.passwordsMismatch).toBeFalse();
    component.submit();

    expect(techniciansService.create).toHaveBeenCalled();
    const createdPayload = techniciansService.create.calls.mostRecent().args[0];
    expect(createdPayload.firstName).toBe('Aman');
    expect(createdPayload.password).toBe('StrongPassword1');
    expect(createdPayload.status).toBe('active');
    expect(createdPayload.availabilityPreference).toBe('available');
    expect(router.navigate).toHaveBeenCalledWith(['/shop/technicians', 'tech-101']);
  });
});
