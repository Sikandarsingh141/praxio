export interface RepairRoute {
  distanceMeters: number;
  durationSeconds: number;
  description: string;
  path: Array<{ latitude: number; longitude: number }>;
}
