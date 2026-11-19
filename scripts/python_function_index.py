"""Read static Python function definitions for the MISSY source-code catalogue."""
import ast
import json
import sys
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")
source = sys.stdin.read()
rows = []
def visit(node, scope):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
        name = getattr(node, "name", "lambda")
        scope = scope + "/" + name
        rows.append({"name": name, "scope": scope, "line": node.lineno, "endLine": node.end_lineno, "column": node.col_offset + 1, "kind": type(node).__name__})
    for child in ast.iter_child_nodes(node):
        visit(child, scope)
visit(ast.parse(source), "module")
print(json.dumps(rows))
