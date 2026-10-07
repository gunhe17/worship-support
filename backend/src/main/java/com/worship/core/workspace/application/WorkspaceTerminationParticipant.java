package com.worship.core.workspace.application;

import java.util.List;

/** Feature-owned, content-free impact collected under the workspace lock. */
public interface WorkspaceTerminationParticipant {
    record Impact(String feature,int documentCount,boolean ongoingWork,List<String> revisions) {
        public Impact { revisions=List.copyOf(revisions); }
    }
    Impact terminationImpact(long workspaceId);
}
