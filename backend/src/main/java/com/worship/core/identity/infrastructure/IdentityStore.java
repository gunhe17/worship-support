package com.worship.core.identity.infrastructure;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.*;
import com.worship.core.identity.domain.*;
import org.springframework.stereotype.Repository;
@Repository
public class IdentityStore {
    @PersistenceContext private EntityManager em;
    public UserAccount create(Instant now) { var user = new UserAccount(now); em.persist(user); return user; }
    public UserAccount account(long id, boolean lock) { return em.find(UserAccount.class, id, lock ? LockModeType.PESSIMISTIC_WRITE : LockModeType.NONE); }
    public UserAccount accountForRead(long id) { return em.find(UserAccount.class, id, LockModeType.PESSIMISTIC_READ); }
    public void save(Object entity) { em.persist(entity); }
    public void delete(Object entity) { em.remove(entity); }
    public void flush() { em.flush(); }
    public List<UserEmail> emails(long userId) { return em.createQuery("select e from UserEmail e where e.userId=:id order by e.id", UserEmail.class).setParameter("id", userId).getResultList(); }
    public Optional<UserEmail> verifiedEmail(String email) { return em.createQuery("select e from UserEmail e where e.email=:email and e.verified=true", UserEmail.class).setParameter("email", email).getResultStream().findFirst(); }
    public List<UserEmail> pendingSignupEmails(String email) { return em.createQuery("select e from UserEmail e where e.email=:email and e.verified=false and e.primary=true", UserEmail.class).setParameter("email", email).getResultList(); }
    public UserEmail email(long id) { return em.find(UserEmail.class, id); }
    public void refreshEmail(UserEmail email) { em.refresh(email); }
    public PasswordCredential password(long id) { return em.find(PasswordCredential.class, id); }
    public List<ExternalIdentity> identities(long userId) { return em.createQuery("select i from ExternalIdentity i where i.userId=:id", ExternalIdentity.class).setParameter("id", userId).getResultList(); }
    public Optional<ExternalIdentity> identity(String issuer, String subject) { return em.createQuery("select i from ExternalIdentity i where i.issuer=:issuer and i.subject=:subject", ExternalIdentity.class).setParameter("issuer", issuer).setParameter("subject", subject).getResultStream().findFirst(); }
    public AccountToken token(String hash) { return em.createQuery("select t from AccountToken t where t.tokenHash=:hash", AccountToken.class).setParameter("hash", hash).getResultStream().findFirst().orElse(null); }
    public AccountToken refreshToken(AccountToken token) { em.refresh(token, LockModeType.PESSIMISTIC_WRITE); return token; }
    public void deleteEmailTokens(long emailId) { em.createQuery("delete from AccountToken t where t.emailId=:id").setParameter("id", emailId).executeUpdate(); }
    public void consumeTokens(long userId, String kind) { em.createQuery("update AccountToken t set t.consumed=true where t.userId=:id and t.kind=:kind").setParameter("id", userId).setParameter("kind", kind).executeUpdate(); }
    public void deleteTokens(long userId) { em.createQuery("delete from AccountToken t where t.userId=:id").setParameter("id", userId).executeUpdate(); }
    public void deleteSessions(long userId) { em.createNativeQuery("DELETE FROM SPRING_SESSION WHERE PRINCIPAL_NAME = :id").setParameter("id", Long.toString(userId)).executeUpdate(); }
    public void deleteOtherSessions(long userId, String currentSessionId) {
        em.createNativeQuery("DELETE FROM SPRING_SESSION WHERE PRINCIPAL_NAME=:id AND SESSION_ID<>:session")
            .setParameter("id",Long.toString(userId)).setParameter("session",currentSessionId).executeUpdate();
    }
}
