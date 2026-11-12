import { useLayoutEffect, type ReactNode, type RefObject } from 'react';
import type { Json, SimUser } from '../../engine/types';
import { useDevInfo, useEditorStore, useForeignLocks, useIntent, useLocalState } from '../editorContext';
import type { BlockView, ElementView } from '../model/documentModel';
import type { PlacementPath, PropertyDef } from '../model/elementRegistry';
import { blockLockKey, elementLockKey } from '../model/lockKeys';
import { readBlockProperty } from '../model/ops';
import { tableData } from '../model/tableLayout';
import {
  ALIGN_OPTIONS,
  ColorField,
  ImageSourceField,
  LEVEL_OPTIONS,
  ListItemsField,
  MetadataField,
  NumberField,
  Segmented,
  SelectField,
  SliderField,
  TableDataField,
  TextField,
} from './controls';
import { formatBytes } from './ElementContent';
import { Icon } from './icons';
import styles from './inspector.module.css';
import { userStyle } from './PresenceBar';
import { isAutoHeightKind, measureTextHeight } from './textMeasure';
import { autoHeightChanges, useEditBlockProperty } from './useEditText';
import { useEditTable } from './useEditTable';

/** 블록 속성 입력칸과 배치 입력칸 (요소 툴바의 편집 카드에서 사용) */

/** 다른 사용자가 보유한 Lock의 소유자: MockRedis lock:* 키를 읽는다 (Phase 3부터 Lock이 생성됨) */
export function useLockOwner(lockKey: string): SimUser | null {
  const owner = useForeignLocks()[lockKey];
  const users = useEditorStore((s) => s.users);
  return owner ? (users.find((u) => u.userId === owner) ?? null) : null;
}

function Field({ label, path, lockOwner, children }: { label: string; path: string; lockOwner: SimUser | null; children: ReactNode }) {
  const devInfo = useDevInfo();
  return (
    <div className={styles.field} data-locked={!!lockOwner}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldLabel}>{label}</span>
        {devInfo && <span className={styles.fieldPath}>{path}</span>}
        {lockOwner && (
          <span className={styles.lockBadge} style={userStyle(lockOwner)} title={`${lockOwner.name}이(가) 편집 중`}>
            <Icon name="lock" size={10} />
            {lockOwner.name} 편집 중
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function BlockPropertyField({ block, def }: { block: BlockView; def: PropertyDef }) {
  const local = useLocalState();
  const lockOwner = useLockOwner(blockLockKey(block.blockId, def.path));
  const raw = readBlockProperty(block, def.path);
  const value = (raw === undefined ? def.fallback : raw) ?? null;

  const props = {
    disabled: !!lockOwner,
    onFocus: () => local({ selectedPropertyPath: def.path }),
    // 입력 포커스 해제는 Lock 해제 사유가 아니다 (요소에서 나갈 때 해제, §8.10.5)
    onBlur: () => local({ selectedPropertyPath: null }),
  };
  // 텍스트·제목은 글자 크기·레벨이 바뀌면 높이도 함께 맞춘다
  const editBlockProperty = useEditBlockProperty();
  const change = (v: Json, gestureId?: string) => {
    editBlockProperty(block, def.path, v, gestureId);
  };
  const editTable = useEditTable();

  let control: ReactNode;
  switch (def.control) {
    case 'textarea':
      control = <TextField multiline value={String(value ?? '')} onChange={change} {...props} />;
      break;
    case 'text':
      control = <TextField value={String(value ?? '')} onChange={change} {...props} />;
      break;
    case 'url':
      control = <TextField mono placeholder="https://" value={String(value ?? '')} onChange={(v, g) => change(v === '' ? null : v, g)} {...props} />;
      break;
    case 'number':
      control = <NumberField label="#" value={Number(value ?? 0)} min={def.min} max={def.max} onChange={change} {...props} />;
      break;
    case 'bytes':
      control = (
        <NumberField label="B" value={Number(value ?? 0)} min={0} unit={formatBytes(Number(value ?? 0))} onChange={change} {...props} />
      );
      break;
    case 'fontSize':
      control = <SliderField value={Number(value ?? 16)} min={def.min} max={def.max} onChange={change} {...props} />;
      break;
    case 'color':
      control = <ColorField value={String(value ?? '#000000')} onChange={change} {...props} />;
      break;
    case 'align':
      control = <Segmented value={String(value ?? 'left')} options={ALIGN_OPTIONS} onChange={change} {...props} />;
      break;
    case 'level':
      control = <Segmented value={Number(value ?? 1)} options={LEVEL_OPTIONS} onChange={change} {...props} />;
      break;
    case 'select':
      control = <SelectField value={String(value ?? '')} options={def.options} onChange={change} {...props} />;
      break;
    case 'listItems':
      control = <ListItemsField value={Array.isArray(value) ? value.map(String) : []} onChange={change} {...props} />;
      break;
    case 'tableData':
      control = (
        <TableDataField
          value={tableData(block)}
          // 행·열 수가 바뀌면 요소 크기도 함께 맞춘다 (표 크기 = 행·열 수)
          onChange={(v, gestureId) => editTable(block, v, gestureId)}
          {...props}
        />
      );
      break;
    case 'metadata':
      control = (
        <MetadataField
          value={value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, Json>) : {}}
          onChange={change}
          {...props}
        />
      );
      break;
    case 'toggle':
      control = (
        <button
          type="button"
          className={styles.toggleButton}
          aria-pressed={value === true}
          disabled={props.disabled}
          onClick={() => change(value !== true)}
        >
          {value === true ? '켜짐' : '꺼짐'}
        </button>
      );
      break;
    case 'imageSource':
      control = <ImageSourceField value={typeof value === 'string' ? value : null} onChange={change} {...props} />;
      break;
  }

  return (
    <Field label={def.label} path={def.path} lockOwner={lockOwner}>
      {control}
    </Field>
  );
}

export function PlacementInput({
  el,
  block,
  path,
  label,
  readOnly = false,
}: {
  el: ElementView;
  block: BlockView;
  path: PlacementPath;
  label: string;
  readOnly?: boolean;
}) {
  const intent = useIntent();
  const local = useLocalState();
  const lockOwner = useLockOwner(elementLockKey(el.templateId, el.elementId, path));
  const [group, key] = path.split('.') as ['position' | 'size', string];
  const stored = (el.props[group] as Record<string, number>)[key];
  // 텍스트·제목의 높이는 캔버스와 같은 값(내용에 맞춘 높이)을 보여 준다
  const value = path === 'size.height' && isAutoHeightKind(block.kind) ? (measureTextHeight(block, el.props.size.width) ?? stored) : stored;
  return (
    <div title={lockOwner ? `${lockOwner.name}이(가) 편집 중` : undefined}>
      <NumberField
        label={label}
        value={value}
        min={group === 'size' ? 1 : undefined}
        locked={!!lockOwner}
        disabled={!!lockOwner || readOnly}
        onFocus={() => local({ selectedPropertyPath: path })}
        onBlur={() => local({ selectedPropertyPath: null })}
        onChange={(v, gestureId) =>
          intent({
            type: 'editPlacement',
            templateId: el.templateId,
            elementId: el.elementId,
            // 텍스트·제목은 너비가 바뀌면 높이도 내용에 맞춘다
            changes: path === 'size.width' ? autoHeightChanges(block, v) : { [path]: v },
            gestureId,
          })
        }
      />
    </div>
  );
}


const FIELD_SELECTOR = 'input:not([type=color]):not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled)';
const isTextInput = (n: Element): n is HTMLInputElement | HTMLTextAreaElement =>
  n instanceof HTMLTextAreaElement || (n instanceof HTMLInputElement && ['text', 'url', 'search', ''].includes(n.type));
/** 임시 ID → 서버 ID 교체로 다시 그려질 때 이어받을 포커스 */
let carriedFocus: { at: number; index: number; start: number | null; end: number | null } | null = null;

/** 이어받을 포커스가 아직 유효한가 */
const hasCarriedFocus = () => !!carriedFocus && performance.now() - carriedFocus.at < 3000;

/**
 * 입력칸 포커스: 처음 그려질 때 autoFocus면 첫 칸에 포커스한다.
 * 서버 승인으로 임시 ID가 진짜 ID로 바뀌면 다시 그려지므로, 그때 포커스·커서 위치를 이어받는다.
 */
export function useFieldFocus(root: RefObject<HTMLElement>, el: ElementView, autoFocus: boolean): void {
  useLayoutEffect(() => {
    const fields = root.current ? [...root.current.querySelectorAll<HTMLElement>(FIELD_SELECTOR)] : [];
    const restore = hasCarriedFocus() ? carriedFocus : null;
    carriedFocus = null;
    if (restore) {
      const f = fields[restore.index];
      f?.focus({ preventScroll: true });
      if (f && isTextInput(f) && restore.start !== null) f.setSelectionRange(restore.start, restore.end);
    } else if (autoFocus && fields[0]) {
      fields[0].focus({ preventScroll: true });
      if (isTextInput(fields[0])) fields[0].select();
    }
    const provisional = !!el.provisional;
    return () => {
      // DOM이 지워지기 전(layout cleanup)에 현재 포커스를 기억한다
      if (!provisional) return;
      const active = document.activeElement as HTMLElement | null;
      const index = active ? fields.indexOf(active) : -1;
      if (index < 0) return;
      carriedFocus = {
        at: performance.now(),
        index,
        start: active && isTextInput(active) ? active.selectionStart : null,
        end: active && isTextInput(active) ? active.selectionEnd : null,
      };
    };
  }, [el.elementId]); // eslint-disable-line react-hooks/exhaustive-deps
}
