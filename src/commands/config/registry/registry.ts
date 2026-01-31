import { select } from "@inquirer/prompts";
import { registryProviders, promptRepoToken } from "./providers";
import { setRegistry, removeRegistry, setToken, removeToken } from "#/config/project/project";
import { withPromptHandler } from "#/shared/prompts/prompts";
import { success, error, info, colors } from "#/shared/ui/ui";
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

    const entry: RegistryEntry = { type: provider.type, ...(await provider.prompts()) };
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

export async function setTokenInteractive(): Promise<void> {
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
