/* ============================================================
 * MCU 宇宙导航 - 上映预告（未来作品）· 独立数据源
 * ------------------------------------------------------------
 * 唯一入口：window.MCU_UPCOMING
 *
 * 为什么是 .js 而不是 .json（与项目全部数据文件一致）：
 *   本项目要求「双击 index.html 即可运行」。浏览器在 file:// 协议下
 *   会拦截 fetch() 读取本地 JSON，因此数据以全局变量形式挂载。
 *   下方数组是**合法的标准 JSON**，去掉 `window.MCU_UPCOMING =` 前缀
 *   与结尾分号即可直接另存为 movieUpcoming.json 供服务端 / 小程序使用。
 *
 * 字段说明：
 *   id      唯一标识（与 movie.html?id= 参数体系保持同一命名空间）
 *   title   中文片名（项目内 movies/series/special/short 用 cn，此处沿用指令口径 title）
 *   en      英文片名
 *   date    北美上映日期 YYYY-MM-DD；仅定到年份时写 YYYY
 *   phase   所属阶段 1-6；官方尚未公布时填 null（严禁臆测）
 *   poster  海报地址；未上映作品通常无物料，填 '' 由前端阶段色占位
 *   status  dated=官方已定档 / tba=已公布但档期待定
 *   note    一句话说明它在 MCU 中的位置（不写剧情猜测）
 *
 * 数据纪律（重要）：
 *   1. 只登记有公开来源的官方档期；官方未定档的写 tba，不写死具体日期。
 *   2. 本表**不参与**推荐算法与关系图计算（见 movies.js 原注释口径），
 *      仅供「上映预告 / 未来计划」展示与 next.html 的候选列表提示。
 *   3. next.html 会强制清空 id 并赋值 phase=6，不影响本表作为数据源的完整性。
 *   4. 更新方式：只改本文件，页面自动跟随。禁止把片单写死进 HTML / 组件。
 *
 * 最近一次核对：2026-09-10
 * 来源交叉验证：Marvel Studios 官方档期 / SDCC 2026 Hall H 公布 / 多家主流媒体档期表一致
 * ============================================================ */

window.MCU_UPCOMING = [
  {
    id: 'avengers-5',
    title: '复仇者联盟5：毁灭之日',
    en: 'Avengers: Doomsday',
    date: '2026-12-18',
    phase: 6,
    poster: '',
    status: 'dated',
    note: '第六阶段核心。地球-616、Earth-828 与 X 战警三条线汇合，毁灭博士登场。'
  },
  {
    id: 'avengers-6',
    title: '复仇者联盟6：秘密战争',
    en: 'Avengers: Secret Wars',
    date: '2027-12-17',
    phase: 6,
    poster: '',
    status: 'dated',
    note: '多元宇宙传奇终章，承接《毁灭之日》。'
  },
  {
    id: 'black-panther-3',
    title: '黑豹3',
    en: 'Black Panther 3',
    date: '2028-12-15',
    phase: null,
    poster: '',
    status: 'dated',
    note: '瑞恩·库格勒回归执导。所属阶段官方尚未公布。'
  },
  {
    id: 'ghost-rider',
    title: '恶灵骑士',
    en: 'Ghost Rider',
    date: '2028',
    phase: null,
    poster: '',
    status: 'tba',
    note: 'SDCC 2026 公布，档期仅定到年份。所属阶段官方尚未公布。'
  }
];
