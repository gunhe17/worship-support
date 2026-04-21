import os

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from worship_support.mcp.dependency import report_dependency

server = FastMCP(
    "worship-support-dev",
    host="0.0.0.0",
    port=int(os.environ["DEVELOP_MCP_PORT"]),
    transport_security=(
        TransportSecuritySettings(
            allowed_hosts=[
                "mcp:*", 
                "localhost:*", 
                "127.0.0.1:*", 
                "[::1]:*"
            ],
        )
    ),
)

# #
# Functions

@server.tool()
def ping() -> str:
    return "pong"


@server.tool()
def show_dependency(file: str, name: str | None = None, root: str | None = None) -> dict:
    """대상 .py 파일(과 심볼)의 의존처/참조/사용처를 찾는다.

    다음과 같은 사용자 요청에서 호출되어야 한다:
    - "X의 의존성/의존처 확인"
    - "X를 어디서 쓰는지/참조하는지/import하는지 찾아줘"
    - "X 사용처/레퍼런스/usage 조회"
    - 특정 모듈·심볼(클래스·함수·변수)이 어느 파일에서 import 또는 참조되는지 알고 싶을 때

    Args:
        file: 대상 .py 파일 경로
        name: 대상 심볼명 (클래스/함수/변수 등, 생략 시 모듈 전체)
        root: 스캔 루트 (생략 시 프로젝트 루트 자동 감지)
    """
    return report_dependency(file, name, root)


# #
# Run

if __name__ == "__main__":
    server.run(transport="streamable-http")