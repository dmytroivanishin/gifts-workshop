"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, X, Plus } from "lucide-react";
import VirtualScrollList from "@/components/shared/VirtualScrollList";
import SearchInput from "@/components/shared/SearchInput";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allowCreate?: boolean;
  createLabel?: string;
  multiple?: boolean;
  className?: string;
  onCreate?: (search: string) => Promise<string>;
  // When true, `options` is assumed to already be the server-filtered/paginated page for the
  // current `search` value — the local client-side filter is skipped and `onSearchChange` (not
  // the local useMemo) is what narrows the list.
  serverSearch?: boolean;
  // Debounced internally (~300ms) before firing, so a caller wiring this to a network request
  // isn't flooded on every keystroke.
  onSearchChange?: (query: string) => void;
  // Fired when the virtualized dropdown list is scrolled near its end — wired to a caller's
  // "load next page" for an infinite-scroll options list.
  onEndReached?: () => void;
  // Resolves a display label for an already-selected value that isn't in the current `options`
  // page (e.g. a server-search combobox showing a chip for a value outside the loaded page) —
  // used only for the selected-chip display, never for the dropdown's own option list.
  resolveLabel?: (value: string) => string | undefined;
  // Whether the dropdown shows its search box. Defaults to on only for long lists (more than 6
  // options) or server-search mode, so a short pick-one list (a status, an area) stays compact.
  searchable?: boolean;
  // Whether the trigger shows the clear (x) button. Turn off for a required single choice.
  clearable?: boolean;
  // Marks the trigger with the destructive outline (same as an invalid text field).
  invalid?: boolean;
  "aria-invalid"?: boolean;
  id?: string;
}

export default function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  allowCreate = false,
  createLabel = 'Create new option: "{search}"',
  multiple = false,
  className = "",
  onCreate,
  serverSearch = false,
  onSearchChange,
  onEndReached,
  resolveLabel,
  searchable,
  clearable = true,
  invalid = false,
  "aria-invalid": ariaInvalid,
  id,
}: ComboboxProps) {
  const showSearch = searchable ?? (serverSearch || allowCreate || options.length > 6);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchInput = (query: string) => {
    setSearch(query);
    if (!serverSearch || !onSearchChange) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(query);
    }, 300);
  };

  const selectedValues = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : [];
    }
    return value ? [value as string] : [];
  }, [value, multiple]);

  // Filter options based on search query — skipped entirely in server-search mode, where
  // `options` is already the caller's current search-narrowed page.
  const filteredOptions = useMemo(() => {
    if (serverSearch) return options;
    if (!search) return options;
    const query = search.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, search, serverSearch]);

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      if (selectedValues.includes(optionValue)) {
        onChange(selectedValues.filter((selectedValue) => selectedValue !== optionValue));
      } else {
        onChange([...selectedValues, optionValue]);
      }
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
    setSearch("");
  };

  const handleRemove = (optionValue: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (multiple) {
      onChange(selectedValues.filter((selectedValue) => selectedValue !== optionValue));
    } else {
      onChange("");
    }
  };

  const handleCreate = async () => {
    if (!search || !allowCreate) return;
    const trimmed = search.trim();
    if (!trimmed) return;

    // Check if it already exists in options
    const exists = options.find((option) => option.label.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      handleSelect(exists.value);
    } else if (onCreate) {
      try {
        const newId = await onCreate(trimmed);
        if (newId) {
          handleSelect(newId);
        }
      } catch (error) {
        console.error("Failed to create option inside Combobox", error);
      }
    } else {
      handleSelect(trimmed);
    }
    setSearch("");
  };

  const selectedOptions = useMemo(() => {
    return selectedValues.map((optionValue) => {
      const option = options.find((candidate) => candidate.value === optionValue);
      if (option) return option;
      const resolved = resolveLabel?.(optionValue);
      return { value: optionValue, label: resolved ?? optionValue };
    });
  }, [selectedValues, options, resolveLabel]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Target trigger area */}
      <PopoverAnchor asChild>
      <div
        id={id}
        onClick={() => setIsOpen(!isOpen)}
        aria-invalid={invalid || ariaInvalid || undefined}
        className="min-h-10 w-full flex flex-wrap items-center justify-between gap-1.5 px-3.5 py-1.5 rounded-lg border border-border bg-card cursor-pointer focus-within:border-primary aria-invalid:border-destructive transition-colors"
      >
        {selectedOptions.length === 0 ? (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        ) : (
          !multiple ? (
            // A single choice reads as the field's value, not as a removable chip.
            <span className="text-sm text-foreground">{selectedOptions[0].label}</span>
          ) : (
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs font-semibold px-2 py-1 rounded-md border border-border transition-colors hover:bg-secondary/80"
              >
                {option.label}
                <button
                  type="button"
                  onClick={(event) => handleRemove(option.value, event)}
                  className="rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          )
        )}
        <div className="flex items-center gap-1.5 ml-auto pl-1 pr-1.5">
          {clearable && selectedValues.length > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChange(multiple ? [] : "");
                setSearch("");
              }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted/40"
            >
              <X size={12} />
            </button>
          )}
          <ChevronsUpDown size={14} className="text-muted-foreground" />
        </div>
      </div>
      </PopoverAnchor>

      {/* Dropdown menu: rendered in a portal so a panel's overflow-hidden never clips it. */}
        <PopoverContent
          align="start"
          sideOffset={6}
          collisionPadding={12}
          // A click on the trigger itself is handled by the trigger's own toggle.
          onInteractOutside={(event) => {
            if (containerRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          className="admin-area w-(--radix-popover-trigger-width) gap-0 overflow-hidden rounded-xl border border-border bg-popover p-0 font-sans shadow-lg ring-0"
        >
          {showSearch && (
            <div className="p-2 border-b border-border">
              <SearchInput
                value={search}
                onChange={handleSearchInput}
                placeholder={searchPlaceholder}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && allowCreate && search) {
                    event.preventDefault();
                    handleCreate();
                  }
                }}
                // Radix focuses the field when the popover opens, so the usual teal focus border would be permanent here.
                inputClassName="h-9 focus:border-border"
              />
            </div>
          )}

          <div className="p-1.5">
            {filteredOptions.length === 0 ? (
              allowCreate && search ? (
                <button
                  type="button"
                  onClick={handleCreate}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-primary hover:bg-muted rounded-lg transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>{createLabel.replace("{search}", search)}</span>
                </button>
              ) : (
                <div className="px-3 py-2.5 text-sm text-muted-foreground text-center">No options found.</div>
              )
            ) : (
              <VirtualScrollList
                items={filteredOptions}
                estimateSize={40}
                className="max-h-56"
                onEndReached={onEndReached}
                renderItem={(option) => {
                  const isChecked = selectedValues.includes(option.value);
                  return (
                    <button
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className="w-full h-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted rounded-lg transition-colors cursor-pointer"
                    >
                      <span className={isChecked ? "font-semibold text-foreground" : "text-muted-foreground"}>
                        {option.label}
                      </span>
                      {isChecked && <Check size={14} className="text-primary" />}
                    </button>
                  );
                }}
              />
            )}
          </div>
        </PopoverContent>
    </div>
    </Popover>
  );
}
