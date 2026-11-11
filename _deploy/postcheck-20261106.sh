#!/bin/bash
set -e
cd /www/wwwroot/mcu-atlas-news/workspace/news/pipeline
echo "=== POST-GENERATION ARCHIVE ==="
/opt/node24/bin/node -e 'const fs=require("fs"),crypto=require("crypto");const p="candidates/20261106.json",raw=fs.readFileSync(p),d=JSON.parse(raw.toString("utf8")),a=d.candidates;const by={},st={},rel={m:0,s:0,c:0,empty:0},phases={},urls=new Set(),titles=new Set(),dup=[];const norm=t=>String(t||"").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").replace(/\s+/g," ").trim();a.forEach(c=>{by[c.registry_id]=(by[c.registry_id]||0)+1;st[c.gate_status]=(st[c.gate_status]||0)+1;const m=(c.related_movies||[]).length,s=(c.related_series||[]).length,ch=(c.related_characters||[]).length;rel.m+=m;rel.s+=s;rel.c+=ch;if(!m&&!s&&!ch)rel.empty++;const ph=(c.related_phases||[]).join(",")||"[]";phases[ph]=(phases[ph]||0)+1;const u=String(c.source_url||""),t=norm(c.title);if(urls.has(u)||titles.has(t))dup.push(c.candidate_id);urls.add(u);titles.add(t)});console.log("sha256="+crypto.createHash("sha256").update(raw).digest("hex"));console.log("count="+d.count+" array="+a.length+" by_source="+JSON.stringify(by)+" gate_status="+JSON.stringify(st));console.log("related_totals="+JSON.stringify(rel)+" phases="+JSON.stringify(phases));console.log("duplicate_url_or_title="+dup.length+" "+JSON.stringify(dup.slice(0,5)));console.log("missing_core_fields="+a.filter(c=>!c.title||!c.summary||!c.source_url||!c.published_at).length);console.log("ai_models="+JSON.stringify([...new Set(a.map(c=>c.ai_model))]));console.log("unique_urls="+urls.size+" unique_titles="+titles.size)'
echo "=== NEWLY ADDED ENTRIES ==="
/opt/node24/bin/node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync("candidates/20261106.json","utf8"));d.candidates.slice(20).forEach(c=>console.log(JSON.stringify({id:c.candidate_id,src:c.registry_id,source:c.source_name,title:c.title,summary:c.summary,url:c.source_url,published_at:c.published_at,gate_status:c.gate_status,category:c.category,related_movies:c.related_movies,related_series:c.related_series,related_characters:c.related_characters,related_phases:c.related_phases})))'
echo "=== EXISTING 20 PRESERVED (compare with pre-generation backup) ==="
/opt/node24/bin/node -e 'const fs=require("fs");const cur=JSON.parse(fs.readFileSync("candidates/20261106.json","utf8")).candidates;const old=JSON.parse(fs.readFileSync("candidates/20261106.json.bak-pregen-20261106","utf8")).candidates;const ids=x=>x.map(c=>c.candidate_id).join(",");console.log("old_count="+old.length+" cur_prefix_count="+cur.slice(0,old.length).length);console.log("ids_identical="+(ids(old)===ids(cur.slice(0,old.length))));console.log("titles_identical="+(old.map(c=>c.title).join("|")===cur.slice(0,old.length).map(c=>c.title).join("|")));console.log("appended_only="+(cur.length-old.length))'
echo "=== OBVIOUSLY UNRELATED / LOW-VALUE MARKERS ==="
/opt/node24/bin/node -e 'const fs=require("fs");const d=JSON.parse(fs.readFileSync("candidates/20261106.json","utf8")).candidates;const re=/(DC|蝙蝠侠|超人|指环王|阿索卡|饥饿游戏|戴帽子的猫|Terminal List|Hannibal|Letterboxd|WWE|Wild Cards)/i;const hit=d.filter(c=>re.test(c.title+" "+c.title_raw));console.log("marker_hits="+hit.length);hit.forEach(c=>console.log("  "+c.candidate_id+" ["+c.registry_id+"] "+c.title.slice(0,60)))'
echo "=== AI CALL COUNT FROM LOG ==="
echo -n "AI_SUCCESS="; grep -c "AI✓" /tmp/cand-gen-20261106.log || true
echo -n "AI_FAILED="; grep -c "AI✗" /tmp/cand-gen-20261106.log || true
echo "=== FILE SHA256 / PRODUCTION UNCHANGED ==="
sha256sum captures/20261106.captures.json candidates/20261106.json candidates/20261106.json.bak-pregen-20261106
sha256sum /www/wwwroot/mcu-h5/data/news.js
echo "=== GUARD STATUS ==="
grep -E 'enabled|autoProduction|productionAllowed' runner/scheduler.config.cjs | tail -3
