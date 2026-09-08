import data from "./data/cloud-climatology.json";

export interface MonthlyCloudClimatology {
  month: number;
  expectedTransmission: number;
  clearFraction: number;
  blockedFraction: number;
  observations: number;
}

export const CLOUD_CLIMATOLOGY = data;

export function cloudClimatology(monthIndex: number): MonthlyCloudClimatology {
  const month = data.months[monthIndex];
  if (!month) throw new RangeError(`Invalid zero-based month index: ${monthIndex}`);
  return month;
}
