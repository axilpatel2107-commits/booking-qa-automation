#!/usr/bin/env bash
# Runs the JMeter load test in non-GUI mode and builds the HTML dashboard.
# Needs JMeter 5.6+ on your PATH (or set JMETER_HOME). Start the app first: npm start
#
# Examples:
#   npm run perf
#   USERS=50 DURATION=120 npm run perf
set -euo pipefail

JMETER="${JMETER_HOME:+$JMETER_HOME/bin/}jmeter"
command -v "$JMETER" >/dev/null || { echo "JMeter not found. Install it or set JMETER_HOME."; exit 2; }

OUT=performance/results
REPORT=performance/report
rm -rf "$OUT" "$REPORT"
mkdir -p "$OUT"

"$JMETER" -n \
  -t performance/booking-load.jmx \
  -l "$OUT/results.jtl" \
  -j "$OUT/jmeter.log" \
  -e -o "$REPORT" \
  -Jhost="${HOST:-localhost}" \
  -Jport="${PORT:-3000}" \
  -Jusers="${USERS:-20}" \
  -Jrampup="${RAMPUP:-10}" \
  -Jduration="${DURATION:-60}" \
  -Jjmeter.save.saveservice.output_format=csv

echo "HTML dashboard: $REPORT/index.html"
node scripts/check-jmeter-results.js "$OUT/results.jtl"
