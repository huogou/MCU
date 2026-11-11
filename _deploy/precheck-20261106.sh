#!/bin/bash
set -e
cd /www/wwwroot/mcu-atlas-news/workspace/news/pipeline
echo "=== CAPTURE ARCHIVE PRECHECK ==="
/opt/node24/bin/node -e 'const fs=require("fs"),crypto=require("crypto");const p="captures/20261106.captures.json";const raw=fs.readFileSync(p);const d=JSON.parse(raw.toString("utf8"));const a=d.captures;const by={};a.forEach(c=>by[c.registry_id]=(by[c.registry_id]||0)+1);const late=a.filter(c=>Date.parse(c.published_at)>Date.parse(c.fetched_at));const badTime=a.filter(c=>!Number.isFinite(Date.parse(c.published_at))||!Number.isFinite(Date.parse(c.fetched_at)));const badUrl=a.filter(c=>!/^https?:\/\//.test(String(c.source_url||"")));const pubs=a.map(c=>Date.parse(c.published_at)).sort((x,y)=>x-y);console.log("sha256="+crypto.createHash("sha256").update(raw).digest("hex"));console.log("schema="+d.schema_version+" layer="+d.layer+" doc_count="+d.count+" array="+a.length);console.log("by_source="+JSON.stringify(by));console.log("published_after_fetch="+late.length+" unparsable_time="+badTime.length+" invalid_url="+badUrl.length);console.log("min_pub="+new Date(pubs[0]).toISOString()+" max_pub="+new Date(pubs[pubs.length-1]).toISOString());console.log("fetched_at_unique="+JSON.stringify([...new Set(a.map(c=>c.fetched_at))]));if(a.length!==130||late.length||badTime.length||badUrl.length||by.S002!==20||by.S004!==10||by.S006!==100)process.exit(1);console.log("PRECHECK_ARCHIVE=PASS")'
echo "=== EXISTING CANDIDATES BEFORE GENERATION ==="
/opt/node24/bin/node -e 'const fs=require("fs"),crypto=require("crypto");const p="candidates/20261106.json";const raw=fs.readFileSync(p);const d=JSON.parse(raw.toString("utf8"));const by={},st={};d.candidates.forEach(c=>{by[c.registry_id]=(by[c.registry_id]||0)+1;st[c.gate_status]=(st[c.gate_status]||0)+1});console.log("sha256="+crypto.createHash("sha256").update(raw).digest("hex"));console.log("count="+d.count+" array="+d.candidates.length+" by_source="+JSON.stringify(by)+" gate_status="+JSON.stringify(st));console.log("first_id="+d.candidates[0].candidate_id+" last_id="+d.candidates[d.candidates.length-1].candidate_id)'
echo "=== ORDER / IDEMPOTENCY EVIDENCE ==="
grep -n -e "const batch = sampling.batch" -e "for (let i = 0; i < batch.length" -e "function popValid" -e "SOURCE_ORDER.forEach" tools/captures-to-candidates.cjs | head -8
grep -n -e "skipped" -e "conflicts" -e "registry_id" candidate-store.cjs | head -8
echo "=== BACKUP EXISTING CANDIDATES ==="
cp -p candidates/20261106.json candidates/20261106.json.bak-pregen-20261106
sha256sum candidates/20261106.json.bak-pregen-20261106
