package com.worship.core;

import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.assertj.core.api.Assertions.*;

/** Forward-only migration of preexisting data in this disposable container, never a deployed database. */
@Testcontainers
class MigrationUpgradeTest {
    @Container static final MySQLContainer MYSQL=new MySQLContainer("mysql:8.4");
    Flyway flyway(String target){return Flyway.configure().dataSource(MYSQL.getJdbcUrl(),MYSQL.getUsername(),MYSQL.getPassword()).target(target).load();}
    @Test void singleAdminUpgradeRejectsLegacyMultipleAdminsWithoutChoosingOne()throws Exception{
        try(var legacy=new MySQLContainer("mysql:8.4")){
            legacy.start();Flyway.configure().dataSource(legacy.getJdbcUrl(),legacy.getUsername(),legacy.getPassword()).target("12").load().migrate();
            try(var connection=DriverManager.getConnection(legacy.getJdbcUrl(),legacy.getUsername(),legacy.getPassword());var sql=connection.createStatement()){
                sql.executeUpdate("INSERT INTO user_account(id,state,created_at) VALUES(1,'ACTIVE',UTC_TIMESTAMP(6)),(2,'ACTIVE',UTC_TIMESTAMP(6))");
                sql.executeUpdate("INSERT INTO workspace(id,name,created_at) VALUES(1,'Legacy shared',UTC_TIMESTAMP(6))");
                sql.executeUpdate("INSERT INTO workspace_membership(workspace_id,user_id,role,state) VALUES(1,1,'ADMIN','ACTIVE'),(1,2,'ADMIN','ACTIVE')");
                var upgrade=Flyway.configure().dataSource(legacy.getJdbcUrl(),legacy.getUsername(),legacy.getPassword()).target("13").load();
                assertThatThrownBy(upgrade::migrate).isInstanceOf(org.flywaydb.core.api.FlywayException.class).hasMessageContaining("single_active_admin");
                try(var rows=sql.executeQuery("SELECT COUNT(*) FROM workspace_membership WHERE workspace_id=1 AND role='ADMIN' AND state='ACTIVE'")){assertThat(rows.next()).isTrue();assertThat(rows.getInt(1)).isEqualTo(2);}
                try(var rows=sql.executeQuery("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='workspace_membership' AND COLUMN_NAME='active_admin'")){assertThat(rows.next()).isTrue();assertThat(rows.getInt(1)).isZero();}
            }
        }
    }
    @Test void constraintUpgradeRejectsInvalidLegacyRowsWithoutGuessingValues()throws Exception{
        try(var legacy=new MySQLContainer("mysql:8.4")){
            legacy.start();var old=Flyway.configure().dataSource(legacy.getJdbcUrl(),legacy.getUsername(),legacy.getPassword()).target("10").load();old.migrate();
            try(var connection=DriverManager.getConnection(legacy.getJdbcUrl(),legacy.getUsername(),legacy.getPassword());var sql=connection.createStatement()){
                sql.executeUpdate("INSERT INTO user_account(id,state,created_at) VALUES(1,'ACTIVE',UTC_TIMESTAMP(6))");sql.executeUpdate("INSERT INTO workspace(id,name,created_at) VALUES(1,'Legacy',UTC_TIMESTAMP(6))");
                sql.executeUpdate("INSERT INTO workspace_membership(workspace_id,user_id,role,state,end_reason) VALUES(1,1,'MEMBER','ENDED',NULL)");
                var next=Flyway.configure().dataSource(legacy.getJdbcUrl(),legacy.getUsername(),legacy.getPassword()).target("11").load();
                assertThatThrownBy(next::migrate).isInstanceOf(org.flywaydb.core.api.FlywayException.class).hasMessageContaining("membership_end");
                try(var rows=sql.executeQuery("SELECT end_reason FROM workspace_membership")){assertThat(rows.next()).isTrue();assertThat(rows.getString(1)).isNull();}
                // Test fixture correction only; no runtime policy invents a reason for a legacy row.
                sql.executeUpdate("UPDATE workspace_membership SET end_reason='LEFT'");
                sql.executeUpdate("INSERT INTO document(id,workspace_id,title,type,access_policy,modified_at) VALUES(1,1,'Legacy','SETLIST','RESTRICTED',UTC_TIMESTAMP(6))");
                sql.executeUpdate("INSERT INTO immutable_export(workspace_id,document_id,actor_id,command_key,source_version,canonical_json,snapshot_hash,created_at,status,attempt_id,started_at,object_key,artifact_hash,byte_size) VALUES(1,1,1,'legacy-null-size',0,'{}','"+"a".repeat(64)+"',UTC_TIMESTAMP(6),'SUCCEEDED',UUID(),UTC_TIMESTAMP(6),'probe','"+"b".repeat(64)+"',NULL)");
                next.repair();assertThatThrownBy(next::migrate).isInstanceOf(org.flywaydb.core.api.FlywayException.class).hasMessageContaining("export_artifact");
                try(var rows=sql.executeQuery("SELECT byte_size FROM immutable_export WHERE command_key='legacy-null-size'")){assertThat(rows.next()).isTrue();assertThat(rows.getObject(1)).isNull();}
                // MySQL commits the earlier membership ALTER before the export ALTER fails. Re-running remains safe.
                sql.executeUpdate("UPDATE immutable_export SET byte_size=1 WHERE command_key='legacy-null-size'");next.repair();assertThat(next.migrate().migrationsExecuted).isEqualTo(1);
                assertThatThrownBy(()->sql.executeUpdate("INSERT INTO workspace_membership(workspace_id,user_id,role,state,end_reason) VALUES(1,1,'MEMBER','ENDED',NULL)"))
                    .isInstanceOf(java.sql.SQLException.class).hasMessageContaining("membership_end");
            }
        }
    }
    @Test void existingIdentityWorkspaceAndDocumentSurviveForwardUpgrade()throws Exception{
        assertThat(flyway("3").migrate().migrationsExecuted).isEqualTo(3);
        try(var connection=DriverManager.getConnection(MYSQL.getJdbcUrl(),MYSQL.getUsername(),MYSQL.getPassword());var sql=connection.createStatement()){
            sql.executeUpdate("INSERT INTO user_account(id,state,created_at) VALUES(1,'ACTIVE',UTC_TIMESTAMP(6))");
            sql.executeUpdate("INSERT INTO user_email(user_id,email,verified,primary_email) VALUES(1,'existing@example.org',TRUE,TRUE)");
            sql.executeUpdate("INSERT INTO workspace(id,name,created_at) VALUES(1,'Existing workspace',UTC_TIMESTAMP(6))");
            sql.executeUpdate("INSERT INTO workspace_membership(workspace_id,user_id,role,state) VALUES(1,1,'ADMIN','ACTIVE')");
            assertThat(flyway("7").migrate().migrationsExecuted).isEqualTo(4);
            sql.executeUpdate("INSERT INTO document(id,workspace_id,title,type,access_policy,version,modified_at) VALUES(1,1,'Existing document','SETLIST','RESTRICTED',12,UTC_TIMESTAMP(6))");
            sql.executeUpdate("INSERT INTO document_grant(workspace_id,document_id,membership_id,role) VALUES(1,1,1,'MANAGER')");
            sql.executeUpdate("INSERT INTO setlist(workspace_id,document_id,notes) VALUES(1,1,'Existing notes')");
            sql.executeUpdate("INSERT INTO audit_log(actor_id,event,occurred_at) VALUES(1,'LEGACY_SECURITY_EVENT',UTC_TIMESTAMP(6))");
            sql.executeUpdate("INSERT INTO playlist_command(workspace_id,document_id,actor_id,authorization_id,command_key,request_hash,marker,source_version,canonical_json,status,started_at) VALUES(1,1,1,99,'legacy','"+"a".repeat(64)+"','00000000-0000-0000-0000-000000000001',12,'{}','UNCERTAIN',UTC_TIMESTAMP(6))");
            assertThat(flyway("latest").migrate().migrationsExecuted).isEqualTo(9);
            flyway("latest").validate();assertThat(flyway("latest").migrate().migrationsExecuted).isZero();
            try(var rows=sql.executeQuery("SELECT state,terminated_at FROM workspace WHERE id=1")){assertThat(rows.next()).isTrue();assertThat(rows.getString(1)).isEqualTo("ACTIVE");assertThat(rows.getObject(2)).isNull();}
            assertThatThrownBy(()->sql.executeUpdate("UPDATE workspace SET state='TERMINATED' WHERE id=1")).isInstanceOf(java.sql.SQLException.class).hasMessageContaining("workspace_termination");
            try(var rows=sql.executeQuery("SELECT d.version,s.notes,e.email,m.role FROM document d JOIN setlist s ON s.document_id=d.id JOIN workspace_membership m ON m.workspace_id=d.workspace_id JOIN user_email e ON e.user_id=m.user_id WHERE d.id=1")){assertThat(rows.next()).isTrue();assertThat(rows.getLong(1)).isEqualTo(12);assertThat(rows.getString(2)).isEqualTo("Existing notes");assertThat(rows.getString(3)).isEqualTo("existing@example.org");assertThat(rows.getString(4)).isEqualTo("ADMIN");}
            try(var rows=sql.executeQuery("SELECT COUNT(*) FROM immutable_export")){assertThat(rows.next()).isTrue();assertThat(rows.getInt(1)).isZero();}
            try(var rows=sql.executeQuery("SELECT status,attempt_id FROM playlist_command WHERE command_key='legacy'")){assertThat(rows.next()).isTrue();assertThat(rows.getString(1)).isEqualTo("UNCERTAIN");assertThat(rows.getString(2)).hasSize(36);}
            try(var rows=sql.executeQuery("SELECT actor_id,event,target_type,target_id,workspace_id,change_field FROM audit_log WHERE event='LEGACY_SECURITY_EVENT'")){assertThat(rows.next()).isTrue();assertThat(rows.getLong(1)).isEqualTo(1);assertThat(rows.getString(2)).isEqualTo("LEGACY_SECURITY_EVENT");for(int column=3;column<=6;column++)assertThat(rows.getObject(column)).isNull();}
            // UPDATE isolates the role CHECK: INSERT on this fixture would fail the duplicate key first.
            assertThatThrownBy(()->sql.executeUpdate("UPDATE document_grant SET role='OWNER' WHERE document_id=1"))
                .isInstanceOf(java.sql.SQLException.class).hasMessageContaining("grant_role")
                .satisfies(failure->assertThat(((java.sql.SQLException)failure).getErrorCode()).isEqualTo(3819));
            try(var rows=sql.executeQuery("SELECT role FROM document_grant WHERE document_id=1")){assertThat(rows.next()).isTrue();assertThat(rows.getString(1)).isEqualTo("MANAGER");}
        }
    }
}
