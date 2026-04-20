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
def show_dependency(file: str, name: str | None = None, root: str | None = None) -> str:
    """주어진 .py 파일(과 심볼)을 import하는 위치를 찾는다.

    Args:
        file: 대상 .py 파일 경로
        name: 대상 심볼명 (생략 시 모듈 전체)
        root: 스캔 루트 (생략 시 프로젝트 루트 자동 감지)
    """
    return report_dependency(file, name, root)


# #
# Run

if __name__ == "__main__":
    server.run(transport="streamable-http")