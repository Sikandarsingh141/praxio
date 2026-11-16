import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { ShopTechnicianPortalPage } from './shop-technician-portal.page';
import { TechniciansService } from './technicians.service';
import { ToastService } from '../core/toast/toast.service';
import { ChatService } from '../shared/chat.service';

describe('ShopTechnicianPortalPage', () => {
  let component: ShopTechnicianPortalPage;
  let fixture: ComponentFixture<ShopTechnicianPortalPage>;
  let techniciansService: jasmine.SpyObj<TechniciansService>;
  let httpTesting: HttpTestingController;

  const mockTechnician = {
    id: 'tech-1',
    firstName: 'Aman',
    lastName: 'Verma',
    fullName: 'Aman Verma',
    email: 'aman@fixora.com',
    mobileNumber: '9876543210',
    countryCode: '+91',
    skills: ['AC Repair'],
    specialization: 'HVAC Specialist',
    experienceYears: 5,
    employmentType: 'full_time',
    joiningDate: '2025-01-15T00:00:00.000Z',
    availabilityStatus: 'available',
    status: 'active',
  };

  const mockDashboardData = {
    technician: mockTechnician,
    kpis: {
      totalAssigned: 1,
      pendingJobs: 0,
      activeJobs: 1,
      completedJobs: 0,
      todayJobs: 0,
    },
    todaySchedule: [],
    recentlyAssigned: [],
    currentlyActiveJob: {
      id: 'job-real-001',
      appliance: 'Split AC Servicing',
      brand: 'Daikin',
      model: 'FTKF50TV16U',
      description: 'Filter cleaning and gas check',
      photo: null,
      status: 'in_progress',
      assignedAt: '2026-11-16T08:00:00.000Z',
      scheduledDate: '2026-11-16T10:00:00.000Z',
      customer: 'Real Customer',
      phone: '+91 9999999999',
      address: 'Industrial Area Phase 8, Mohali',
      shopName: 'Fast Repair Shop',
    },
    upcomingJobs: [],
    recentMessages: [],
    recentNotifications: [],
    recentActivity: [],
  };

  beforeEach(async () => {
    techniciansService = jasmine.createSpyObj<TechniciansService>('TechniciansService', [
      'myProfile',
      'dashboard',
      'myJobs',
      'myJobDetails',
      'updateProgress',
      'completeJob',
    ]);

    techniciansService.myProfile.and.returnValue(of(mockTechnician as any));
    techniciansService.dashboard.and.returnValue(of(mockDashboardData as any));
    techniciansService.myJobs.and.returnValue(
      of({
        jobs: [
          {
            id: 'job-real-001',
            appliance: 'Split AC Servicing',
            brand: 'Daikin',
            model: 'FTKF50TV16U',
            description: 'Filter cleaning and gas check',
            photo: null,
            status: 'in_progress',
            assignedAt: '2026-11-16T08:00:00.000Z',
            scheduledDate: '2026-11-16T10:00:00.000Z',
            customer: 'Real Customer',
            phone: '+91 9999999999',
            address: 'Industrial Area Phase 8, Mohali',
            shopName: 'Fast Repair Shop',
          },
        ],
        summary: {
          assigned: 1,
          pending: 0,
          active: 1,
          inProgress: 1,
          completed: 0,
          onHold: 0,
          today: 0,
        },
      } as any),
    );

    await TestBed.configureTestingModule({
      imports: [ShopTechnicianPortalPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: TechniciansService, useValue: techniciansService },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['show', 'success', 'error']) },
        { provide: ChatService, useValue: jasmine.createSpyObj('ChatService', ['openChatWithUser']) },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ShopTechnicianPortalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load dashboard data without static dummy jobs', () => {
    expect(component).toBeTruthy();
    expect(techniciansService.dashboard).toHaveBeenCalled();
    expect(component.dashboard()?.kpis.totalAssigned).toBe(1);
    expect(component.dashboard()?.kpis.activeJobs).toBe(1);
    expect(component.dashboard()?.currentlyActiveJob?.appliance).toBe('Split AC Servicing');
  });

  it('should compute real KPI counts based on live data and zero fallbacks', () => {
    const counts = component.counts();
    expect(counts.all).toBe(1);
    expect(counts.pending).toBe(0);
    expect(counts.active).toBe(1);
    expect(counts.completed).toBe(0);
  });

  it('should set empty jobs list when no jobs are assigned without injecting sample data', () => {
    techniciansService.myJobs.and.returnValue(
      of({
        jobs: [],
        summary: {
          assigned: 0,
          pending: 0,
          active: 0,
          inProgress: 0,
          completed: 0,
          onHold: 0,
          today: 0,
        },
      } as any),
    );

    component.loadJobs('all');
    expect(component.jobs().length).toBe(0);
    expect(component.details()).toBeNull();
    expect(component.counts().all).toBe(0);
  });

  it('should display real currently active job in template', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Split AC Servicing');
    expect(compiled.textContent).toContain('Real Customer');
  });

  it('should show a full-width active jobs list on the Active Jobs route', () => {
    TestBed.inject(ActivatedRoute).snapshot.data['technicianView'] = 'active';
    techniciansService.myJobDetails.and.returnValue(
      of({
        ...mockDashboardData.currentlyActiveJob,
        photos: [],
        location: null,
        serviceType: 'home_service',
        timeline: [],
      } as any),
    );

    component.view.set('active');
    component.filter.set('active');
    component.loadJobs('active');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.page-title')?.textContent?.trim()).toBe('Active Jobs');
    expect(getComputedStyle(compiled.querySelector('.page') as HTMLElement).maxWidth).toBe('none');
    expect(compiled.querySelector('.jobs-split-layout.active-job-list')).not.toBeNull();
    expect(compiled.querySelector('.active-job-row')).not.toBeNull();
    expect(compiled.querySelector('.active-job-progress')).not.toBeNull();
    expect(compiled.querySelectorAll('.filter-pills-nav .pill-tab-btn').length).toBe(1);
    expect(getComputedStyle(compiled.querySelector('.jobs-detail-column') as HTMLElement).display).toBe('none');
    expect(compiled.textContent).toContain('Showing 1–1 of 1 active job');
    expect(techniciansService.myJobs).toHaveBeenCalledWith('active');
    expect(techniciansService.myJobDetails).not.toHaveBeenCalled();
  });

  it('should show an active-specific empty state when no active jobs exist', () => {
    TestBed.inject(ActivatedRoute).snapshot.data['technicianView'] = 'active';
    techniciansService.myJobs.and.returnValue(
      of({
        jobs: [],
        summary: {
          assigned: 0,
          pending: 0,
          active: 0,
          inProgress: 0,
          completed: 0,
          onHold: 0,
          today: 0,
        },
      } as any),
    );

    component.view.set('active');
    component.filter.set('active');
    component.loadJobs('active');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No active jobs found.');
    expect(compiled.querySelector('.active-job-row')).toBeNull();
    expect(component.details()).toBeNull();
  });

  it('should show the Active Job Details layout and return to the active list', () => {
    TestBed.inject(ActivatedRoute).snapshot.data['technicianView'] = 'active';
    techniciansService.myJobDetails.and.returnValue(
      of({
        ...mockDashboardData.currentlyActiveJob,
        photos: [],
        location: null,
        serviceType: 'home_service',
        timeline: [],
        quotation: {
          amount: 100,
          currency: 'INR',
          inspectionFee: 0,
          labourFee: 0,
          partsFee: 100,
          notes: 'Clean filters.',
          estimatedDays: 3,
        },
      } as any),
    );

    component.view.set('active');
    component.viewJob(mockDashboardData.currentlyActiveJob as any);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.page-title')?.textContent?.trim()).toBe('Active Job Details');
    expect(compiled.querySelector('.active-job-details')).not.toBeNull();
    expect(compiled.querySelector('.active-detail-status')?.textContent).toContain('In Progress');
    expect(compiled.textContent).toContain('Customer Information');
    expect(compiled.textContent).toContain('Approved Quotation');
    expect(compiled.textContent).toContain('Repair Timeline & Activity');

    component.backToJobs();
    fixture.detectChanges();
    expect(component.view()).toBe('active');
  });

  it('should show the inline inspection editor for an inspection in progress', () => {
    component.details.set({
      ...mockDashboardData.currentlyActiveJob,
      status: 'inspection_in_progress',
      inspection: null,
      photos: [],
      timeline: [],
    } as any);
    component.view.set('job-detail');
    component.detailTab.set('inspection');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.inspection-editor-layout')).not.toBeNull();
    expect(compiled.textContent).toContain('Estimated Repair Cost');
    expect(compiled.textContent).toContain('Max 1.2 MB total');
    expect(compiled.querySelectorAll('.inspection-required-mark').length).toBe(4);
    expect(compiled.querySelector('textarea[placeholder="Describe the problem observed..."]')).not.toBeNull();
    expect(compiled.querySelector('textarea[placeholder="Enter your inspection findings..."]')).not.toBeNull();
    expect(compiled.querySelector('input[placeholder="e.g. 2"]')).not.toBeNull();
    const actionBar = compiled.querySelector('.detail-actions-bar');
    expect(actionBar?.textContent).not.toContain('Submit Inspection & Request Approval');
    expect(actionBar?.textContent).not.toContain('Edit Draft');
    expect(compiled.querySelector('.inspection-form-footer button[type="submit"]')).not.toBeNull();
  });

  it('should open the selected assigned job in the focused job details view', () => {
    techniciansService.myJobDetails.and.returnValue(
      of({
        ...mockDashboardData.currentlyActiveJob,
        photos: [],
        location: null,
        serviceType: 'home_service',
        timeline: [
          {
            action: 'repair_started',
            notes: 'Checking the compressor.',
            at: '2026-11-16T10:25:00.000Z',
            actorName: 'Aman Verma',
            actorRole: 'technician',
          },
        ],
        quotation: {
          amount: 100,
          currency: 'INR',
          inspectionFee: 0,
          labourFee: 0,
          partsFee: 100,
          notes: 'Clean filters.',
          estimatedDays: 3,
        },
      } as any),
    );

    component.viewJob(mockDashboardData.currentlyActiveJob as any);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.view()).toBe('job-detail');
    expect(compiled.textContent).toContain('Back to My Assigned Jobs');
    expect(compiled.textContent).toContain('Repair Timeline & Activity');
    expect(compiled.textContent).toContain('Checking the compressor.');
    expect(compiled.textContent).not.toContain('Message Customer');
    expect(compiled.textContent).not.toContain('Message Shop');
    expect(compiled.querySelector('.detail-subtabs-nav')?.textContent).not.toContain('Messages');
    expect(compiled.textContent).not.toContain('Direct Communication');

    component.detailTab.set('timeline');
    fixture.detectChanges();
    expect(compiled.querySelector('.timeline-add-note-btn')?.textContent).toContain('Add Note');
  });

  it('should show completed-job details and return to the completed jobs list', () => {
    const route = TestBed.inject(ActivatedRoute);
    route.snapshot.data['technicianView'] = 'completed';
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    component.view.set('job-detail');
    component.details.set({
      ...mockDashboardData.currentlyActiveJob,
      status: 'completed',
      completedAt: '2026-11-18T12:00:00.000Z',
      photos: [],
      location: null,
      serviceType: 'home_service',
      timeline: [],
    } as any);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.page-title')?.textContent?.trim()).toBe('Completed Job Details');
    expect(compiled.textContent).toContain('Completed Jobs');
    expect(compiled.textContent).toContain('Back to Completed Jobs');
    expect(compiled.querySelector('.completed-detail-status')?.textContent).toContain('Completed');
    expect(compiled.querySelector('.detail-subtabs-nav')).not.toBeNull();
    expect(compiled.textContent).toContain('Assigned Details');

    component.backToJobs();
    expect(component.view()).toBe('completed');
    expect(router.navigate).toHaveBeenCalledWith(['/technician/completed-jobs']);
  });

  it('should open the first assigned job directly from the My Assigned Jobs route', () => {
    TestBed.inject(ActivatedRoute).snapshot.data['technicianView'] = 'jobs';
    techniciansService.myJobDetails.and.returnValue(
      of({
        ...mockDashboardData.currentlyActiveJob,
        photos: [],
        location: null,
        serviceType: 'home_service',
        timeline: [],
      } as any),
    );

    const jobsFixture = TestBed.createComponent(ShopTechnicianPortalPage);
    jobsFixture.detectChanges();

    expect(jobsFixture.componentInstance.view()).toBe('job-detail');
    expect((jobsFixture.nativeElement as HTMLElement).textContent).toContain('Job Details');
    expect((jobsFixture.nativeElement as HTMLElement).textContent).toContain('Back to My Assigned Jobs');
    jobsFixture.destroy();
  });
});
