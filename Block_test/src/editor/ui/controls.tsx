import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Json } from '../../engine/types';
import { IMAGE_SOURCES, type PropertyDef } from '../model/elementRegistry';
import { Icon } from './icons';
import styles from './inspector.module.css';

/**
 * Inspector 공용 컨트롤. 값 변경은 onChange(value, gestureId)로만 전달한다.
 * gestureId는 한 번의 포커스/드래그 세션을 하나의 Undo 항목으로 묶기 위해 사용한다.
 */

let sessionSeq = 0;
export function useGestureSession(prefix: string) {
  const id = useRef<string | null>(null);
  return {
    begin: () => (id.current = `${prefix}-${++sessionSeq}`),
    get: () => id.current ?? (id.current = `${prefix}-${++sessionSeq}`),
    end: () => (id.current = null),
  };
}

export interface ControlProps<T> {
  value: T;
  onChange: (value: T, gestureId?: string) => void;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

/* ---------- Number (라벨 드래그로 값 조절) ---------- */
export function NumberField({
  label,
  value,
  onChange,
  disabled,
  onFocus,
  onBlur,
  min,
  max,
  unit,
  locked,
}: ControlProps<number> & { label: string; min?: number; max?: number; unit?: string; locked?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const session = useGestureSession(`num-${label}`);
  const clamp = (v: number) => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, Math.round(v)));

  const startScrub = (e: ReactPointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    const startX = e.clientX;
    const start = value;
    const gid = session.begin();
    onFocus?.();
    const move = (ev: PointerEvent) => onChange(clamp(start + (ev.clientX - startX) * (ev.shiftKey ? 10 : 1)), gid);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      session.end();
      onBlur?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (Number.isFinite(n)) onChange(clamp(n), session.get());
    setDraft(null);
  };

  return (
    <label className={styles.number} data-disabled={disabled}>
      <span className={styles.scrub} onPointerDown={startScrub} title="드래그하여 값 조절 (Shift: ×10)">
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={draft ?? String(value)}
        disabled={disabled}
        onFocus={() => {
          session.begin();
          onFocus?.();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          commit();
          session.end();
          onBlur?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
            onChange(clamp(value + step), session.get());
            setDraft(null);
          }
        }}
      />
      {locked ? (
        <span className={styles.lockIcon}>
          <Icon name="lock" size={12} />
        </span>
      ) : (
        unit && <span className={styles.unit}>{unit}</span>
      )}
    </label>
  );
}

/* ---------- Text / URL / Textarea ---------- */
export function TextField({
  value,
  onChange,
  disabled,
  onFocus,
  onBlur,
  multiline,
  mono,
  placeholder,
}: ControlProps<string> & { multiline?: boolean; mono?: boolean; placeholder?: string }) {
  const session = useGestureSession('text');
  const common = {
    value,
    disabled,
    placeholder,
    onFocus: () => {
      session.begin();
      onFocus?.();
    },
    onBlur: () => {
      session.end();
      onBlur?.();
    },
    onChange: (e: { target: { value: string } }) => onChange(e.target.value, session.get()),
  };
  return multiline ? (
    <textarea className={styles.textarea} rows={3} {...common} />
  ) : (
    <input className={`${styles.input} ${mono ? styles.mono : ''}`} {...common} />
  );
}

/* ---------- Font size (slider + number) ---------- */
export function SliderField({ value, onChange, disabled, onFocus, onBlur, min = 8, max = 96 }: ControlProps<number> & { min?: number; max?: number }) {
  const session = useGestureSession('slider');
  return (
    <div className={styles.sliderRow}>
      <input
        type="range"
        className={styles.slider}
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onPointerDown={() => {
          session.begin();
          onFocus?.();
        }}
        onPointerUp={() => {
          session.end();
          onBlur?.();
        }}
        onChange={(e) => onChange(Number(e.target.value), session.get())}
      />
      <NumberField label="px" value={value} min={min} max={max} onChange={onChange} disabled={disabled} onFocus={onFocus} onBlur={onBlur} />
    </div>
  );
}

/* ---------- Color ---------- */
const SWATCHES = ['#000000', '#1f2328', '#57544f', '#2f6fed', '#1f9d55', '#e8770e', '#d93a3a', '#8b4fd8', '#ffffff'];

export function ColorField({ value, onChange, disabled, onFocus, onBlur }: ControlProps<string>) {
  const session = useGestureSession('color');
  const [hex, setHex] = useState<string | null>(null);
  const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
  return (
    <div>
      <div className={styles.swatches}>
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className={styles.swatch}
            style={{ background: c }}
            aria-pressed={c.toLowerCase() === value.toLowerCase()}
            aria-label={c}
            disabled={disabled}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
      <div className={styles.colorRow}>
        <input
          type="color"
          className={styles.colorInput}
          value={normalized}
          disabled={disabled}
          onFocus={() => {
            session.begin();
            onFocus?.();
          }}
          onBlur={() => {
            session.end();
            onBlur?.();
          }}
          onChange={(e) => onChange(e.target.value, session.get())}
        />
        <input
          className={`${styles.input} ${styles.mono}`}
          value={hex ?? value}
          disabled={disabled}
          onFocus={onFocus}
          onChange={(e) => setHex(e.target.value)}
          onBlur={() => {
            if (hex && /^#[0-9a-f]{6}$/i.test(hex)) onChange(hex.toLowerCase());
            setHex(null);
            onBlur?.();
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
    </div>
  );
}

/* ---------- Segmented (정렬, 제목 레벨) ---------- */
export function Segmented<T extends Json>({
  value,
  onChange,
  disabled,
  options,
}: ControlProps<T> & { options: { value: T; label: ReactNode; title?: string }[] }) {
  return (
    <div className={styles.segmented}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={styles.segment}
          aria-pressed={o.value === value}
          title={o.title}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const ALIGN_OPTIONS = [
  { value: 'left', label: <Icon name="alignLeft" size={14} />, title: '왼쪽 정렬' },
  { value: 'center', label: <Icon name="alignCenter" size={14} />, title: '가운데 정렬' },
  { value: 'right', label: <Icon name="alignRight" size={14} />, title: '오른쪽 정렬' },
];

export const LEVEL_OPTIONS = [1, 2, 3].map((l) => ({ value: l, label: `H${l}`, title: `제목 ${l}` }));

/* ---------- Select ---------- */
export function SelectField({ value, onChange, disabled, onFocus, onBlur, options }: ControlProps<string> & { options: PropertyDef['options'] }) {
  return (
    <select className={styles.select} value={value} disabled={disabled} onFocus={onFocus} onBlur={onBlur} onChange={(e) => onChange(e.target.value)}>
      {(options ?? []).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ---------- List items ---------- */
export function ListItemsField({ value, onChange, disabled, onFocus, onBlur }: ControlProps<string[]>) {
  const session = useGestureSession('list');
  const set = (i: number, text: string) => onChange(value.map((v, idx) => (idx === i ? text : v)), session.get());
  return (
    <div className={styles.listEditor}>
      {value.map((item, i) => (
        <div key={i} className={styles.listRow}>
          <span className={styles.bullet} />
          <input
            className={styles.input}
            value={item}
            disabled={disabled}
            onFocus={() => {
              session.begin();
              onFocus?.();
            }}
            onBlur={() => {
              session.end();
              onBlur?.();
            }}
            onChange={(e) => set(i, e.target.value)}
          />
          <button
            type="button"
            className={styles.ghostButton}
            disabled={disabled || value.length <= 1}
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            aria-label="항목 삭제"
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}
      <button type="button" className={styles.addRow} disabled={disabled} onClick={() => onChange([...value, '새 항목'])}>
        <Icon name="plus" size={12} /> 항목 추가
      </button>
    </div>
  );
}

/* ---------- Table data ---------- */
export function TableDataField({ value, onChange, disabled, onFocus, onBlur }: ControlProps<string[][]>) {
  const session = useGestureSession('table');
  const cols = Math.max(1, ...value.map((r) => r.length));
  const set = (r: number, c: number, text: string) =>
    onChange(value.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? text : cell)) : row)), session.get());
  return (
    <div>
      <div className={styles.tableEditor}>
        <table>
          <tbody>
            {value.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c}>
                    <input
                      value={row[c] ?? ''}
                      disabled={disabled}
                      onFocus={() => {
                        session.begin();
                        onFocus?.();
                      }}
                      onBlur={() => {
                        session.end();
                        onBlur?.();
                      }}
                      onChange={(e) => set(r, c, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.tableActions}>
        <button type="button" className={styles.addRow} disabled={disabled} onClick={() => onChange([...value, Array(cols).fill('')])}>
          <Icon name="plus" size={12} /> 행
        </button>
        <button type="button" className={styles.addRow} disabled={disabled} onClick={() => onChange(value.map((r) => [...r, '']))}>
          <Icon name="plus" size={12} /> 열
        </button>
        <button type="button" className={styles.addRow} disabled={disabled || value.length <= 1} onClick={() => onChange(value.slice(0, -1))}>
          <Icon name="minus" size={12} /> 행
        </button>
        <button type="button" className={styles.addRow} disabled={disabled || cols <= 1} onClick={() => onChange(value.map((r) => r.slice(0, cols - 1)))}>
          <Icon name="minus" size={12} /> 열
        </button>
      </div>
    </div>
  );
}

/* ---------- Metadata (JSON 객체의 문자열 값 편집) ---------- */
export function MetadataField({ value, onChange, disabled, onFocus, onBlur }: ControlProps<Record<string, Json>>) {
  const session = useGestureSession('meta');
  return (
    <div className={styles.fields} style={{ gap: 6 }}>
      {Object.entries(value).map(([k, v]) => (
        <div key={k} className={styles.metaRow}>
          <span className={styles.metaKey} title={k}>
            {k}
          </span>
          <input
            className={styles.input}
            value={typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v)}
            disabled={disabled || (typeof v !== 'string' && typeof v !== 'number')}
            onFocus={() => {
              session.begin();
              onFocus?.();
            }}
            onBlur={() => {
              session.end();
              onBlur?.();
            }}
            onChange={(e) => onChange({ ...value, [k]: typeof v === 'number' ? Number(e.target.value) || 0 : e.target.value }, session.get())}
          />
        </div>
      ))}
    </div>
  );
}

/* ---------- Image source (로컬 샘플) ---------- */
const THUMBS: Record<string, ReactNode> = {
  'local://sample/ridge': (
    <svg viewBox="0 0 40 40">
      <rect width="40" height="40" fill="#d9e4f0" />
      <path d="M0 30 12 16l8 8 8-10 12 14v12H0Z" fill="#5f7891" />
    </svg>
  ),
  'local://sample/dawn': (
    <svg viewBox="0 0 40 40">
      <rect width="40" height="40" fill="#d8738b" />
      <circle cx="20" cy="28" r="8" fill="#ffe0a8" />
      <rect y="28" width="40" height="12" fill="#29304f" />
    </svg>
  ),
  'local://sample/grid': (
    <svg viewBox="0 0 40 40">
      <rect width="40" height="40" fill="#efe9df" />
      <circle cx="10" cy="10" r="5" fill="#e2725b" />
      <circle cx="30" cy="10" r="3" fill="#2f6f73" />
      <circle cx="10" cy="30" r="3" fill="#e8b04b" />
      <circle cx="30" cy="30" r="5" fill="#2f6f73" />
    </svg>
  ),
};

export function ImageSourceField({ value, onChange, disabled }: ControlProps<string | null>) {
  return (
    <div className={styles.imageGrid}>
      {IMAGE_SOURCES.map((s) => (
        <button
          key={s.value}
          type="button"
          className={styles.imageOption}
          aria-pressed={(value ?? '') === s.value}
          title={s.value ? `${s.label} (${s.value})` : s.label}
          disabled={disabled}
          onClick={() => onChange(s.value || null)}
        >
          {THUMBS[s.value] ?? <Icon name="image" size={16} />}
        </button>
      ))}
    </div>
  );
}
