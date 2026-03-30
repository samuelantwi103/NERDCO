/**
 * Centralised polling intervals (ms) for useAutoRefresh hooks.
 * Keeping these in one place prevents data-age inconsistencies across pages.
 */
export const POLLING = {
  DASHBOARD:   10_000,
  FLEET:       10_000,
  ANALYTICS:   15_000,
  FIELD:       15_000,
  ADMIN:       30_000,
  CAPACITY:    30_000,
  SIMULATION:   3_000,  // fast polling for vehicle simulation page
} as const;
