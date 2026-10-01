#!/usr/bin/env bash
# Serve the built static Minecraft web app in the foreground.
# - Source + built output stay inside PROJECT_DIR (./dist).
# - Worker metadata only goes to OPENCODE_WEB_DIR / RUNNER_TEMP.
# - Writes $OPENCODE_WEB_DIR/deployment-output.json for the controller.
# - Every command is timed with /usr/bin/time -p.
set -euo pipefail
time -p cd "$(dirname "$0")"
PROJECT_DIR="$PWD"
PORT="${PORT:-3000}"
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
OUT_DIR="$PROJECT_DIR/dist"

/usr/bin/time -p mkdir -p "$OUT_DIR"
/usr/bin/time -p test -f "$PROJECT_DIR/index.html"
/usr/bin/time -p cp -f "$PROJECT_DIR/index.html" "$OUT_DIR/index.html"
/usr/bin/time -p mkdir -p "$WEB_DIR"
/usr/bin/time -p env "PROJECT_DIR=$PROJECT_DIR" "OUT_DIR=$OUT_DIR" "WEB_DIR=$WEB_DIR" node -e '
const fs = require("fs");
fs.mkdirSync(process.env.WEB_DIR, { recursive: true });
const payload = { project: process.env.PROJECT_DIR, directory: process.env.OUT_DIR };
fs.writeFileSync(process.env.WEB_DIR + "/deployment-output.json", JSON.stringify(payload));
console.log("deployment-output: " + JSON.stringify(payload));
'
/usr/bin/time -p test -f "$OUT_DIR/index.html"
echo "Serving $OUT_DIR on port $PORT (foreground)"
/usr/bin/time -p env "PORT=$PORT" "OUT_DIR=$OUT_DIR" python3 -c '
import http.server, functools, os
port = int(os.environ["PORT"])
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.environ["OUT_DIR"])
http.server.ThreadingHTTPServer(("0.0.0.0", port), handler).serve_forever()
'
