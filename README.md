# worship-support

## Dev Container 실행

1. `.env/.env.develop` 생성
   <br>

   ```bash
   cp .env/.env.develop.example .env/.env.develop
   ```

<br>

2. Dev Container 진입 (`command + shift + p`)

   - 최초 1회: `Dev Containers: Rebuild and Reopen in Container`
   - 이후: `Dev Containers: Reopen in Container`
   

<br>

3. `fastapi server` 실행
   <br>
   
   ```bash
   python worship_support/api/bin/server.py
   ```

<br>

4. Claude Code에서 개발용 MCP 정상 연결 확인
   <br>

   ```
   /mcp
   ```

   - 목록에 `worship-support-dev`가 존재하는지 확인

<br>



## Claude Code

- 로그인 정보(`~/.claude.json`)는 host와 bind mount로 공유됩니다.
   *컨테이너 내부에서 최초 1회 로그인이 필요합니다. #macos-key-chain?
- session history(`/root/.claude`)는 named volume(`claude-config`)으로 컨테이너 내부에 격리되어 관리됩니다.