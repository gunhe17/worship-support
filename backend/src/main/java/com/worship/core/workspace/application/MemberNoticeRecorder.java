package com.worship.core.workspace.application;

import java.time.Clock;
import com.worship.core.workspace.infrastructure.MemberNoticeStore;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.*;

@Component
public class MemberNoticeRecorder {
    private final MemberNoticeStore store;
    private final Clock clock;
    public MemberNoticeRecorder(MemberNoticeStore store,Clock clock){this.store=store;this.clock=clock;}
    @Transactional(propagation=Propagation.MANDATORY)
    public void adminAssigned(long workspace,long membership){store.append(workspace,membership,null,"ADMIN_ASSIGNED",clock.instant());}
    @Transactional(propagation=Propagation.MANDATORY)
    public void managerAssigned(long workspace,long membership,long document){store.append(workspace,membership,document,"MANAGER_ASSIGNED",clock.instant());}
    @Transactional(propagation=Propagation.MANDATORY)
    public void workspaceTerminated(long workspace,long membership){store.append(workspace,membership,null,"WORKSPACE_TERMINATED",clock.instant());}
}
