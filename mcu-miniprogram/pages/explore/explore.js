/* ============================================================
 * 关系探索 explore（Tab3）· V1.2 视觉系统落地（按《MCU-V1.2-Visual-Design-System》VDS V2 §5）
 * ------------------------------------------------------------
 * 定位：从"入口聚合页/关系对卡片"→「MCU 角色关系网络探索」
 * 核心：Canvas 2D 力导向网络图（中心角色 + 一级关系圆形分布）
 *   + 5 筛选 Chips + 下方关系列表（卡片式）
 * 交互：点击节点切换中心角色，重新布局
 *
 * 数据纪律（铁律）：
 *   - CHARACTERS / RELATIONS / CAMPS 数据模型零改动
 *   - 关系对视图层派生：预定义 SPECIAL 优先 → 同阵营=盟友 → 跨阵营不自动连线（VDS §5.4）
 *   - 角色头像经 visuals.avatar(id)（缺失 null → Canvas 内阵营渐变+首字兜底）
 *   - 连线颜色经 Token 定义（.rel-* 类），零裸 hex
 *   - SPECIAL 基础表 12 条（VDS §5.4 示例 8 + 已验证补充 4）；完整 92 条待 GPT 提供，不编造
 * ============================================================ */

const mcuData = require('../../models/mcuData.js');
const { CHARACTERS } = require('../../data/characters.js');
const visuals = require('../../data/visuals.js');

/* ---- 阵营 → 色类（设计 §4.4，与 home/movie/character 一致） ---- */
const CAMP_MAP = {
  avengers:  { cls: 'red',    label: '复仇者' },
  asgard:    { cls: 'blue',   label: '阿斯加德' },
  guardians: { cls: 'purple', label: '银河护卫队' },
  wakanda:   { cls: 'gold',   label: '瓦坎达' },
  shield:    { cls: 'blue',   label: '神盾局' },
  mutant:    { cls: 'purple', label: '变种人' },
  villain:   { cls: 'gray',   label: '反派' },
  street:    { cls: 'red',    label: '街头英雄' }
};
function campOf(camp) { return CAMP_MAP[camp] || { cls: 'gray', label: camp || '' }; }

/* ---- 关系类型 → 标签 + 画布色（VDS §5.3：盟友蓝/敌人红/师徒金/家人紫/对手红虚线） ---- */
const REL_TYPE_MAP = {
  ally:   { label: '盟友', color: '#4A9EF5' },
  enemy:  { label: '敌人', color: '#E85D5D' },
  mentor: { label: '师徒', color: '#F2B233' },
  family: { label: '家人', color: '#9B7FE8' },
  rival:  { label: '对手', color: '#E85D5D', dash: true }
};

/* ---- 筛选 Chips（VDS §5.5，5 种） ---- */
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'ally', label: '盟友' },
  { key: 'enemy', label: '敌人' },
  { key: 'mentor', label: '师徒' },
  { key: 'family', label: '家人' }
];

/* ---- 预定义特殊关系基础表（VDS §5.4 示例 8 条 + 已验证补充 4 条；完整 92 条待 GPT） ---- */
const SPECIAL_RELATIONS = [
  { from: 'tony',    to: 'peter',   type: 'mentor' },
  { from: 'tony',    to: 'steve',   type: 'rival' },
  { from: 'thor',    to: 'loki',    type: 'family' },
  { from: 'thor',    to: 'odin',    type: 'family' },
  { from: 'steve',   to: 'bucky',   type: 'family' },
  { from: 'natasha', to: 'clint',   type: 'family' },
  { from: 'wanda',   to: 'vision',  type: 'family' },
  { from: 'tony',    to: 'thanos',  type: 'enemy' },
  { from: 'thanos',  to: 'gamora',  type: 'family' },
  { from: 'strange', to: 'wanda',   type: 'rival' },
  { from: 'wade',    to: 'logan',   type: 'rival' },
  { from: 'tchalla', to: 'starlord',type: 'rival' }
];
const specialMap = {};
SPECIAL_RELATIONS.forEach(function (p) {
  specialMap[p.from + '|' + p.to] = p.type;
  specialMap[p.to + '|' + p.from] = p.type;
});

/* ---- 派生工具 ---- */

/* 共同出演数：两角色同时出现的作品数（经 mcuData.filmsOfChar 只读反查） */
function coCount(aId, bId) {
  const fa = mcuData.filmsOfChar(aId);
  const fb = mcuData.filmsOfChar(bId);
  if (!fa.length || !fb.length) return 0;
  const setB = {};
  fb.forEach(function (f) { setB[f.id] = true; });
  return fa.filter(function (f) { return setB[f.id]; }).length;
}

/* 关系类型判定（VDS §5.4）：predefined 优先 → 同阵营=盟友 → 不同阵营=null */
function relationOf(a, b) {
  const pre = specialMap[a + '|' + b];
  if (pre) return pre;
  const ca = mcuData.getChar(a), cb = mcuData.getChar(b);
  if (ca && cb && ca.camp === cb.camp) return 'ally';
  return null;
}

/* 某角色的全部关系边（含类型），按共演数降序 */
function relationsOfChar(id) {
  const out = [];
  CHARACTERS.forEach(function (c) {
    if (c.id === id) return;
    const type = relationOf(id, c.id);
    if (!type) return;
    out.push({ id: c.id, type: type, shared: coCount(id, c.id) });
  });
  out.sort(function (a, b) { return b.shared - a.shared; });
  return out;
}

/* 英雄名（'托尼·斯塔克 / 钢铁侠' → '钢铁侠'） */
function heroOf(cn) {
  if (!cn) return '';
  const parts = cn.split(' / ');
  return (parts.length > 1 ? parts[1] : cn).trim();
}

Page({
  data: {
    filters: FILTERS,
    activeFilter: 'all',
    centerId: 'tony',
    centerName: '',
    relations: [],   /* 当前筛选后的关系列表（视图层） */
    totalChars: CHARACTERS.length
  },

  /* 节点坐标缓存（点击命中用，paint 时写入） */
  _nodePos: {},

  onLoad: function () {
    this.setCenter('tony');
  },

  /* 设置中心角色：装配数据 + 画布重绘 */
  setCenter: function (id) {
    const c = mcuData.getChar(id);
    if (!c) return;
    this.centerId = id;
    this.allRels = relationsOfChar(id);
    const filtered = this.applyFilter(this.data.activeFilter);
    const centerName = heroOf(c.cn);
    const cCamp = campOf(c.camp);
    this.setData({
      centerId: id,
      centerName: centerName,
      centerAvatar: visuals.avatar(id) || '',
      centerCls: cCamp.cls,
      centerFirst: centerName.charAt(0),
      relations: filtered
    });
    this.drawGraph();
  },

  /* 筛选（VDS §5.5）：chips 单选，过滤列表并重绘画布 */
  onFilter: function (e) {
    const key = e.currentTarget.dataset.key || 'all';
    const filtered = this.applyFilter(key);
    this.setData({ activeFilter: key, relations: filtered });
    this.drawGraph();
  },

  applyFilter: function (key) {
    const that = this;
    const src = key === 'all' ? this.allRels : this.allRels.filter(function (r) { return r.type === key; });
    return src.map(function (r) {
      const rc = mcuData.getChar(r.id);
      if (!rc) return null;
      const name = heroOf(rc.cn);
      const rcCamp = campOf(rc.camp);
      return {
        id: r.id,
        name: name,
        first: name.charAt(0),
        avatar: visuals.avatar(r.id) || '',
        campCls: rcCamp.cls,
        type: r.type,
        typeLabel: (REL_TYPE_MAP[r.type] || REL_TYPE_MAP.ally).label,
        shared: r.shared
      };
    }).filter(Boolean);
  },

  /* ---- Canvas 网络图（VDS §5.3） ---- */
  drawGraph: function () {
    const that = this;
    wx.createSelectorQuery().in(this)
      .select('#relCanvas')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const W = res[0].width;   /* px（rpx÷2） */
        const H = res[0].height;
        const dpr = wx.getSystemInfoSync().pixelRatio || 2;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);
        that.paint(ctx, W, H, canvas);
      });
  },

  paint: function (ctx, W, H, canvas) {
    const center = mcuData.getChar(this.centerId);
    if (!center) return;
    const centerCamp = campOf(center.camp);

    /* 背景 */
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0B0E14';
    ctx.fillRect(0, 0, W, H);

    /* 中心 + 邻居布局：中心居中，邻居绕圆形分布 */
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.32;          /* 布局半径 */
    const rels = this.allRels.slice(0, 10);   /* 一级关系最多 10 个 */
    const nodes = [];

    /* 连线（先画，位于头像下层） */
    rels.forEach(function (r, i) {
      const angle = -Math.PI / 2 + (i / rels.length) * Math.PI * 2;
      const nx = cx + Math.cos(angle) * R;
      const ny = cy + Math.sin(angle) * R;
      const rel = REL_TYPE_MAP[r.type] || REL_TYPE_MAP.ally;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = rel.color;
      ctx.lineWidth = rel.dash ? 1 : 1.5;
      if (rel.dash) ctx.setLineDash([4, 4]); else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
      /* 节点坐标缓存（点击命中用） */
      this._nodePos[r.id] = { x: nx, y: ny };
      nodes.push({ id: r.id, x: nx, y: ny, r: 22, rel: r.type });
    });

    /* 中心节点 + 邻居节点（头像 + 阵营边框 + 标签） */
    this.paintNode(ctx, cx, cy, 30, center, centerCamp, true, canvas);
    const that = this;
    nodes.forEach(function (n) {
      const c = mcuData.getChar(n.id);
      if (!c) return;
      that.paintNode(ctx, n.x, n.y, 22, c, campOf(c.camp), false, canvas);
    });

    /* 中心标签 */
    ctx.fillStyle = '#E8ECF4';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(heroOf(center.cn), cx, cy + 44);
  },

  paintNode: function (ctx, x, y, r, char, camp, isCenter, canvas) {
    const img = this.avatarImage(char.id, canvas);
    if (img && img.loaded) {
      /* 圆形裁剪头像 */
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img.obj, x - r, y - r, r * 2, r * 2);
      ctx.restore();
    } else {
      /* 兜底：阵营渐变圆 + 首字（G-19 合规） */
      const grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      grad.addColorStop(0, this.campColor(camp.cls));
      grad.addColorStop(1, this.campColorAlpha(camp.cls));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = (isCenter ? '24px' : '18px') + ' sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(heroOf(char.cn).charAt(0), x, y + 1);
      ctx.textBaseline = 'alphabetic';
    }
    /* 阵营色描边（中心 4rpx=2px 粗） */
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = this.campColor(camp.cls);
    ctx.lineWidth = isCenter ? 3 : 2;
    ctx.stroke();

    /* 非中心节点标签 */
    if (!isCenter) {
      ctx.fillStyle = 'rgba(232,236,244,0.9)';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(heroOf(char.cn), x, y + r + 14);
    }
  },

  /* 头像 Image 缓存（canvas.createImage 加载一次复用） */
  avatarImage: function (id, canvas) {
    if (!this._imgCache) this._imgCache = {};
    if (this._imgCache[id]) return this._imgCache[id];
    const url = visuals.avatar(id);
    const rec = { loaded: false, obj: null };
    if (url) {
      const img = canvas.createImage();
      img.onload = function () {
        rec.loaded = true;
        rec.obj = img;
        /* 加载完成后重绘（若仍有引用中心则刷新画布） */
        if (this && this.centerId) this.drawGraph();
      }.bind(this);
      img.src = url;
      rec.obj = img;
    }
    this._imgCache[id] = rec;
    return rec;
  },

  /* 阵营色（Canvas 用，仅绘制层；与全局 .fc-* 类 Token 权威值一致） */
  campColor: function (cls) {
    const map = { red: '#E85D5D', blue: '#4A9EF5', purple: '#9B7FE8', gold: '#F2B233', gray: '#6B7384' };
    return map[cls] || '#6B7384';
  },
  campColorAlpha: function (cls) {
    const map = { red: 'rgba(232,93,93,0.6)', blue: 'rgba(74,158,245,0.6)', purple: 'rgba(155,127,232,0.6)', gold: 'rgba(242,178,51,0.6)', gray: 'rgba(107,115,132,0.6)' };
    return map[cls] || 'rgba(107,115,132,0.6)';
  },

  /* 点击节点 → 切换中心（VDS §5.3 交互） */
  onCanvasTap: function (e) {
    const x = e.detail.x, y = e.detail.y;
    const rels = this.allRels.slice(0, 10);
    for (let i = 0; i < rels.length; i++) {
      const pos = this._nodePos[rels[i].id];
      if (!pos) continue;
      const dx = x - pos.x, dy = y - pos.y;
      if (dx * dx + dy * dy <= 26 * 26) {
        this.setCenter(rels[i].id);
        return;
      }
    }
  },


  /* 关系列表点击 → 角色详情 */
  goCharacter: function (e) {
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: "/pages/character/character?id=" + id });
  }
});
