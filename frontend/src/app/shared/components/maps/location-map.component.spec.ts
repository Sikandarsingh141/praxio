import { TestBed } from '@angular/core/testing';
import { LocationMapComponent } from './location-map.component';

describe('LocationMapComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationMapComponent],
    }).compileComponents();
  });

  it('embeds a map and links to Google Maps for valid coordinates', () => {
    const fixture = TestBed.createComponent(LocationMapComponent);
    fixture.componentRef.setInput('location', {
      latitude: 28.6139,
      longitude: 77.209,
    });
    fixture.detectChanges();

    const iframe = fixture.nativeElement.querySelector('.location-map') as HTMLIFrameElement;
    const link = fixture.nativeElement.querySelector('.map-link') as HTMLAnchorElement;
    expect(iframe.src).toContain('openstreetmap.org/export/embed.html');
    expect(iframe.src).toContain('marker=28.6139,77.209');
    expect(link.href).toContain('28.6139,77.209');
  });

  it('does not attempt to render an invalid or missing location', () => {
    const fixture = TestBed.createComponent(LocationMapComponent);
    fixture.componentRef.setInput('location', { latitude: 91, longitude: 10 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.location-map')).toBeNull();
    expect(fixture.nativeElement.querySelector('.map-link')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No valid map coordinates are saved.');
  });
});
