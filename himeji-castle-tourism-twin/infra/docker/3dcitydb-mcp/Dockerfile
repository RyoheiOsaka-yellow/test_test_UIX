# TUM 3DCityDB MCP Server（https://github.com/tum-gis/3dcitydb-mcp-server）を SSE トランスポートで起動する最小イメージ
# LLM API キーは不要（MCP サーバ本体のみ。Gradio エージェント UI は含めない）
FROM python:3.11-slim
RUN pip install --no-cache-dir "3dcitydb-mcp-server==0.3.2" "mcp>=1.2,<2"   # 0.3.2 は mcp 1.x の low-level API（mcp 2.x では起動しない）
WORKDIR /app
EXPOSE 8080
# 接続情報は環境変数 CITYDB_HOST / CITYDB_PORT / CITYDB_NAME / CITYDB_USER / CITYDB_PASSWORD / CITYDB_SCHEMA
CMD ["3dcitydb-mcp-sse", "--host", "0.0.0.0", "--port", "8080"]
