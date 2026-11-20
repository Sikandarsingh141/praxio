import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CustomerPortalService } from '../../../services/customer-portal.service';
import { JobListItem } from '../../../../shared/models/job.models';
import { JobSharedService } from '../../../../shared/services/job-shared.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { CustomerNewJobsListingPage } from '../../new-jobs/listing/customer-new-jobs-listing.page';
import { CustomerPendingJobsListingPage } from './customer-pending-jobs-listing.page';
import { CustomerActiveJobsListingPage } from '../../active-jobs/listing/customer-active-jobs-listing.page';
import { CustomerCompletedJobsListingPage } from '../../completed-jobs/listing/customer-completed-jobs-listing.page';

describe('Customer job listing Request IDs', () => {
  it('links Request IDs to the details page in all repair listings', async () => {
    const baseJob: Omit<JobListItem, 'status'> = {
      id: '6afeb5aea4aa063abd00e86f',
      title: 'Phone',
      description: 'Screen issue',
      createdAt: '2026-11-20T00:00:00.000Z',
      quotationSubmitted: true,
    };
    const jobs = {
      customerJobs: jasmine
        .createSpy()
        .and.callFake((status: string) =>
          of([{ ...baseJob, status }]),
        ),
      filterAndSort: (items: JobListItem[]) => items,
      errorMessage: () => 'Jobs could not be loaded.',
    };

    await TestBed.configureTestingModule({
      imports: [
        CustomerNewJobsListingPage,
        CustomerPendingJobsListingPage,
        CustomerActiveJobsListingPage,
        CustomerCompletedJobsListingPage,
      ],
      providers: [
        provideRouter([]),
        { provide: JobSharedService, useValue: jobs },
        {
          provide: CustomerPortalService,
          useValue: { updateQuotationStatus: jasmine.createSpy().and.returnValue(of({})) },
        },
        {
          provide: ToastService,
          useValue: { success: jasmine.createSpy(), error: jasmine.createSpy() },
        },
      ],
    }).compileComponents();

    const verifyRequestId = <T>(
      component: Type<T>,
      status: string,
      detailRoute: string,
    ): void => {
      const fixture = TestBed.createComponent(component);
      fixture.detectChanges();

      expect(jobs.customerJobs).toHaveBeenCalledWith(status);
      expect(
        fixture.nativeElement.querySelector('thead .th-job-id')?.textContent.trim(),
      ).toBe('Request ID');
      const requestIdLink = fixture.nativeElement.querySelector(
        'tbody .td-job-id .job-id-text',
      ) as HTMLAnchorElement;
      expect(requestIdLink.textContent.trim()).toBe('#BD00E86F');
      expect(requestIdLink.href).toContain(`${detailRoute}/${baseJob.id}`);
      fixture.destroy();
    };

    verifyRequestId(CustomerNewJobsListingPage, 'new', '/customer/jobs/new-jobs');
    verifyRequestId(CustomerPendingJobsListingPage, 'pending', '/customer/jobs/pending-jobs');
    verifyRequestId(CustomerActiveJobsListingPage, 'active', '/customer/jobs/active-jobs');
    verifyRequestId(
      CustomerCompletedJobsListingPage,
      'completed',
      '/customer/jobs/completed-jobs',
    );
  });
});
