#!/usr/bin/env bash
# Capture desktop + mobile screenshots of the running preview.
# - Reads CAPTURE_URL (exact URL to open) and CAPTURE_DIR (output dir, outside source).
# - Saves final-desktop.png (1440x900) and final-mobile.png (390x844).
# - Closes its own browser; never touches the app server (leaves it running).
# - Exit 75: temporary navigation/browser infrastructure failure.
# - Exit 1: script usage error or rendering defect.
# - Every command is timed with /usr/bin/time -p.
set -euo pipefail
time -p cd "$(dirname "$0")"

if [[ -z "${CAPTURE_URL:-}" ]]; then echo "CAPTURE_URL is not set" >&2; exit 1; fi
if [[ -z "${CAPTURE_DIR:-}" ]]; then echo "CAPTURE_DIR is not set" >&2; exit 1; fi
if [[ -z "${RUNTIME_DIR:-}" ]]; then echo "RUNTIME_DIR is not set" >&2; exit 1; fi

/usr/bin/time -p mkdir -p "$CAPTURE_DIR"

/usr/bin/time -p env "CAPTURE_URL=$CAPTURE_URL" bash -c '
code="$(curl --silent --location --max-time 15 --output /dev/null --write-out "%{http_code}" "$CAPTURE_URL" || echo 000)"
echo "probe $CAPTURE_URL -> HTTP $code"
case "$code" in
  2*|3*) exit 0 ;;
  000|408|429|500|502|503|504) echo "transient preview failure (HTTP $code)" >&2; exit 75 ;;
  *) echo "preview rejected the request (HTTP $code)" >&2; exit 1 ;;
esac
'
probe_rc=$?
if [[ $probe_rc -ne 0 ]]; then exit $probe_rc; fi

set +e
/usr/bin/time -p node "${RUNTIME_DIR}/scripts/default-capture.mjs"
rc=$?
set -e

if [[ $rc -eq 0 ]]; then
  /usr/bin/time -p test -s "$CAPTURE_DIR/final-desktop.png"
  /usr/bin/time -p test -s "$CAPTURE_DIR/final-mobile.png"
  /usr/bin/time -p ls -la "$CAPTURE_DIR/final-desktop.png" "$CAPTURE_DIR/final-mobile.png"
  echo "capture complete in $CAPTURE_DIR"
else
  echo "capture backend exited $rc" >&2
fi
exit $rc
