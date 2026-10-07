package com.worship.core.workspace.application;
import java.util.List;
public interface MembershipLifecycle {
    record RemovalResponsibility(long documentId,long version) {}
    void beforeEnd(long workspaceId,long membershipId);
    default List<RemovalResponsibility> removalResponsibilities(long workspaceId,long membershipId){return List.of();}
    default void beforeRemoval(long actorId,long workspaceId,long membershipId,long successorMembershipId){beforeEnd(workspaceId,membershipId);}
}
