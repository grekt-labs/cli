export interface UpdateCache {
  latestVersion: string; // semver without 'v' prefix, e.g. "5.14.0"
  lastChecked: string; // ISO 8601 timestamp
}
