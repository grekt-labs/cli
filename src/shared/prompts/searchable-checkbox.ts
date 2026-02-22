/**
 * Searchable multi-select checkbox prompt.
 *
 * Built on @inquirer/core. Provides type-to-filter on top of
 * standard checkbox behavior (space to toggle, enter to confirm).
 */

import {
  createPrompt,
  useState,
  useKeypress,
  usePrefix,
  usePagination,
  useMemo,
  isEnterKey,
  isUpKey,
  isDownKey,
  isSpaceKey,
  isBackspaceKey,
  Separator,
} from "@inquirer/core";
import { colors } from "#/shared/ui/ui";

export interface SearchableChoice<Value> {
  name: string;
  value: Value;
  checked?: boolean;
  disabled?: boolean | string;
}

interface SearchableCheckboxConfig<Value> {
  message: string;
  choices: ReadonlyArray<SearchableChoice<Value> | Separator>;
  pageSize?: number;
}

type Item<Value> = SearchableChoice<Value> & { checked: boolean };

function isSelectableItem<Value>(item: Item<Value> | Separator): item is Item<Value> {
  return !Separator.isSeparator(item) && !item.disabled;
}

export const searchableCheckbox = createPrompt(
  <Value>(config: SearchableCheckboxConfig<Value>, done: (value: Value[]) => void) => {
    const { pageSize = 15 } = config;

    const [searchTerm, setSearchTerm] = useState("");
    const [status, setStatus] = useState<"idle" | "done">("idle");
    const [activeIndex, setActiveIndex] = useState(0);
    const [items, setItems] = useState<Array<Item<Value> | Separator>>(() =>
      config.choices.map((choice) => {
        if (Separator.isSeparator(choice)) return choice;
        return { ...choice, checked: choice.checked ?? false };
      }),
    );

    const prefix = usePrefix({ status: status === "done" ? "done" : "idle" });

    // Filter items based on search term
    const filteredItems = useMemo(() => {
      if (!searchTerm) return items;

      const lower = searchTerm.toLowerCase();
      return items.filter((item) => {
        if (Separator.isSeparator(item)) return false;
        return item.name.toLowerCase().includes(lower);
      });
    }, [items, searchTerm]);

    useKeypress((key, rl) => {
      if (isEnterKey(key)) {
        const selection = items
          .filter((item): item is Item<Value> => !Separator.isSeparator(item) && item.checked)
          .map((item) => item.value);
        setStatus("done");
        done(selection);
        return;
      }

      if (isUpKey(key)) {
        let next = activeIndex - 1;
        if (next < 0) next = filteredItems.length - 1;
        const start = next;
        while (!isSelectableItem(filteredItems[next])) {
          next--;
          if (next < 0) next = filteredItems.length - 1;
          if (next === start) break;
        }
        setActiveIndex(next);
        return;
      }

      if (isDownKey(key)) {
        let next = activeIndex + 1;
        if (next >= filteredItems.length) next = 0;
        const start = next;
        while (!isSelectableItem(filteredItems[next])) {
          next++;
          if (next >= filteredItems.length) next = 0;
          if (next === start) break;
        }
        setActiveIndex(next);
        return;
      }

      if (isSpaceKey(key)) {
        const activeItem = filteredItems[activeIndex];
        if (activeItem && isSelectableItem(activeItem)) {
          setItems(
            items.map((item) => {
              if (Separator.isSeparator(item)) return item;
              if (item.value === activeItem.value) {
                return { ...item, checked: !item.checked };
              }
              return item;
            }),
          );
        }
        rl.clearLine(0);
        return;
      }

      if (isBackspaceKey(key)) {
        setSearchTerm(searchTerm.slice(0, -1));
        setActiveIndex(0);
        rl.clearLine(0);
        return;
      }

      // Printable character — append to search
      if (key.name !== "tab" && !key.ctrl && !key.meta && rl.line) {
        setSearchTerm(rl.line);
        setActiveIndex(0);
      }
    });

    if (status === "done") {
      const selection = items
        .filter((item): item is Item<Value> => !Separator.isSeparator(item) && item.checked)
        .map((item) => item.name);
      const answer = selection.length > 0 ? colors.highlight(selection.join(", ")) : colors.dim("none");
      return `${prefix} ${config.message} ${answer}`;
    }

    const page = usePagination({
      items: filteredItems,
      active: activeIndex,
      pageSize,
      renderItem: ({ item, isActive }) => {
        if (Separator.isSeparator(item)) {
          return `  ${item.separator}`;
        }

        if (item.disabled) {
          const label = typeof item.disabled === "string" ? item.disabled : "disabled";
          return colors.dim(`  ${item.name} (${label})`);
        }

        const checkbox = item.checked
          ? colors.highlight(colors.bold("◼"))
          : colors.dim("◻");
        const cursor = isActive ? colors.highlight(colors.bold("❯")) : " ";
        const name = isActive ? colors.bold(item.name) : colors.dim(item.name);
        return `${cursor} ${checkbox} ${name}`;
      },
    });

    const searchText = searchTerm || colors.dim("Search to filter...");
    const hintsText = `${colors.highlight("space")} ${colors.dim("select")}  ${colors.highlight("enter")} ${colors.dim("confirm")}`;
    const boxWidth = 36;
    const searchBox = [
      `  ${colors.dim("┌" + "─".repeat(boxWidth) + "┐")}`,
      `  ${colors.dim("│")} ${searchText}${" ".repeat(Math.max(0, boxWidth - 1 - (searchTerm?.length ?? 22)))}${colors.dim("│")}`,
      `  ${colors.dim("└" + "─".repeat(boxWidth) + "┘")}`,
      `  ${hintsText}`,
    ].join("\n");

    return [
      `${prefix} ${config.message}`,
      searchBox,
      page,
    ].join("\n");
  },
);
