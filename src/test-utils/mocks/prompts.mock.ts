import { vi, type Mock } from "vitest";

export interface MockInquirer {
  confirm: Mock;
  input: Mock;
  select: Mock;
  checkbox: Mock;
  password: Mock;
}

/**
 * Creates a mock @inquirer/prompts module with configurable defaults.
 * Use with vi.mock("@inquirer/prompts", () => createMockInquirer(...))
 */
export function createMockInquirer(
  defaults: Partial<{
    confirm: boolean;
    input: string;
    select: string;
    checkbox: string[];
    password: string;
  }> = {},
): MockInquirer {
  return {
    confirm: vi.fn(() => Promise.resolve(defaults.confirm ?? true)),
    input: vi.fn(() => Promise.resolve(defaults.input ?? "")),
    select: vi.fn(() => Promise.resolve(defaults.select ?? "")),
    checkbox: vi.fn(() => Promise.resolve(defaults.checkbox ?? [])),
    password: vi.fn(() => Promise.resolve(defaults.password ?? "")),
  };
}

/**
 * Creates a mock for #/shared/prompts/searchable-checkbox.
 */
export function createMockSearchableCheckbox(
  returnValue: string[] = [],
): { searchableCheckbox: Mock } {
  return {
    searchableCheckbox: vi.fn(() => Promise.resolve(returnValue)),
  };
}
