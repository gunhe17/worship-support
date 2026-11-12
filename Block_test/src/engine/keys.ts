import { blockLockKey, elementLockKey } from '../editor/model/lockKeys';
import type { PropertyUpdateOp } from '../editor/model/ops';
import type { TargetKey } from './protocol';

/** Redis 키 규칙 (DB_SCHEMA §4, §7.3, §7.5). 클라이언트와 서버가 함께 사용한다. */
type PropertyRef = Pick<PropertyUpdateOp, 'target' | 'propertyPath'>;

export const lockKeyOf = (op: PropertyRef) =>
  op.target.scope === 'block'
    ? blockLockKey(op.target.blockId, op.propertyPath)
    : elementLockKey(op.target.templateId, op.target.elementId, op.propertyPath);

export const debounceKeyOf = (op: PropertyRef) =>
  op.target.scope === 'block'
    ? `debounce:block:${op.target.blockId}:${op.propertyPath}`
    : `debounce:template:${op.target.templateId}:element:${op.target.elementId}:${op.propertyPath}`;

export const targetKeyOf = (op: Pick<PropertyUpdateOp, 'target'>): TargetKey =>
  op.target.scope === 'block' ? `block:${op.target.blockId}` : `template:${op.target.templateId}`;
