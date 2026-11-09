import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Overlay } from '@angular/cdk/overlay';
import { LoaderService } from './loader.service';

describe('LoaderService', () => {
  let service: LoaderService;
  let attached: boolean;
  let overlayRef: {
    hasAttached: jasmine.Spy;
    attach: jasmine.Spy;
    detach: jasmine.Spy;
    dispose: jasmine.Spy;
  };

  beforeEach(() => {
    attached = false;
    overlayRef = {
      hasAttached: jasmine.createSpy().and.callFake(() => attached),
      attach: jasmine.createSpy().and.callFake(() => {
        attached = true;
      }),
      detach: jasmine.createSpy().and.callFake(() => {
        attached = false;
      }),
      dispose: jasmine.createSpy(),
    };
    const positionStrategy = {
      centerHorizontally: jasmine.createSpy().and.returnValue(null),
      centerVertically: jasmine.createSpy().and.returnValue(null),
    };
    positionStrategy.centerHorizontally.and.returnValue(positionStrategy);
    positionStrategy.centerVertically.and.returnValue(positionStrategy);

    TestBed.configureTestingModule({
      providers: [
        LoaderService,
        {
          provide: Overlay,
          useValue: {
            create: jasmine.createSpy().and.returnValue(overlayRef),
            position: () => ({ global: () => positionStrategy }),
          },
        },
      ],
    });
    service = TestBed.inject(LoaderService);
  });

  it('delays the overlay and cancels it when a fast operation completes', fakeAsync(() => {
    const owner = {};
    service.showLoader(owner);

    tick(149);
    expect(overlayRef.attach).not.toHaveBeenCalled();

    service.hideLoader(owner);
    tick(1);
    expect(overlayRef.attach).not.toHaveBeenCalled();
  }));

  it('shows once and waits for every concurrent owner before hiding', fakeAsync(() => {
    const firstOwner = {};
    const secondOwner = {};
    service.showLoader(firstOwner);
    service.showLoader(secondOwner);

    tick(150);
    expect(overlayRef.attach).toHaveBeenCalledTimes(1);

    service.hideLoader(firstOwner);
    expect(overlayRef.detach).not.toHaveBeenCalled();

    service.hideLoader(secondOwner);
    expect(overlayRef.detach).toHaveBeenCalledTimes(1);
  }));
});
