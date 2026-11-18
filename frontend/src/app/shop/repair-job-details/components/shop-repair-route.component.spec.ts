import { ElementRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ShopRepairRouteComponent } from './shop-repair-route.component';
import { ShopRepairRequestsService } from '../../repair-requests/shop-repair-requests.service';

describe('ShopRepairRouteComponent', () => {
  it('does not resize the Leaflet map after the route component is destroyed', () => {
    const requests = jasmine.createSpyObj<ShopRepairRequestsService>(
      'ShopRepairRequestsService',
      ['getDirections'],
    );
    const component = new ShopRepairRouteComponent(requests);
    const container = document.createElement('div');
    container.style.width = '320px';
    container.style.height = '240px';
    document.body.appendChild(container);
    const animationFrames: FrameRequestCallback[] = [];
    spyOn(window, 'requestAnimationFrame').and.callFake((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });

    component['mapElementRef'] = new ElementRef(container);
    component.requestId = 'request-id';
    component.shopLocation = { latitude: 30.72, longitude: 76.72 };
    component.customerLocation = { latitude: 30.7, longitude: 76.7 };
    component.directionsLoader = () =>
      of({
        distanceMeters: 2400,
        durationSeconds: 300,
        description: 'Fastest route',
        path: [
          { latitude: 30.72, longitude: 76.72 },
          { latitude: 30.7, longitude: 76.7 },
        ],
      });

    try {
      component.ngAfterViewInit();
      const resizeMap = animationFrames[animationFrames.length - 1];
      component.ngOnDestroy();

      expect(() => resizeMap(0)).not.toThrow();
    } finally {
      component.ngOnDestroy();
      container.remove();
    }
  });

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
