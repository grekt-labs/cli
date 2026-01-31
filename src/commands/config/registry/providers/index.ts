import { gitlabProvider } from "./gitlab";
import { githubProvider } from "./github";
import { promptRepoToken } from "./repo-token";
import type { RegistryProvider } from "#/registry/registry.types";

export const registryProviders: RegistryProvider[] = [
  gitlabProvider,
  githubProvider,
];

export { gitlabProvider, githubProvider, promptRepoToken };
