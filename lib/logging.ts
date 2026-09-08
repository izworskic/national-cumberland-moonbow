export type LogLevel = "info" | "warn" | "error";

export function logEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "test") return;
  const record = JSON.stringify({ timestamp: new Date().toISOString(), level, service: "cumberland-moonbow", event, ...fields });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}

export async function timed<T>(name: string, task: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await task();
    logEvent("info", "dependency_request", { dependency: name, status: "ok", latency_ms: Math.round(performance.now() - start) });
    return result;
  } catch (error) {
    logEvent("warn", "dependency_request", { dependency: name, status: "error", latency_ms: Math.round(performance.now() - start), error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
