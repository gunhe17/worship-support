import { useMemo } from 'react';
import { CONTENT_TABLE_BY_KIND } from '../../engine/db/schema';
import type { BlockKind, JsonObject, Placement, TableName, Tables } from '../../engine/types';
import { useWorld } from '../editorContext';
import type { BlockView } from '../model/documentModel';
import { PAGE_SIZE } from '../model/elementRegistry';
import { isTableBlock, tableData, tableSize } from '../model/tableLayout';
import { ElementContent } from './ElementContent';
import styles from './inspector.module.css';
import { measureTextHeight } from './textMeasure';

interface PreviewItem {
  key: string;
  props: Placement;
  sequence: number;
  block: BlockView;
}

/**
 * 버전 미리보기: 그 버전의 template_version_element(배치)와 참조 block_version 콘텐츠를 그대로 그린다.
 * PostgreSQL 행을 읽기만 한다 (DB·Redis 변경 없음).
 * 복원은 배치·참조 버전을 되돌리며, 블록의 현재 Live 내용은 유지된다는 점은 그대로다 (§7.8).
 */
function previewItems(tables: Tables, versionId: string): PreviewItem[] {
  const blockOf = new Map(tables.template_element.map((e) => [e.id as string, e.block_id as string]));
  const kindOf = new Map(tables.block.map((b) => [b.id as string, b.kind as BlockKind]));
  return tables.template_version_element
    .filter((r) => r.template_version_id === versionId)
    .map((r) => {
      const blockId = blockOf.get(r.template_element_id as string) ?? '';
      const kind = kindOf.get(blockId) ?? 'text';
      const table = CONTENT_TABLE_BY_KIND[kind] as TableName;
      const row = tables[table].find((c) => c.id === r.block_version_id) ?? {};
      const content: JsonObject = {};
      for (const [k, v] of Object.entries(row)) if (k !== 'id') content[k] = v as JsonObject[string];
      return {
        key: r.id as string,
        props: r.props as unknown as Placement,
        sequence: r.sequence as number,
        block: { blockId, kind, content, revision: 0, properties: {} },
      };
    })
    .sort((a, b) => a.sequence - b.sequence);
}

const WIDTH = 220;

export function VersionPreview({ versionId, label }: { versionId: string; label: string }) {
  // 테이블 참조만 구독하고 계산은 메모한다 (버전 행은 만들어진 뒤 바뀌지 않는다)
  const tables = useWorld((w) => w.tables);
  const items = useMemo(() => previewItems(tables, versionId), [tables, versionId]);
  const scale = WIDTH / PAGE_SIZE.width;
  return (
    <div className={styles.preview} aria-label={`${label} 미리보기`}>
      <div className={styles.previewTitle}>{label} 미리보기</div>
      <div className={styles.previewPage} style={{ width: WIDTH, height: PAGE_SIZE.height * scale }}>
        <div style={{ width: PAGE_SIZE.width, height: PAGE_SIZE.height, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'relative' }}>
          {items.map((it) => {
            const width = isTableBlock(it.block) ? tableSize(tableData(it.block)).width : it.props.size.width;
            const auto = measureTextHeight(it.block, width);
            const height = isTableBlock(it.block) ? tableSize(tableData(it.block)).height : (auto ?? it.props.size.height);
            return (
              <div
                key={it.key}
                style={{ position: 'absolute', left: it.props.position.x, top: it.props.position.y, width, height, zIndex: it.sequence, overflow: 'hidden' }}
              >
                <ElementContent block={it.block} />
              </div>
            );
          })}
          {items.length === 0 && <div className={styles.previewEmpty}>빈 페이지</div>}
        </div>
      </div>
      <div className={styles.previewNote}>복원하면 이 배치로 돌아가요. 글 내용은 지금 내용을 유지해요.</div>
    </div>
  );
}
