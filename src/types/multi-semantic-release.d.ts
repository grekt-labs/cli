declare module "multi-semantic-release" {
  interface ReleaseResult {
    lastRelease: { version: string };
    nextRelease: { version: string; type: string };
    commits: Array<{ message: string }>;
  }

  interface PackageResult {
    name: string;
    result: ReleaseResult | false;
  }

  interface Options {
    dryRun?: boolean;
    debug?: boolean;
  }

  function multirelease(
    packages: string[],
    options?: Options
  ): Promise<PackageResult[]>;

  export default multirelease;
}
