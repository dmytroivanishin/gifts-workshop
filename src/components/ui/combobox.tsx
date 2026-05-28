"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, X, Plus } from "lucide-react";

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | string[];
  onChange: (value: any) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allowCreate?: boolean;
  createLabel?: string;
  multiple?: boolean;
  className?: string;
  onCreate?: (search: string) => Promise<string>;
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
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedValues = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : [];
    }
    return value ? [value as string] : [];
  }, [value, multiple]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const query = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, search]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    if (multiple) {
      if (selectedValues.includes(val)) {
        onChange(selectedValues.filter((v) => v !== val));
      } else {
        onChange([...selectedValues, val]);
      }
    } else {
      onChange(val);
      setIsOpen(false);
    }
    setSearch("");
  };

  const handleRemove = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (multiple) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange("");
    }
  };

  const handleCreate = async () => {
    if (!search || !allowCreate) return;
    const trimmed = search.trim();
    if (!trimmed) return;

    // Check if it already exists in options
    const exists = options.find((opt) => opt.label.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      handleSelect(exists.value);
    } else if (onCreate) {
      try {
        const newId = await onCreate(trimmed);
        if (newId) {
          handleSelect(newId);
        }
      } catch (err) {
        console.error("Failed to create option inside Combobox", err);
      }
    } else {
      handleSelect(trimmed);
    }
    setSearch("");
  };

  const selectedOptions = useMemo(() => {
    return selectedValues.map((val) => {
      const opt = options.find((o) => o.value === val);
      return opt || { value: val, label: val };
    });
  }, [selectedValues, options]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Target trigger area */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-11 w-full flex flex-wrap items-center justify-between gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-card/80 cursor-pointer focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm"
      >
        {selectedOptions.length === 0 ? (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs font-semibold px-2 py-1 rounded-md border border-border/40 shadow-sm transition-all hover:bg-secondary/80"
              >
                {opt.label}
                <button
                  type="button"
                  onClick={(e) => handleRemove(opt.value, e)}
                  className="rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto pl-1">
          {selectedValues.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
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

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-lg backdrop-blur-md overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="p-2 border-b border-border/40">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              onKeyDown={(e) => {
                if (e.key === "Enter" && allowCreate && search) {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              className="w-full px-3 py-1.5 text-sm bg-muted/65 rounded-lg border border-transparent focus:border-border outline-none transition-colors"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
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
              filteredOptions.map((opt) => {
                const isChecked = selectedValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-muted rounded-lg transition-colors cursor-pointer"
                  >
                    <span className={isChecked ? "font-semibold text-foreground" : "text-muted-foreground"}>
                      {opt.label}
                    </span>
                    {isChecked && <Check size={14} className="text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
