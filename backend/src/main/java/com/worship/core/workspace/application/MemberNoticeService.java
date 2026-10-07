package com.worship.core.workspace.application;

import java.time.*;
import java.util.List;
import com.worship.core.identity.application.IdentityService;
import com.worship.core.shared.application.*;
import com.worship.core.workspace.infrastructure.MemberNoticeStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class MemberNoticeService {
    public record NoticeView(long id,long workspaceId,Long documentId,String kind,Instant createdAt,Instant readAt) {}
    private final MemberNoticeStore store;
    private final IdentityService identity;
    private final TransactionTemplate tx;
    private final Clock clock;
    public MemberNoticeService(MemberNoticeStore store,IdentityService identity,TransactionTemplate tx,Clock clock){this.store=store;this.identity=identity;this.tx=tx;this.clock=clock;}
    public List<NoticeView> list(Actor actor,Long beforeId){
        if(beforeId!=null&&beforeId<=0)throw Errors.invalid("Positive notice cursor required");
        return tx.execute(status->{identity.requireAuthenticatedForRead(actor);return store.list(actor.userId(),beforeId).stream().map(n->new NoticeView(n.id(),n.workspaceId(),n.documentId(),n.kind(),n.createdAt(),n.readAt())).toList();});
    }
    public void markRead(Actor actor,long noticeId){
        tx.executeWithoutResult(status->{identity.requireAuthenticated(actor);if(!store.markRead(actor.userId(),noticeId,clock.instant()))throw Errors.missing();});
    }
}
