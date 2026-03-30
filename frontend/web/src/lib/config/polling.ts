/**
 * Centralised polling intervals (ms) for useAutoRefresh hooks.
 * Keeping these in one place prevents data-age inconsistencies across pages.
 */
export const POLLING = {
  DASHBOARD:    1_000,  // 1 s for live demo
  FLEET:        5_000,
  ANALYTICS:    5_000,
  FIELD:        3_000,
  ADMIN:       30_000,
  CAPACITY:    30_000,
  SIMULATION:   1_000,  // fast polling for vehicle simulation page
} as const;
