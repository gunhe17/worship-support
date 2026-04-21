"""AST 기반 import 사용처 탐색."""
import ast
from pathlib import Path


def _default_root() -> Path:
    here = Path(__file__).resolve()
    for parent in [here, *here.parents]:
        if (parent / "pyproject.toml").exists():
            return parent
    return Path.cwd()


def _find_usages(
    file: Path,
    name: str | None = None,
    root: Path | None = None,
) -> list[tuple[Path, int]]:
    file = file.resolve()
    root = (root or _default_root()).resolve()
    rel = file.relative_to(root)

    parts = list(rel.with_suffix("").parts)
    if parts and parts[-1] == "__init__":
        parts = parts[:-1]
    candidates = {".".join(parts[i:]) for i in range(len(parts))}

    hits: list[tuple[Path, int]] = []
    for path in root.rglob("*.py"):
        if path.resolve() == file:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
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


def report_dependency(
    file: str,
    name: str | None = None,
    root: str | None = None,
) -> dict:
    file_path = Path(file)
    root_path = Path(root) if root else None
    base = (root_path or _default_root()).resolve()
    hits = _find_usages(file_path, name, root_path)
    result: list[str] = []
    for path, line in hits:
        rel = path.relative_to(base) if path.is_relative_to(base) else path
        result.append(f"{rel}:{line}")
    return {"result": result}
