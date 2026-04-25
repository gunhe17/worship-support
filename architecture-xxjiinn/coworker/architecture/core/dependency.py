import argparse
import ast
from pathlib import Path


def _module_candidates(rel_path: Path) -> set[str]:
    """
    파일 상대 경로에서 가능한 dotted import 모듈명 후보를 만든다.
    예) architecture/domain/user/birth.py →
        {"birth", "user.birth", "domain.user.birth", "architecture.domain.user.birth"}
    """
    parts = list(rel_path.with_suffix("").parts)
    if parts and parts[-1] == "__init__":
        parts = parts[:-1]
    return {".".join(parts[i:]) for i in range(len(parts))}


def find_dependency(
    file: Path,
    name: str | None = None,
    *,
    root: Path | None = None,
) -> list[tuple[Path, int]]:
    """
    file: 정의가 들어있는 .py 파일 경로
    name: 찾고자 하는 클래스/함수명 (생략 시 모듈 import 전체 매칭)
    root: 스캔 루트 (생략 시 cwd)
    """
    file = Path(file).resolve()
    root = (root or Path.cwd()).resolve()

    rel = file.relative_to(root)
    candidates = _module_candidates(rel)

    hits: list[tuple[Path, int]] = []
    for path in root.rglob("*.py"):
        if path.resolve() == file:
            continue

        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(path))

        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                if node.module not in candidates:
                    continue
                if name is None:
                    hits.append((path, node.lineno))
                else:
                    for alias in node.names:
                        if alias.name == name:
                            hits.append((path, node.lineno))
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name in candidates:
                        hits.append((path, node.lineno))

    return hits


def main():
    parser = argparse.ArgumentParser(
        prog="dependency",
        description="주어진 파일(과 심볼)을 import하는 위치를 찾는다",
    )
    parser.add_argument("file", type=Path, help="대상 .py 파일 경로")
    parser.add_argument("name", nargs="?", help="대상 심볼명 (생략 시 모듈 전체)")
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="스캔 루트 (기본: 현재 디렉터리)",
    )
    args = parser.parse_args()

    hits = find_dependency(args.file, args.name, root=args.root)

    label = f"{args.file}" + (f"::{args.name}" if args.name else "")
    if not hits:
        print(f"no usages of {label}")
        return

    print(f"{len(hits)} usage(s) of {label}:")
    for path, line in hits:
        print(f"  {path}:{line}")


if __name__ == "__main__":
    main()
