import { useIntent, useViewerDocument, useViewerReplica } from '../editorContext';
import type { BlockView } from '../model/documentModel';
import { elementsOf } from '../model/documentModel';
import { tableSize, type TableData } from '../model/tableLayout';

let seq = 0;
export const newTableGesture = () => `table-${Date.now().toString(36)}-${++seq}`;

/**
 * 표 데이터 변경. 행·열 수가 바뀌면 현재 템플릿에서 이 블록을 쓰는 요소의 size도 함께 갱신한다.
 * 두 변경은 같은 gestureId로 보내 Undo 한 번에 함께 되돌린다. 모두 Simulation Engine(intent)을 거친다.
 */
export function useEditTable(): (block: BlockView, data: TableData, gestureId?: string) => void {
  const intent = useIntent();
  const doc = useViewerDocument();
  const replica = useViewerReplica();
  return (block, data, gestureId = newTableGesture()) => {
    const r = intent({ type: 'editProperty', blockId: block.blockId, propertyPath: 'data', value: data, gestureId });
    if (!r.ok) return;
    const size = tableSize(data);
    for (const el of elementsOf(doc, replica.viewingTemplateId)) {
      if (el.blockId !== block.blockId) continue;
      if (el.props.size.width === size.width && el.props.size.height === size.height) continue;
      intent({
        type: 'editPlacement',
        templateId: el.templateId,
        elementId: el.elementId,
        changes: { 'size.width': size.width, 'size.height': size.height },
        gestureId,
      });
    }
  };
}
