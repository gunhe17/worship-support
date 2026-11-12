import { describe, expect, it } from 'vitest';
import { createSeedTables } from '../../src/engine/seed';
import { buildDocumentView } from '../../src/editor/model/documentModel';
import type { EditorOp } from '../../src/editor/model/ops';
import { addPendingOp, createReplica, removePendingOp, renderView } from '../../src/editor/model/replica';

const view = buildDocumentView(createSeedTables());

const textOp = (opId: string, value: string): EditorOp => ({
  opId,
  actorUserId: 'U001',
  type: 'PROPERTY_UPDATE',
  target: { scope: 'block', blockId: 'B001' },
  propertyPath: 'content',
  value,
});

const moveOp = (opId: string, value: number): EditorOp => ({
  opId,
  actorUserId: 'U001',
  type: 'PROPERTY_UPDATE',
  target: { scope: 'element', templateId: 'T001', elementId: 'E001' },
  propertyPath: 'position.y',
  value,
});

describe('documentView', () => {
  it('시드 Live 테이블로부터 요소와 블록을 구성한다', () => {
    expect(view.elements.E001).toMatchObject({ blockId: 'B001', sequence: 1, props: { position: { x: 100, y: 100 } } });
    expect(view.blocks.B001.content).toEqual({ body: '안녕하세요', style: { fontSize: 16, color: '#000000' } });
    expect(view.templates.T001.name).toBe('자기소개 템플릿');
  });
});

describe('replica optimistic rendering (§8.1)', () => {
  it('화면 = documentView + pendingOps 순서 적용', () => {
    let r = createReplica('U001', 'T001', view);
    r = addPendingOp(r, textOp('a', '안녕하세요!'), 0);
    r = addPendingOp(r, moveOp('b', 300), 0);
    const rendered = renderView(r);
    expect(rendered.blocks.B001.content.body).toBe('안녕하세요!');
    expect(rendered.elements.E001.props.position.y).toBe(300);
    // documentView(서버 승인 데이터)는 변하지 않는다
    expect(r.documentView.blocks.B001.content.body).toBe('안녕하세요');
  });

  it('MU-8: 세 작업 중 두 번째만 거부되면 첫 번째와 세 번째는 유지된다', () => {
    let r = createReplica('U001', 'T001', view);
    r = addPendingOp(r, textOp('1', '안녕하세요!'), 0);
    r = addPendingOp(r, moveOp('2', 300), 0);
    r = addPendingOp(r, textOp('3', '안녕하세요! 반갑습니다.'), 0);
    r = removePendingOp(r, '2');
    const rendered = renderView(r);
    expect(r.pendingOps.map((p) => p.op.opId)).toEqual(['1', '3']);
    expect(rendered.blocks.B001.content.body).toBe('안녕하세요! 반갑습니다.');
    expect(rendered.elements.E001.props.position.y).toBe(100);
  });

  it('replica는 사용자별로 독립된 사본을 가진다', () => {
    const a = createReplica('U001', 'T001', view);
    const b = createReplica('U002', 'T001', view);
    expect(a.documentView).not.toBe(b.documentView);
    expect(a.lastReceivedRevision['block:B001']).toBe(0);
  });
});
