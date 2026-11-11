#!/bin/bash
set -e
cd /www/wwwroot/mcu-atlas-news/workspace/news/pipeline
echo "=== DEPLOYED FILE ==="
sha256sum tools/captures-to-candidates.cjs
/opt/node24/bin/node --check tools/captures-to-candidates.cjs && echo SYNTAX_OK
echo "=== PURE FUNCTION SELF-CHECK ==="
/opt/node24/bin/node -e 'const s=require("./tools/captures-to-candidates.cjs"),fs=require("fs"); console.log("DEFAULT_LIMIT="+s.DEFAULT_LIMIT+" no_arg="+s.resolveLimit(s.parseArgs([]))+" limit20="+s.resolveLimit(s.parseArgs(["--limit","20"]))+" limit50="+s.resolveLimit(s.parseArgs(["--limit","50"]))+" mcu_hit="+s.isMcuRelated({title_raw:"Marvel Studios Avengers: Doomsday",raw_excerpt:""})+" non_mcu="+s.isMcuRelated({title_raw:"Disney Parks Notice",raw_excerpt:""})); const d=JSON.parse(fs.readFileSync("tests/fixtures/20261106.captures.json","utf8")); const r=s.selectBatch(d.captures,{date:"20261106",limit:20,nowMs:Date.UTC(2026,10,6,23,59,59,999)}); console.log("sampling="+JSON.stringify(s.summarizeSources(r.batch))+" total="+r.batch.length+" s006_filter="+JSON.stringify(r.stats.s006_filter))'
echo "=== 24 REGRESSION TESTS ==="
/opt/node24/bin/node tests/test-capture-sampling.cjs
