export type ChildPickerOption = { value: string; label: string; description?: string; disabled?: boolean };

export function normaliseChildSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

// Filter only the caller's already-authorised options; never fetch more records.
export function filterChildOptions(options: readonly ChildPickerOption[], query: string): ChildPickerOption[] {
  const words = normaliseChildSearch(query).split(/\s+/).filter(Boolean);
  return options.filter(option => words.every(word => normaliseChildSearch(`${option.label} ${option.description ?? ""}`).includes(word)));
}
