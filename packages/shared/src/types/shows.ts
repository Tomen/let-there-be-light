/**
 * Show information
 */
export interface Show {
  /** Directory name (used as ID) */
  id: string;
  /** Display name */
  name: string;
  /** Whether this is the currently active show */
  isActive: boolean;
}

/**
 * Current show info returned by /api/shows/current
 */
export interface CurrentShow {
  show: string;
  dataDir: string;
}
