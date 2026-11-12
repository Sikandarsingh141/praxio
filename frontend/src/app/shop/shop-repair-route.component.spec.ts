import { throwError } from 'rxjs';
import { ShopRepairRouteComponent } from './shop-repair-route.component';
import { ShopRepairRequestsService } from './shop-repair-requests.service';

describe('ShopRepairRouteComponent', () => {
  it('explains that Google Maps is available when the route service returns a generic error', () => {
    const requests = jasmine.createSpyObj<ShopRepairRequestsService>(
      'ShopRepairRequestsService',
      ['getDirections'],
    );
    requests.getDirections.and.returnValue(
      throwError(() => ({
        error: { message: 'An unexpected error occurred' },
      })),
    );
    const component = new ShopRepairRouteComponent(requests);
    component.requestId = 'request-id';
    component.shopLocation = { latitude: 30, longitude: 76 };
    component.customerLocation = { latitude: 27, longitude: 78 };

    component.ngAfterViewInit();

    expect(component.directionsLoading()).toBeFalse();
    expect(component.directionsError()).toBe(
      'Driving directions are temporarily unavailable. Use Get Directions in Google Maps instead.',
    );

    component.ngOnDestroy();
  });
});
