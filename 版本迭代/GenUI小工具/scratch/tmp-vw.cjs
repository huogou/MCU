function vw(s) { let w = 0; for (const ch of String(s)) w += ch.charCodeAt(0) < 128 ? 0.5 : 1; return w; }
const cur = {
  newcomer: 'MCU 有 30 多部，全看门槛太高，中途弃剧的风险远大于“错过细节”的损失。这条路线只留 12 部，先把主干立住。',
  essential: 'MCU 并不是每部都在推进同一个故事。这条路线把对主线可选的支线全部摘掉，只留实质推动剧情的必看。',
  doomsday: '8 部精简补课路线。终局之后时间前跳、多元宇宙开启、跨宇宙角色与新英雄入局——补完接上《复联5：毁灭之日》。'
};
const cand = {
  newcomer: 'MCU 有 30 多部，全看门槛太高。这条路线只留 12 部，先把主干立住。',
  essential: 'MCU 不是每部都推进同一个故事。这条路线只留真正推动主线的必看。',
  doomsday: '8 部精简补课路线。时间前跳、多元宇宙开启、跨宇宙角色入局，补完接上《复联5》。'
};
for (const k of Object.keys(cur)) {
  console.log(k, '当前 vw=', vw(cur[k]), '| 候选 vw=', vw(cand[k]));
}
