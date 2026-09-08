declare module "@izworskic/national-outdoor-core" {
  export function ageMinutes(value: string | null, now?: number): number | null;
  export function freshness(value: string | null, staleAfterMinutes: number, now?: number): {
    age_minutes: number | null;
    stale: boolean | null;
    status: "current" | "stale" | "unknown";
  };
  export function percentileBand(value: number | null, stats: Record<string, number>): {
    label: string;
    code: string;
    confidence: string;
  };
}
