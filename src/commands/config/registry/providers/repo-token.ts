import { input, password } from "@inquirer/prompts";

export interface RepoTokenResult {
  host: string;
  token: string;
}

export async function promptRepoToken(): Promise<RepoTokenResult> {
  const host = await input({
    message: "Git host (e.g., gitlab.com, github.mycompany.com):",
    validate: (value) => {
      if (!value.trim()) return "Host is required";
      return true;
    },
  });

  const token = await password({
    message: "Token:",
    mask: "*",
    validate: (value) => {
      if (!value.trim()) return "Token is required";
      return true;
    },
  });

  return { host, token };
}
