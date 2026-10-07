package com.worship.core.export.application;

import com.worship.core.setlist.application.SetlistService.SetlistView;
import java.util.Map;

/** Pure rendering port: immutable source only, no database or external provider access. */
public interface ExportRenderer {
    record ScoreContent(String mediaType,byte[] bytes) {}
    byte[] pdf(SetlistView source);

    /** File bytes are loaded by the application, outside DB transactions. */
    default byte[] pdf(SetlistView source,Map<Long,ScoreContent> scores){
        if(!scores.isEmpty())throw new UnsupportedOperationException("Renderer does not support score pages");
        return pdf(source);
    }
}
