import { of, throwError } from 'rxjs';
import { ShopRepairRouteComponent } from './shop-repair-route.component';
import { ShopRepairRequestsService } from '../../repair-requests/shop-repair-requests.service';

describe('ShopRepairRouteComponent', () => {
  it('uses a supplied route loader and reverses directions for a customer view', () => {
    const requests = jasmine.createSpyObj<ShopRepairRequestsService>(
      'ShopRepairRequestsService',
      ['getDirections'],
    );
    const component = new ShopRepairRouteComponent(requests);
    const route = {
      distanceMeters: 2400,
      durationSeconds: 300,
      description: 'Fastest route',
      path: [
        { latitude: 30.72, longitude: 76.72 },
        { latitude: 30.7, longitude: 76.7 },
      ],
    };
    const directionsLoader = jasmine.createSpy().and.returnValue(of(route));
    component.requestId = 'request-id';
    component.shopLocation = { latitude: 30.72, longitude: 76.72 };
    component.customerLocation = { latitude: 30.7, longitude: 76.7 };
    component.directionsLoader = directionsLoader;
    component.reverseDirections = true;

    expect(component.googleDirectionsUrl()).toContain(
      'origin=30.7,76.7&destination=30.72,76.72',
    );
    component.ngAfterViewInit();

    expect(directionsLoader).toHaveBeenCalledWith('request-id');
    expect(component.route()).toEqual(route);
    component.ngOnDestroy();
  });

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
