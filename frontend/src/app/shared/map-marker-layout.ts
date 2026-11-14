import * as L from 'leaflet';

export const MARKER_SPREAD_RADIUS_PX = 24;

export function groupMarkerPoints<T extends { point: L.Point }>(
  items: T[],
  radius = MARKER_SPREAD_RADIUS_PX,
): T[][] {
  const remaining = [...items];
  const groups: T[][] = [];
  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const group = [seed];
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (remaining[index].point.distanceTo(seed.point) < radius) {
        group.push(remaining.splice(index, 1)[0]);
      }
    }
    groups.push(group);
  }
  return groups;
}

export function markerSpreadOffsets(count: number): L.Point[] {
  return markerRadialOffsets(count, 18, 20, 22);
}

export function spiderfyOffsets(count: number): L.Point[] {
  return markerRadialOffsets(count, 52, 26, 26);
}

function markerRadialOffsets(
  count: number,
  startRadius: number,
  ringGap: number,
  spacing: number,
): L.Point[] {
  if (count <= 0) {
    return [];
  }
  const offsets: L.Point[] = [];
  let remaining = count;
  let ring = 0;
  while (remaining > 0) {
    const radius = startRadius + ring * ringGap;
    const capacity = Math.max(1, Math.floor((2 * Math.PI * radius) / spacing));
    const slots = Math.min(remaining, capacity);
    const startAngle = ring % 2 === 0 ? 0 : Math.PI / slots;
    for (let slot = 0; slot < slots; slot += 1) {
      const angle = startAngle + (slot * 2 * Math.PI) / slots;
      offsets.push(L.point(Math.cos(angle) * radius, Math.sin(angle) * radius));
    }
    remaining -= slots;
    ring += 1;
  }
  return offsets;
}
