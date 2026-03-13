import { input, select } from "@inquirer/prompts";
import { confirmSelect } from "#/shared/prompts/prompts";
import { registryProviders } from "#/commands/config/registry/providers";
import { success, info, newline, log, colors } from "#/shared/ui/ui";
import type { LocalConfig } from "@grekt/engine";
import type { RegistryEntry } from "#/registry/registry.types";

export interface RegistryWizardResult {
  localConfig: LocalConfig;
  scopesMissingTokens: string[];
}

/**
 * Self-hosted registry wizard.
 *
 * Asks about artifact organization, then loops through scope + provider config.
 * Mutates and returns the localConfig with new registry entries.
 */
export async function promptRegistries(localConfig: LocalConfig): Promise<RegistryWizardResult> {
  const scopesMissingTokens: string[] = [];

  newline();
  const wantsRegistries = await confirmSelect(
    "Host artifacts in your own Git repos (GitHub/GitLab)?",
    false,
  );

  if (!wantsRegistries) {
    return { localConfig, scopesMissingTokens };
  }

  // Artifact organization (informational)
  const organization = await select({
    message: "Artifact organization:",
    choices: [
      { name: "Monorepo — one repo, multiple registries (recommended)", value: "monorepo" },
      { name: "Single repo — each repository is a registry", value: "single-repo" },
    ],
  });

  if (organization === "monorepo") {
    info("Multiple registries will share a single repository");
  } else {
    info("Each repository acts as its own registry");
  }

  // Registry configuration loop
  let addMore = true;
  while (addMore) {
    newline();
    log(colors.bold("Configure registry scope:"));
    newline();

    const scope = await input({
      message: "Scope (e.g., @myteam):",
      validate: (value) => {
        if (!value.trim()) return "Scope is required";
        const normalized = value.startsWith("@") ? value : `@${value}`;
        if (!/^@[a-z0-9-]+$/.test(normalized)) return "Scope must be @lowercase-alphanumeric";
        return true;
      },
    });

    const normalizedScope = scope.startsWith("@") ? scope : `@${scope}`;

    const provider = await select({
      message: "Registry type:",
      choices: registryProviders.map((p) => ({ name: p.label, value: p })),
    });

    const providerResult = await provider.prompts();

    // Only ask for prefix in monorepo mode (multiple registries sharing one repo)
    let prefix: string | undefined;
    if (organization === "monorepo") {
      newline();
      info("Choose a prefix to avoid name collisions between registries.");
      info("It will be prepended to artifact names (e.g. prefix 'team' → 'team-my-artifact').");
      info("Only affects the published name, not your local files.");
      newline();
      const prefixValue = await input({
        message: "Artifact prefix:",
        validate: (value) => (value.trim() ? true : "Prefix is required in monorepo mode"),
      });
      prefix = prefixValue.trim();
    }

    const entry: RegistryEntry = {
      type: provider.type,
      ...providerResult,
      prefix,
    };

    if (!entry.token) {
      scopesMissingTokens.push(normalizedScope);
    }

    if (!localConfig.registries) {
      localConfig.registries = {};
    }
    localConfig.registries[normalizedScope] = entry;

    newline();
    success(`Registry ${colors.highlight(normalizedScope)} → ${entry.type}://${entry.host}/${entry.project}`);

    addMore = await confirmSelect(
      "Add another registry?",
      false,
    );
  }

  return { localConfig, scopesMissingTokens };
}
