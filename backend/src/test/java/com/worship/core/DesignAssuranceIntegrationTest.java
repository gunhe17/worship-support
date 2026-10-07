package com.worship.core;

import java.nio.file.*;
import java.util.*;
import com.worship.core.shared.application.Actor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.junit.jupiter.*;
import tools.jackson.databind.json.JsonMapper;
import static org.assertj.core.api.Assertions.*;

/** Meeting documentation is checked against a disposable, genuinely migrated MySQL database. */
@SpringBootTest @Testcontainers
@org.springframework.test.annotation.DirtiesContext(classMode=org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
class DesignAssuranceIntegrationTest {
    @Container static final MySQLContainer MYSQL=new MySQLContainer("mysql:8.4");
    @DynamicPropertySource static void database(DynamicPropertyRegistry p){p.add("spring.datasource.url",MYSQL::getJdbcUrl);p.add("spring.datasource.username",MYSQL::getUsername);p.add("spring.datasource.password",MYSQL::getPassword);}
    @Autowired JdbcTemplate jdbc;@Autowired TransactionTemplate tx;
    record Manifest(String format,String baselineCommit,String migrationVersion,String notation,List<String> excludedTechnicalTables,List<Table> tables) {}
    record Table(String name,String purpose,Map<String,String> columns,Map<String,List<String>> unique,List<ForeignKey> foreignKeys,List<String> checks) {}
    record ForeignKey(String name,List<String> columns,String target,List<String> targetColumns,String deleteRule) {}
    Manifest manifest()throws Exception{return JsonMapper.builder().build().readValue(Files.readString(Path.of("docs/review/core-backend-v1/schema-manifest.json")),Manifest.class);}

    @Test void allDocumentedTablesColumnsAndConstraintsMatchLiveMysql()throws Exception{
        var manifest=manifest();assertThat(manifest.tables()).hasSize(26);assertThat(manifest.tables().stream().map(Table::name).distinct().count()).isEqualTo(26);
        var actual=new HashSet<>(jdbc.queryForList("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()",String.class));actual.removeAll(manifest.excludedTechnicalTables());
        assertThat(actual).containsExactlyInAnyOrderElementsOf(manifest.tables().stream().map(Table::name).toList());
        assertThat(jdbc.queryForObject("SELECT MAX(CAST(version AS UNSIGNED)) FROM flyway_schema_history WHERE success=1",Long.class)).isEqualTo(Long.valueOf(manifest.migrationVersion()));
        for(var table:manifest.tables()){
            Map<String,String> columns=new LinkedHashMap<>();
            jdbc.query("SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,GENERATION_EXPRESSION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION",r->{String generated=r.getString(4);columns.put(r.getString(1),r.getString(2).toLowerCase(Locale.ROOT)+(r.getString(3).equals("YES")?"?":"!")+(generated!=null&&!generated.isBlank()?"*":""));},table.name());
            assertThat(columns).as("Columns/types/nullability/generated: %s",table.name()).isEqualTo(table.columns());
            Map<String,List<String>> unique=new TreeMap<>();jdbc.query("SELECT INDEX_NAME,COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND NON_UNIQUE=0 ORDER BY INDEX_NAME,SEQ_IN_INDEX",r->{unique.computeIfAbsent(r.getString(1),ignored->new ArrayList<>()).add(r.getString(2));},table.name());
            assertThat(unique).as("PK/UK: %s",table.name()).isEqualTo(table.unique());
            Map<String,List<String>> foreign=new TreeMap<>();
            jdbc.query("SELECT k.CONSTRAINT_NAME,k.COLUMN_NAME,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.DELETE_RULE FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME=? AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.CONSTRAINT_NAME,k.ORDINAL_POSITION",r->{foreign.computeIfAbsent(r.getString(1),ignored->new ArrayList<>()).add(r.getString(2)+"->"+r.getString(3)+"."+r.getString(4)+":"+r.getString(5));},table.name());
            Map<String,List<String>> expected=new TreeMap<>();for(var key:table.foreignKeys()){var values=new ArrayList<String>();for(int i=0;i<key.columns().size();i++)values.add(key.columns().get(i)+"->"+key.target()+"."+key.targetColumns().get(i)+":"+(key.deleteRule()==null?"NO ACTION":key.deleteRule()));expected.put(key.name(),values);}
            assertThat(foreign).as("Ordered composite FKs: %s",table.name()).isEqualTo(expected);
            var checks=jdbc.queryForList("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_TYPE='CHECK'",String.class,table.name());assertThat(checks).as("CHECK inventory: %s",table.name()).containsExactlyInAnyOrderElementsOf(table.checks());
        }
    }

    @Test void membershipAndRoleOntologyIsNotAGlobalUserRoleOrHarnessTable()throws Exception{
        var tables=manifest().tables();var grant=tables.stream().filter(t->t.name().equals("document_grant")).findFirst().orElseThrow();
        assertThat(grant.columns()).containsKey("membership_id").doesNotContainKey("user_id");assertThat(grant.foreignKeys().stream().filter(f->f.target().equals("workspace_membership")).findFirst().orElseThrow().columns()).containsExactly("workspace_id","membership_id");
        var user=tables.stream().filter(t->t.name().equals("user_account")).findFirst().orElseThrow();assertThat(user.columns()).doesNotContainKey("role");
        assertThat(tables.stream().map(Table::name)).doesNotContain("role","workspace_owner","primary_admin","harness","agent_runtime","conversation","song_candidate","song_form");
        assertThat(Arrays.stream(Actor.class.getRecordComponents()).map(java.lang.reflect.RecordComponent::getName)).containsExactly("userId","sessionVersion","reauthenticatedAt");
        for(String column:List.of("form_json","musical_key","bpm","sessions_json","score_id","reference_id"))assertThat(tables.stream().filter(t->t.name().equals("setlist_item")).findFirst().orElseThrow().columns()).containsKey(column);
        assertThat(tables.stream().filter(t->t.name().equals("setlist")).findFirst().orElseThrow().columns()).doesNotContainKey("version").doesNotContainKey("role");
    }

    @Test void nullableLifecycleAndArtifactViolationsAreRejectedByNamedChecks(){
        tx.executeWithoutResult(status->{
            // Synthetic rows in this container only: deliberately probe enforcement beyond normal application flows.
            jdbc.update("INSERT INTO user_account(id,state,created_at) VALUES(900001,'ACTIVE',UTC_TIMESTAMP(6))");jdbc.update("INSERT INTO workspace(id,name,created_at) VALUES(900001,'Schema probe',UTC_TIMESTAMP(6))");
            assertThatThrownBy(()->jdbc.update("INSERT INTO workspace_membership(workspace_id,user_id,role,state,end_reason) VALUES(900001,900001,'MEMBER','ENDED',NULL)"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("membership_end")
                .satisfies(DesignAssuranceIntegrationTest::assertMysqlCheckViolation);
            assertThatThrownBy(()->jdbc.update("INSERT INTO workspace_membership(workspace_id,user_id,role,state,end_reason) VALUES(900001,900001,'MEMBER','ACTIVE','LEFT')"))
                .isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("membership_end")
                .satisfies(DesignAssuranceIntegrationTest::assertMysqlCheckViolation);
            jdbc.update("INSERT INTO workspace_membership(workspace_id,user_id,role,state,end_reason) VALUES(900001,900001,'MEMBER','ACTIVE',NULL)");
            for(String reason:List.of("LEFT","REMOVED","USER_WITHDRAWN"))jdbc.update("INSERT INTO workspace_membership(workspace_id,user_id,role,state,end_reason) VALUES(900001,900001,'MEMBER','ENDED',?)",reason);
            jdbc.update("INSERT INTO document(id,workspace_id,title,type,access_policy,modified_at) VALUES(900001,900001,'Probe','SETLIST','RESTRICTED',UTC_TIMESTAMP(6))");
            String insert="INSERT INTO immutable_export(workspace_id,document_id,actor_id,command_key,source_version,canonical_json,snapshot_hash,created_at,status,attempt_id,started_at,object_key,artifact_hash,byte_size) VALUES(900001,900001,900001,?,0,'{}',?,UTC_TIMESTAMP(6),?, ?,UTC_TIMESTAMP(6),?,?,?)";
            for(Long size:Arrays.asList(null,0L,-1L))assertThatThrownBy(()->jdbc.update(insert,UUID.randomUUID().toString(),"a".repeat(64),"SUCCEEDED",UUID.randomUUID().toString(),"probe","b".repeat(64),size))
                .isInstanceOf(org.springframework.dao.DataAccessException.class).hasMessageContaining("export_artifact")
                .satisfies(DesignAssuranceIntegrationTest::assertMysqlCheckViolation);
            jdbc.update(insert,"valid-success","a".repeat(64),"SUCCEEDED",UUID.randomUUID().toString(),"probe","b".repeat(64),1L);
            for(String state:List.of("RUNNING","FAILED_RETRYABLE"))jdbc.update(insert,state,"a".repeat(64),state,UUID.randomUUID().toString(),null,null,null);
            status.setRollbackOnly();
        });
    }
    static void assertMysqlCheckViolation(Throwable failure){
        Throwable root=failure;while(root.getCause()!=null)root=root.getCause();
        assertThat(root).isInstanceOf(java.sql.SQLException.class);
        assertThat(((java.sql.SQLException)root).getErrorCode()).isEqualTo(3819);
    }
}
