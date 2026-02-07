export class RegistryError extends Error {
  readonly code: string;
  readonly details?: string;

  constructor(message: string, code: string, details?: string) {
    super(message);
    this.name = "RegistryError";
    this.code = code;
    this.details = details;
  }
}
