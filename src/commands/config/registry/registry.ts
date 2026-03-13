import { select, password, input, confirm } from "@inquirer/prompts";
import { registryProviders, promptRepoToken } from "./providers";
import { setRegistry, removeRegistry, setToken, removeToken, getLocalConfig } from "#/config/project/project";
import { withPromptHandler } from "#/shared/prompts/prompts";
import { success, error, info, newline, colors } from "#/shared/ui/ui";
import type { RegistryEntry } from "#/registry/registry.types";

export async function setRegistryInteractive(scope: string | undefined): Promise<void> {
  if (!scope) {
    error("Scope required. Usage:");
    info("  grekt config registry set @myteam");
    process.exit(1);
  }

  if (!scope.startsWith("@")) {
    error("Scope must start with @");
    process.exit(1);
  }

  await withPromptHandler(async () => {
    const provider = await select({
      message: "Registry type:",
      choices: registryProviders.map((p) => ({ name: p.label, value: p })),
    });

    const providerResult = await provider.prompts();

    const isMonorepo = await confirm({
      message: "Is this a monorepo setup (multiple registries sharing one repo)?",
      default: false,
    });

    let prefix: string | undefined;
    if (isMonorepo) {
      newline();
      info("Choose a prefix to avoid name collisions between registries.");
      info("It will be prepended to artifact names (e.g. prefix 'team' → 'team-my-artifact').");
      info("Only affects the published name, not your local files.");
      newline();
      prefix = (await input({
        message: "Artifact prefix:",
        validate: (value) => (value.trim() ? true : "Prefix is required in monorepo mode"),
      })).trim();
    }

    const entry: RegistryEntry = {
      type: provider.type,
      ...providerResult,
      prefix,
    };
    setRegistry(scope, entry);
    success(`Registry ${colors.highlight(scope)} → ${entry.type}://${entry.host}/${entry.project}`);
  });
}

export async function unsetRegistry(scope: string | undefined): Promise<void> {
  if (!scope) {
    error("Scope required. Usage:");
    info("  grekt config registry unset @myteam");
    process.exit(1);
  }

  if (!scope.startsWith("@")) {
    error("Scope must start with @");
    process.exit(1);
  }
  removeRegistry(scope);
  success(`Registry ${colors.highlight(scope)} removed`);
}

export async function setTokenInteractive(scope?: string): Promise<void> {
  // If scope starts with @, update the token in the existing registry entry
  if (scope?.startsWith("@")) {
    await withPromptHandler(async () => {
      const localConfig = getLocalConfig();
      const registry = localConfig?.registries?.[scope];

      if (!registry) {
        error(`No registry configured for scope ${colors.highlight(scope)}`);
        info("Configure it first with: grekt config registry set " + scope);
        process.exit(1);
      }

      const token = await password({
        message: `Token for ${scope} (${registry.type}):`,
        mask: "*",
        validate: (value) => (value.trim() ? true : "Token is required"),
      });

      const updatedEntry: RegistryEntry = { ...registry, token };
      setRegistry(scope, updatedEntry);
      success(`Token for ${colors.highlight(scope)} updated`);
    });
    return;
  }

  // Default behavior: prompt for a git host token
  await withPromptHandler(async () => {
    const { host, token } = await promptRepoToken();
    setToken(host, token);
    success(`Token for ${colors.highlight(host)} saved`);
  });
}

export async function unsetToken(host: string | undefined): Promise<void> {
  if (!host) {
    error("Host required. Usage:");
    info("  grekt config token unset github.com");
    info("  grekt config token unset gitlab.company.com");
    process.exit(1);
  }

  removeToken(host);
  success(`Token for ${colors.highlight(host)} removed`);
}
