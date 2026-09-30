import { useEffect, useRef, useState } from 'react';
import { useMenuScene } from './MenuBackdrop';
import type { FloatItem } from './floating';

// Puts a screen's choices on the felt as floating buttons (and optionally a card you write on).
// The DOM keeps an equivalent: visually-hidden real buttons and a real <input>, so keyboard,
// screen readers and mobile keyboards all work; the 3D table is the visible interface.

export interface TableInput {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  mono?: boolean;
  maxLength?: number;
  readOnly?: boolean; // shows a value (e.g. the room code); a click calls onSubmit
  at?: [number, number];
}

export function TableMenu({ items, input, note }: { items: FloatItem[]; input?: TableInput | null; note?: string }) {
  const scene = useMenuScene();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const latestInput = useRef(input);
  latestInput.current = input;

  // push the buttons every render (cheap: unchanged items keep their meshes)
  useEffect(() => {
    scene?.setItems(items);
  });

  useEffect(() => {
    if (!scene) return;
    scene.onCaption = setCaption;
    scene.onInputClick = () => {
      const cur = latestInput.current;
      if (cur?.readOnly) cur.onSubmit();
      else inputRef.current?.focus();
    };
    return () => {
      scene.setItems([]);
      scene.setInput(null);
      scene.onCaption = () => undefined;
      scene.onInputClick = () => undefined;
    };
  }, [scene]);

  useEffect(() => {
    if (!scene) return;
    scene.setInput(
      input
        ? { label: input.label, value: input.value, placeholder: input.placeholder, focused: focused && !input.readOnly, mono: input.mono }
        : null,
      input?.at,
    );
  }, [scene, input?.label, input?.value, input?.placeholder, input?.mono, input?.readOnly, input?.at?.[0], input?.at?.[1], focused, input]);

  // writable card: focus it straight away so you can just type
  useEffect(() => {
    if (input && !input.readOnly) inputRef.current?.focus();
  }, [input?.label]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {input && !input.readOnly && (
        <input
          ref={inputRef}
          className="sr-only-input"
          aria-label={input.label}
          value={input.value}
          maxLength={input.maxLength}
          autoComplete="off"
          onChange={(e) => input.onChange(input.mono ? e.target.value.toUpperCase() : e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') input.onSubmit();
          }}
        />
      )}
      <nav className="sr-only" aria-label="Opciones de la mesa">
        {items.map((it) => (
          <button key={it.id} type="button" disabled={it.disabled} aria-pressed={it.selected} onClick={it.onPick}>
            {it.label}{it.sub ? ` (${it.sub})` : ''}
          </button>
        ))}
      </nav>
      <div className="table-caption" aria-live="polite">{caption ?? note ?? ''}</div>
    </>
  );
}
