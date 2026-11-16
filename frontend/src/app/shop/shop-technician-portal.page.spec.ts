import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
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
});
