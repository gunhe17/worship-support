import { describe, expect, it } from 'vitest';
import { nextFlowPosition } from '../../src/editor/adapters/localAdapter';
import { buildDocumentView } from '../../src/editor/model/documentModel';
import { ELEMENT_KINDS, findPropertyDef } from '../../src/editor/model/elementRegistry';
import { resizeRect, snapRect } from '../../src/editor/model/snapping';
import { createSeedTables } from '../../src/engine/seed';
import { BLOCK_KINDS } from '../../src/engine/types';

describe('elementRegistry (DB_SCHEMA §8.6)', () => {
  it('10종 요소 모두 기본 콘텐츠와 속성 정의를 가진다', () => {
    for (const kind of BLOCK_KINDS) {
      const def = ELEMENT_KINDS[kind];
      expect(def.groups.flatMap((g) => g.properties).length).toBeGreaterThan(0);
      expect(Object.keys(def.defaultContent()).length).toBeGreaterThan(0);
    }
  });

  it('text의 property_path "content"는 body에 매핑된다 (시나리오 A)', () => {
    expect(findPropertyDef('text', 'content')?.jsonPath).toBe('body');
    expect(findPropertyDef('text', 'style.fontSize')?.jsonPath).toBe('style.fontSize');
    expect(findPropertyDef('text', 'style.textAlign')?.fallback).toBe('left');
  });

  it('신규 이미지 기본 콘텐츠는 시나리오 G 정책과 같다', () => {
    expect(ELEMENT_KINDS.image.defaultContent()).toEqual({ file_url: null, alt_text: '', width: 300, height: 200 });
  });
});

describe('snapping / resize', () => {
  it('페이지 중앙선에 스냅한다', () => {
    const r = snapRect({ x: 248, y: 10, width: 300, height: 50 }, [], { width: 800, height: 1040 }, 6);
    expect(r.x).toBe(250);
    expect(r.guides).toContainEqual({ axis: 'x', at: 400 });
  });

  it('왼쪽 위 핸들 리사이즈는 반대쪽 모서리를 고정한다', () => {
    expect(resizeRect({ x: 100, y: 100, width: 300, height: 100 }, 'nw', 50, 20)).toEqual({ x: 150, y: 120, width: 250, height: 80 });
    expect(resizeRect({ x: 100, y: 100, width: 300, height: 100 }, 'e', -400, 0).width).toBe(24);
  });
});

describe('기본 배치', () => {
  it('기존 요소와 겹치지 않는 빈 자리에 배치한다', () => {
    const view = buildDocumentView(createSeedTables());
    const p = nextFlowPosition(view, 'T001', 320, 80);
    const overlapsE001 = p.x < 400 && p.x + 320 > 100 && p.y < 200 && p.y + 80 > 100;
    expect(overlapsE001).toBe(false);
  });
});
