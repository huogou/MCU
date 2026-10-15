/**
 * 视觉集成补丁：将 index.html 的 .mcu-* 画布样式区替换为设计稿实现
 * ------------------------------------------------------------
 * 设计稿：docs/产品/GenUI-MCU观影助手-画布视觉设计V1.0.html
 * 范围：仅替换「画布内容区」样式块（.mcu-*），不动 header / cosui 组件 / Tabs / 按钮
 * 原则：
 *   1. --mcu-* token 声明在各根容器（.mcu-route-canvas / .mcu-film-card / .mcu-discover-canvas），
 *      不写入 :root，不污染全局，不修改任何 --cos-* token。
 *   2. 优先复用 cos token；仅阶段色与档案金为新增（设计稿指定）。
 *   3. 等宽字体走系统字体栈，不引入外部字体文件。
 *   4. 程序化视觉卡全部 CSS 绘制（渐变 + 伪元素），零图片依赖。
 */
const fs = require('fs');
const path = require('path');

const INDEX = path.resolve(__dirname, '..', 'genui-app', 'index.html');
const html = fs.readFileSync(INDEX, 'utf8');

/* 定位「画布内容区」样式块的起止：注释头 → 操作区 Tabs 注释头 */
const START_RE = /\/\* =+\s*\n\s*\* 画布内容区/;
const END_RE = /\/\* =+\s*\n\s*\* 操作区 Tabs/;

const startMatch = html.match(START_RE);
const endMatch = html.match(END_RE);
if (!startMatch || !endMatch) {
  console.error('未定位到画布样式块', { start: !!startMatch, end: !!endMatch });
  process.exit(1);
}
const startIdx = startMatch.index;
const endIdx = endMatch.index;
if (endIdx <= startIdx) {
  console.error('样式块边界异常', { startIdx, endIdx });
  process.exit(1);
}
console.log('定位到样式块：' + startIdx + ' → ' + endIdx + '（' + (endIdx - startIdx) + ' 字节）');

/* ── 设计稿实现（.mcu-* 作用域）── */
const NEW_CSS = `        /* ============================================================
         * 画布内容区 · 设计稿 V1.0 实现（2026-10-13 视觉集成）
         * 来源：docs/产品/GenUI-MCU观影助手-画布视觉设计V1.0.html
         * 纪律：--mcu-* token 仅声明在各根容器作用域内，不写入 :root，
         *       不修改任何 --cos-* token，不引入外部字体与图片。
         * ============================================================ */

        /* ── Token 定义（三个根容器各自声明，避免污染全局）──
           取值与设计稿一致：阶段色为浅色背景调和版，金色 #b8860b 保证白底对比度 ≥4.5:1 */

        /* A. F1 观影路线卡 */
        .mcu-route-canvas {
            /* 档案主题 token */
            --mcu-archive-gold: #b8860b;
            --mcu-archive-gold-bg: #faf3e0;
            --mcu-archive-gold-line: #e6d5a8;
            --mcu-ink: #1a1d23;
            --mcu-line: #ececec;
            --mcu-mono-font: "SF Mono", "Menlo", "Consolas", monospace;
            --mcu-phase-1: #4a7fd4;
            --mcu-phase-2: #2a9d7a;
            --mcu-phase-3: #d4922a;
            --mcu-phase-4: #7b5fd4;
            --mcu-phase-5: #d4453d;
            --mcu-phase-6: #b04d7d;

            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
        }

        /* 路线头部：六阶段渐变色条 + 眉标 + 标题 + slogan + 统计 */
        .mcu-route-header {
            padding: 14px 16px 12px;
            flex-shrink: 0;
            position: relative;
            border-bottom: 1px solid var(--mcu-line);
            background: linear-gradient(180deg, #fafbfc 0%, var(--cos-vcard-color-bg) 100%);
        }

        .mcu-route-header::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg,
                    var(--mcu-phase-1) 0%, var(--mcu-phase-1) 16.66%,
                    var(--mcu-phase-2) 16.66%, var(--mcu-phase-2) 33.33%,
                    var(--mcu-phase-3) 33.33%, var(--mcu-phase-3) 50%,
                    var(--mcu-phase-4) 50%, var(--mcu-phase-4) 66.66%,
                    var(--mcu-phase-5) 66.66%, var(--mcu-phase-5) 83.33%,
                    var(--mcu-phase-6) 83.33%, var(--mcu-phase-6) 100%);
            opacity: 0.6;
        }

        .mcu-route-eyebrow {
            font-family: var(--mcu-mono-font);
            font-size: 11px;
            font-weight: 500;
            color: var(--mcu-archive-gold);
            letter-spacing: 1.5px;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .mcu-route-eyebrow::before {
            content: "";
            width: 12px;
            height: 1px;
            background: var(--mcu-archive-gold);
        }

        .mcu-route-title {
            font-size: 17px;
            line-height: 24px;
            font-weight: 600;
            color: var(--mcu-ink);
            margin-bottom: 2px;
        }

        .mcu-route-subtitle {
            font-size: calc(12.5px / var(--font-size-scale, 1));
            line-height: 18px;
            color: var(--cos-color-text-minor);
        }

        .mcu-route-stats {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 10px;
        }

        .mcu-stat-pill {
            display: inline-flex;
            align-items: center;
            height: 22px;
            padding: 0 9px;
            border-radius: 4px;
            font-size: calc(11.5px / var(--font-size-scale, 1));
            font-weight: 500;
            background: var(--cos-color-fill-quaternary);
            color: var(--cos-color-text-minor);
            font-family: var(--mcu-mono-font);
            letter-spacing: 0.3px;
        }

        .mcu-stat-pill strong {
            color: var(--mcu-ink);
            font-weight: 600;
            margin-right: 3px;
        }

        .mcu-stat-pill.gold {
            background: var(--mcu-archive-gold-bg);
            color: var(--mcu-archive-gold);
        }

        .mcu-stat-pill.gold strong {
            color: var(--mcu-archive-gold);
        }

        /* 时间轴列表：左侧 1px 细线贯穿，圆形节点承载序号 */
        .mcu-timeline {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
            padding: 4px 16px 14px 16px;
            scrollbar-width: none;
        }

        .mcu-timeline::-webkit-scrollbar {
            width: 0;
            height: 0;
        }

        .mcu-tl-item {
            position: relative;
            display: flex;
            gap: 12px;
            padding: 10px 0;
            padding-left: 2px;
        }

        .mcu-tl-item::before {
            content: "";
            position: absolute;
            left: 13px;
            top: 0;
            bottom: -10px;
            width: 1px;
            background: var(--mcu-line);
        }

        .mcu-tl-item:last-child::before {
            display: none;
        }

        .mcu-tl-node {
            flex-shrink: 0;
            position: relative;
            z-index: 1;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--cos-vcard-color-bg);
            border: 2px solid var(--cos-color-border-minor);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--mcu-mono-font);
            font-size: 10.5px;
            font-weight: 600;
            color: var(--cos-color-text-slim);
            line-height: 1;
        }

        /* 主线必看：深色实心节点 */
        .mcu-tl-item.core .mcu-tl-node {
            border-color: var(--mcu-ink);
            background: var(--mcu-ink);
            color: #fff;
        }

        /* 当前推荐：金��高亮 + 光晕环 */
        .mcu-tl-item.current .mcu-tl-node {
            border-color: var(--mcu-archive-gold);
            background: var(--mcu-archive-gold);
            color: #fff;
            box-shadow: 0 0 0 3px var(--mcu-archive-gold-bg);
        }

        .mcu-tl-content {
            flex: 1;
            min-width: 0;
            padding-top: 2px;
        }

        .mcu-tl-top {
            display: flex;
            align-items: baseline;
            gap: 8px;
            min-width: 0;
        }

        .mcu-tl-name {
            font-size: calc(14px / var(--font-size-scale, 1));
            line-height: 20px;
            font-weight: 500;
            color: var(--mcu-ink);
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        .mcu-tl-item.core .mcu-tl-name {
            font-weight: 600;
        }

        .mcu-tl-year {
            flex-shrink: 0;
            font-family: var(--mcu-mono-font);
            font-size: calc(11.5px / var(--font-size-scale, 1));
            color: var(--cos-color-text-slim);
            font-weight: 500;
        }

        .mcu-tl-meta {
            margin-top: 3px;
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }

        /* 阶段色点：最小面积传递阶段信息 */
        .mcu-phase-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        .mcu-phase-dot.p1 { background: var(--mcu-phase-1); }
        .mcu-phase-dot.p2 { background: var(--mcu-phase-2); }
        .mcu-phase-dot.p3 { background: var(--mcu-phase-3); }
        .mcu-phase-dot.p4 { background: var(--mcu-phase-4); }
        .mcu-phase-dot.p5 { background: var(--mcu-phase-5); }
        .mcu-phase-dot.p6 { background: var(--mcu-phase-6); }

        .mcu-tl-phase {
            font-size: calc(11px / var(--font-size-scale, 1));
            color: var(--cos-color-text-slim);
            line-height: 1;
        }

        /* 推荐理由：默认 1 行，当前推荐 2 行 */
        .mcu-tl-note {
            margin-top: 4px;
            font-size: calc(12px / var(--font-size-scale, 1));
            line-height: 17px;
            color: var(--cos-color-text-minor);
            display: -webkit-box;
            -webkit-line-clamp: 1;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .mcu-tl-item.current .mcu-tl-note {
            -webkit-line-clamp: 2;
        }

        /* 底部当前推荐提示条 */
        .mcu-route-footer {
            flex-shrink: 0;
            padding: 8px 16px;
            background: var(--mcu-archive-gold-bg);
            border-top: 1px solid var(--mcu-archive-gold-line);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .mcu-route-footer-icon {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
            border-radius: 50%;
            background: var(--mcu-archive-gold);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: calc(11px / var(--font-size-scale, 1));
            font-weight: 700;
        }

        .mcu-route-footer-text {
            font-size: calc(12px / var(--font-size-scale, 1));
            line-height: 18px;
            color: #7a5d10;
            font-weight: 500;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        .mcu-route-footer-text strong {
            color: var(--mcu-archive-gold);
        }

        /* ────────────────────────────────────────────────────────────
         * B. 电影节点档案卡
         * 复用 A 的档案 token（不重复声明；F1 展开态与本模块同一画布内渲染）
         * ──────────────────────────────────────────────────────────── */
        .mcu-film-card {
            height: 100%;
            display: flex;
            flex-direction: column;
            padding: 14px;
            gap: 12px;
        }

        .mcu-archive {
            flex: 1;
            min-height: 0;
            background: var(--mcu-paper, #ffffff);
            border: 1px solid var(--mcu-line);
            border-radius: 6px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        /* 档案头条：左侧 4px 阶段色条 + 档案编号 */
        .mcu-archive-header {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            height: 32px;
            padding: 0 12px;
            background: #fafbfc;
            border-bottom: 1px solid var(--mcu-line);
            position: relative;
        }

        .mcu-archive-header::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            width: 4px;
        }

        .mcu-archive-header.phase-1::before { background: var(--mcu-phase-1); }
        .mcu-archive-header.phase-2::before { background: var(--mcu-phase-2); }
        .mcu-archive-header.phase-3::before { background: var(--mcu-phase-3); }
        .mcu-archive-header.phase-4::before { background: var(--mcu-phase-4); }
        .mcu-archive-header.phase-5::before { background: var(--mcu-phase-5); }
        .mcu-archive-header.phase-6::before { background: var(--mcu-phase-6); }

        .mcu-archive-no {
            font-family: var(--mcu-mono-font);
            font-size: calc(11px / var(--font-size-scale, 1));
            font-weight: 600;
            color: var(--cos-color-text-slim);
            letter-spacing: 0.5px;
            padding-left: 8px;
        }

        .mcu-archive-label {
            margin-left: auto;
            font-size: calc(10.5px / var(--font-size-scale, 1));
            font-weight: 500;
            color: var(--cos-color-text-slim);
            letter-spacing: 1px;
        }

        /* 视觉区：程序化卡片用横格纸纹理 + 胶片孔装饰，零图片依赖 */
        .mcu-archive-visual {
            flex-shrink: 0;
            height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            background:
                repeating-linear-gradient(0deg,
                    transparent,
                    transparent 19px,
                    rgba(0, 0, 0, 0.03) 19px,
                    rgba(0, 0, 0, 0.03) 20px),
                linear-gradient(135deg, #f5f6f8 0%, #eef0f3 100%);
        }

        .mcu-archive-visual::before,
        .mcu-archive-visual::after {
            content: "";
            position: absolute;
            top: 8px;
            bottom: 8px;
            width: 8px;
            background-image: radial-gradient(circle, rgba(0, 0, 0, 0.08) 1.5px, transparent 1.5px);
            background-size: 8px 16px;
            background-repeat: repeat-y;
        }

        .mcu-archive-visual::before { left: 10px; }
        .mcu-archive-visual::after { right: 10px; }

        .mcu-archive-mark {
            text-align: center;
            z-index: 1;
        }

        .mcu-archive-roman {
            font-family: Georgia, "Times New Roman", serif;
            font-size: 48px;
            font-weight: 700;
            line-height: 1;
            color: var(--mcu-ink);
            opacity: 0.15;
            letter-spacing: 4px;
            margin-bottom: 8px;
        }

        .mcu-archive-film-icon {
            width: 36px;
            height: 28px;
            margin: 0 auto 8px;
            border: 2px solid var(--cos-color-text-slim);
            border-radius: 3px;
            position: relative;
            opacity: 0.4;
        }

        .mcu-archive-film-icon::before,
        .mcu-archive-film-icon::after {
            content: "";
            position: absolute;
            top: 3px;
            bottom: 3px;
            width: 2px;
            background: var(--cos-color-text-slim);
        }

        .mcu-archive-film-icon::before { left: 4px; }
        .mcu-archive-film-icon::after { right: 4px; }

        /* 有真实海报时 */
        .mcu-archive-visual.has-poster {
            background: #000;
        }

        .mcu-archive-visual.has-poster .mcu-archive-mark { display: none; }

        .mcu-archive-poster {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0.85;
            filter: saturate(0.9);
        }

        .mcu-archive-visual.has-poster::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.5) 100%);
        }

        .mcu-archive-poster-title {
            position: absolute;
            bottom: 10px;
            left: 14px;
            right: 14px;
            z-index: 2;
            color: #fff;
            font-size: calc(14px / var(--font-size-scale, 1));
            font-weight: 600;
            text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        /* 档案信息区 */
        .mcu-archive-body {
            flex: 1;
            min-height: 0;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .mcu-archive-title {
            font-size: calc(16px / var(--font-size-scale, 1));
            font-weight: 600;
            line-height: 22px;
            color: var(--mcu-ink);
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }

        .mcu-archive-meta-row {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .mcu-archive-meta-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: calc(11.5px / var(--font-size-scale, 1));
            color: var(--cos-color-text-minor);
        }

        .mcu-archive-meta-item .label {
            font-family: var(--mcu-mono-font);
            color: var(--cos-color-text-slim);
            font-size: calc(10.5px / var(--font-size-scale, 1));
            letter-spacing: 0.5px;
        }

        .mcu-archive-divider {
            height: 1px;
            background: var(--mcu-line);
            margin: 2px 0;
        }

        .mcu-archive-desc {
            font-size: calc(12.5px / var(--font-size-scale, 1));
            line-height: 18px;
            color: var(--cos-color-text-minor);
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .mcu-archive-footer {
            margin-top: auto;
            padding-top: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .mcu-archive-tag {
            display: inline-flex;
            align-items: center;
            height: 20px;
            padding: 0 8px;
            border-radius: 3px;
            font-size: calc(11px / var(--font-size-scale, 1));
            font-weight: 500;
            background: var(--cos-color-fill-quaternary);
            color: var(--cos-color-text-minor);
        }

        .mcu-archive-tag.core {
            background: var(--mcu-archive-gold-bg);
            color: var(--mcu-archive-gold);
        }

        /* ────────────────────────────────────────────────────────────
         * C. F3 随机探索发现卡
         * ──────────────────────────────────────────────────────────── */
        .mcu-discover-canvas {
            /* 复用档案 token，取值与 A 一致 */
            --mcu-archive-gold: #b8860b;
            --mcu-archive-gold-bg: #faf3e0;
            --mcu-archive-gold-line: #e6d5a8;
            --mcu-ink: #1a1d23;
            --mcu-paper: #ffffff;
            --mcu-line: #ececec;
            --mcu-mono-font: "SF Mono", "Menlo", "Consolas", monospace;
            --mcu-phase-1: #4a7fd4;
            --mcu-phase-2: #2a9d7a;
            --mcu-phase-3: #d4922a;
            --mcu-phase-4: #7b5fd4;
            --mcu-phase-5: #d4453d;
            --mcu-phase-6: #b04d7d;

            height: 100%;
            display: flex;
            flex-direction: column;
            padding: 14px 16px;
            gap: 12px;
        }

        /* 今日发现头部 */
        .mcu-discover-header {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .mcu-discover-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background: var(--mcu-archive-gold-bg);
            border: 1px solid var(--mcu-archive-gold-line);
            border-radius: 20px;
        }

        .mcu-discover-badge-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--mcu-archive-gold);
            animation: mcu-pulse-dot 2s ease-in-out infinite;
        }

        @keyframes mcu-pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.2); }
        }

        .mcu-discover-badge-text {
            font-size: calc(11.5px / var(--font-size-scale, 1));
            font-weight: 600;
            color: var(--mcu-archive-gold);
            letter-spacing: 0.5px;
        }

        .mcu-discover-date {
            font-family: var(--mcu-mono-font);
            font-size: calc(11px / var(--font-size-scale, 1));
            color: var(--cos-color-text-slim);
        }

        /* 发现卡主体 */
        .mcu-discover-card {
            flex: 1;
            min-height: 0;
            background: var(--mcu-paper);
            border-radius: 10px;
            border: 1px solid var(--mcu-line);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.02);
            position: relative;
        }

        .mcu-discover-hero {
            flex-shrink: 0;
            height: 140px;
            position: relative;
            overflow: hidden;
            background: linear-gradient(135deg, #f0f2f5 0%, #e5e7eb 100%);
        }

        .mcu-discover-hero-poster {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .mcu-discover-hero-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0.55) 100%);
        }

        /* 程序化背景罗马数字 */
        .mcu-discover-hero-roman {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -55%);
            font-family: Georgia, "Times New Roman", serif;
            font-size: 64px;
            font-weight: 700;
            color: var(--mcu-ink);
            opacity: 0.08;
            letter-spacing: 6px;
            line-height: 1;
        }

        .mcu-discover-phase-tag {
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: calc(10.5px / var(--font-size-scale, 1));
            font-weight: 600;
            color: #fff;
            background: rgba(0, 0, 0, 0.5);
            letter-spacing: 0.5px;
        }

        .mcu-discover-body {
            flex: 1;
            min-height: 0;
            padding: 12px 14px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .mcu-discover-title {
            font-size: calc(17px / var(--font-size-scale, 1));
            font-weight: 700;
            line-height: 24px;
            color: var(--mcu-ink);
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }

        .mcu-discover-meta {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        .mcu-discover-meta-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: calc(11.5px / var(--font-size-scale, 1));
            color: var(--cos-color-text-minor);
        }

        .mcu-discover-meta-item .icon {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        .mcu-discover-divider {
            height: 1px;
            background: var(--mcu-line);
            margin: 4px 0;
        }

        /* 推荐理由区：使用短字段 reasonShort，不展示长介绍 */
        .mcu-discover-reason {
            flex: 1;
            min-height: 0;
            position: relative;
            padding-top: 4px;
        }

        .mcu-discover-reason-label {
            font-family: var(--mcu-mono-font);
            font-size: calc(10.5px / var(--font-size-scale, 1));
            font-weight: 600;
            color: var(--mcu-archive-gold);
            letter-spacing: 1px;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .mcu-discover-reason-label::before {
            content: "\\2605";
            font-size: 10px;
        }

        .mcu-discover-reason-text {
            font-size: calc(13px / var(--font-size-scale, 1));
            line-height: 19px;
            color: var(--cos-color-text);
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        /* 底部提示栏 */
        .mcu-discover-foot {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-top: 8px;
            border-top: 1px dashed var(--mcu-line);
        }

        .mcu-discover-foot-left {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .mcu-discover-foot-icon {
            font-size: calc(12px / var(--font-size-scale, 1));
        }

        .mcu-discover-foot-text {
            font-size: calc(11.5px / var(--font-size-scale, 1));
            color: var(--cos-color-text-slim);
        }

        .mcu-discover-foot-right {
            font-family: var(--mcu-mono-font);
            font-size: calc(11px / var(--font-size-scale, 1));
            color: var(--cos-color-text-slim);
        }

        /* 空态 */
        .mcu-empty {
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 20px;
            text-align: center;
        }

        .mcu-empty-text {
            font-size: calc(13px / var(--font-size-scale, 1));
            line-height: calc(19px / var(--font-size-scale, 1));
            color: var(--cos-color-text-slim);
        }

`;

const out = html.slice(0, startIdx) + NEW_CSS + html.slice(endIdx);
fs.writeFileSync(INDEX, out, 'utf8');

/* 统计 */
const css = (out.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
const mcuRules = (css.match(/^\s*\.mcu-[a-z0-9-]+/gm) || []).length;
console.log('✔ 已替换 .mcu-* 画布样式区');
console.log('  .mcu-* 规则数 : ' + mcuRules);
console.log('  新增字节       : ' + (out.length - html.length));
console.log('  文件体积       : ' + (fs.statSync(INDEX).size / 1024).toFixed(1) + ' KB');

/* 校验：不得在 :root 或任何选择器中定义 --cos-* */
const cosDefine = css.match(/[^{}]*\{[^{}]*--cos-[a-z0-9-]+\s*:/i);
if (cosDefine) {
  console.log('  [X] 检测到 --cos-* 定义：' + cosDefine[0].trim().slice(0, 60));
} else {
  console.log('  [OK] 未定义任何 --cos-* token');
}

/* 校验：--mcu-* 只能在 .mcu-* 作用域内声明（先剥离注释，避免误匹配注释文字） */
const cssNoComment = css.replace(/\/\*[\s\S]*?\*\//g, '');
const mcuTokenBlocks = cssNoComment.match(/[^{}]*\{[^{}]*--mcu-[a-z0-9-]+\s*:/gi) || [];
const badScope = mcuTokenBlocks.filter(function (b) {
  const sel = b.split('{')[0].trim();
  return sel.indexOf('.mcu-') !== 0;
});
if (badScope.length) {
  console.log('  [X] --mcu-* 声明在非 .mcu-* 作用域：' + badScope[0].split('{')[0].trim());
} else {
  console.log('  [OK] --mcu-* 全部声明在 .mcu-* 根容器作用域内（' +
    mcuTokenBlocks.length + ' 处）');
}

/* 统计新增颜色数量（策划要求控制新增颜色数量） */
const mcuColors = new Set((cssNoComment.match(/--mcu-(?:archive-gold|archive-gold-bg|archive-gold-line|ink|paper|line|phase-[1-6])\s*:\s*([^;]+);/gi) || [])
  .map(function (s) { return s.split(':').slice(1).join(':').trim().toLowerCase(); }));
console.log('  --mcu-* 新增颜色种类 : ' + mcuColors.size + ' 种（' + Array.from(mcuColors).join(', ') + '）');
