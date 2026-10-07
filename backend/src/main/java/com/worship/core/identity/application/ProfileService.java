package com.worship.core.identity.application;

import java.time.Clock;
import com.worship.core.identity.infrastructure.IdentityStore;
import com.worship.core.audit.application.AuditRecorder;
import com.worship.core.shared.application.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class ProfileService {
    public record ProfileView(String displayName) {}
    private final IdentityService identity;
    private final IdentityStore store;
    private final TransactionTemplate tx;
    private final AuditRecorder audit;
    private final Clock clock;
    public ProfileService(IdentityService identity,IdentityStore store,TransactionTemplate tx,AuditRecorder audit,Clock clock){this.identity=identity;this.store=store;this.tx=tx;this.audit=audit;this.clock=clock;}
    public ProfileView get(Actor actor){return tx.execute(status->{identity.requireAuthenticatedForRead(actor);return new ProfileView(store.account(actor.userId(),false).displayName());});}
    public ProfileView update(Actor actor,String name){
        if(name==null||name.isBlank()||name.length()>80||name.codePoints().anyMatch(Character::isISOControl))throw Errors.invalid("Display name must be 1-80 characters without controls");
        return tx.execute(status->{identity.requireAuthenticated(actor);var account=store.account(actor.userId(),false);account.displayName(name.trim());audit.record(actor.userId(),"PROFILE_CHANGED",clock.instant(),AuditRecorder.Target.account(AuditRecorder.TargetType.USER,actor.userId()),null);return new ProfileView(account.displayName());});
    }
}
