"use client";

import { useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { InterfaceLanguageContext } from "./interface-language-context";
import { AppIcon } from "./app-icon";
import { filterChildOptions, type ChildPickerOption } from "@/lib/child-search";
import styles from "./child-picker.module.css";

type Props = {
  options: readonly ChildPickerOption[];
  label?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  className?: string;
};

const contextLabels: Record<string, readonly string[]> = {
  "All records": ["All records", "Todos os registros", "Todos los registros"],
  "Choose a child you can contribute to": ["Choose a child you can contribute to", "Escolha uma criança para a qual pode contribuir", "Elija un menor para el que pueda contribuir"],
  "No contribution permission for a shared child": ["No contribution permission for a shared child", "Nenhuma criança com permissão de contribuição", "Ningún menor con permiso de contribución"],
};

export function ChildPicker({ options, label, value, defaultValue = "", onValueChange, name, required = false, disabled = false, emptyLabel, className = "" }: Props) {
  const language = useContext(InterfaceLanguageContext);
  const languageIndex = language === "pt" ? 1 : language === "es" ? 2 : 0;
  const text = (...values: string[]) => values[languageIndex];
  const fieldLabel = label ?? text("Child", "Criança", "Menor");
  const placeholder = emptyLabel ? contextLabels[emptyLabel]?.[languageIndex] ?? emptyLabel : text("Choose a child", "Escolha uma criança", "Elija un menor");
  const id = useId();
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null), select = useRef<HTMLSelectElement>(null);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [active, setActive] = useState(0), [invalid, setInvalid] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const selected = value ?? internalValue;
  const choices: ChildPickerOption[] = useMemo(() => [{ value: "", label: placeholder, disabled: required }, ...options.filter(option => option.value !== "").map(option => option.value === "all" && contextLabels[option.label] ? { ...option, label: contextLabels[option.label][languageIndex] } : option)], [options, placeholder, required, languageIndex]);
  const current = choices.find(option => option.value === selected);
  const selectedValue = current ? selected : "";
  const filtered = useMemo(() => filterChildOptions(choices, query).filter(option => !option.disabled), [choices, query]);
  const highlighted = filtered[Math.min(active, filtered.length - 1)];

  const close = useCallback((focus = false) => {
    setOpen(false);
    if (focus) trigger.current?.focus({ preventScroll: true });
  }, []);
  const choose = (next: string) => {
    if (disabled || !choices.some(option => option.value === next && !option.disabled)) return;
    if (value === undefined) setInternalValue(next);
    setInvalid(false); onValueChange?.(next); close(true);
  };
  const show = () => {
    if (disabled) return;
    setQuery(""); setActive(Math.max(0, choices.filter(option => !option.disabled).findIndex(option => option.value === selectedValue))); setOpen(true);
  };
  const updatePosition = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect(); if (!rect) return;
    const viewport = window.visualViewport;
    const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
    const top = viewport?.offsetTop ?? 0;
    const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 24);
    const below = bottom - rect.bottom - 12, above = rect.top - top - 12;
    const upwards = below < 220 && above > below;
    const height = Math.min(350, Math.max(100, upwards ? above : below));
    const next = { width, maxHeight: height, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: upwards ? Math.max(top + 12, rect.top - height - 6) : rect.bottom + 6 };
    setPosition(previous => Object.entries(next).every(([key, val]) => previous[key as keyof CSSProperties] === val) ? previous : next);
  }, []);
  useLayoutEffect(() => {
    if (!open || disabled) { panel.current?.hidePopover(); return; }
    updatePosition(); panel.current?.showPopover(); search.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(); };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    return () => { window.removeEventListener("pointerdown", outside); window.removeEventListener("resize", updatePosition); window.removeEventListener("scroll", updatePosition, true); window.visualViewport?.removeEventListener("resize", updatePosition); };
  }, [open, disabled, close, updatePosition]);
  useEffect(() => {
    if (open && highlighted) document.getElementById(`${id}-option-${filtered.indexOf(highlighted)}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, query, id, highlighted, filtered]);
  useEffect(() => {
    const form = select.current?.form;
    const reset = () => { if (value === undefined) setInternalValue(defaultValue); setInvalid(false); close(); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue, value, close]);
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive(index => filtered.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) % filtered.length : 0); }
    else if (event.key === "Enter") { event.preventDefault(); if (highlighted) choose(highlighted.value); }
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (event.key === "Tab") close(true);
  };

  return <div ref={root} className={`field ${styles.root} ${className}`} data-no-translate>
    <span id={`${id}-label`}>{fieldLabel}</span>
    <button ref={trigger} className={styles.trigger} type="button" role="combobox" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open && !disabled} aria-controls={`${id}-list`} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined} disabled={disabled} onClick={() => open ? close() : show()} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(); } }}>
      <AppIcon name="search" size={18}/><span id={`${id}-value`} className={!selectedValue ? styles.placeholder : undefined}>{current?.label || placeholder}</span><AppIcon name="chevron-up" size={15} className={open ? styles.up : styles.down}/>
    </button>
    <select ref={select} className={styles.nativeSelect} name={name} value={selectedValue} disabled={disabled} required={required} tabIndex={-1} aria-hidden="true" onChange={event => choose(event.target.value)} onInvalid={event => { event.preventDefault(); setInvalid(true); show(); }}>
      {choices.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
    <div ref={panel} popover="manual" className={styles.panel} style={position} onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node | null)) close(); }}>
      <div className={styles.search}><AppIcon name="search" size={18}/><input ref={search} type="search" value={query} autoComplete="off" aria-label={text("Search child name", "Pesquisar nome da criança", "Buscar nombre del menor")} placeholder={text("Type the child's name…", "Digite o nome da criança…", "Escriba el nombre del menor…")} aria-controls={`${id}-list`} aria-activedescendant={highlighted ? `${id}-option-${filtered.indexOf(highlighted)}` : undefined} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={onSearchKey}/>{query && <button type="button" aria-label={text("Clear search", "Limpar busca", "Borrar búsqueda")} onClick={() => { setQuery(""); setActive(0); search.current?.focus(); }}><AppIcon name="close" size={16}/></button>}</div>
      <div role="listbox" id={`${id}-list`} aria-labelledby={`${id}-label`} className={styles.results}>{filtered.map((option, index) => <button type="button" role="option" key={option.value} id={`${id}-option-${index}`} aria-selected={selectedValue === option.value} tabIndex={-1} data-highlighted={highlighted?.value === option.value || undefined} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(option.value)}><span>{option.label}{option.description && <small>{option.description}</small>}</span>{selectedValue === option.value && <AppIcon name="check" size={17}/>}</button>)}</div>
      <p className={styles.summary} role="status" aria-live="polite">{filtered.length ? text(`${filtered.length} result${filtered.length === 1 ? "" : "s"}`, `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`, `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`) : text("No children found. Try another name.", "Nenhuma criança encontrada. Tente outro nome.", "No se encontraron menores. Pruebe otro nombre.")}</p>
    </div>
    {invalid && <small id={`${id}-error`} className={styles.error} role="alert">{text("Choose a child to continue.", "Escolha uma criança para continuar.", "Elija un menor para continuar.")}</small>}
  </div>;
}
