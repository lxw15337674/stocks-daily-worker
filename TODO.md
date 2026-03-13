# TODO

## 🛠 现有功能优化 (Stability & Maintenance)
- [ ] 增加 R2 自动清理逻辑：Scheduler 状态对象仅保留最近 7-14 天的数据。
- [ ] 增强状态页：显示每个 Job 的近期失败详情和更清晰的错误摘要。

## 🤖 AI 智能情报站 (AI Intelligence Hub) - 新增功能

### Phase 1: 数据模型与基建 (Foundation)
- [ ] **Schema 设计**：在 `packages/contracts` 定义 `news_sentiment` 数据模型。
    - 字段：`id`, `ticker_id` (或 `market_macro`), `title`, `content_summary`, `sentiment` (-1:利空, 0:中性, 1:利好), `importance_score` (0-100), `timestamp`。
- [ ] **实体关联库**：建立 Ticker 与关键词的映射表（如 "老马" -> $DOGE, "美联储" -> 宏观大盘）。

### Phase 2: AI 处理引擎 (Intelligence Engine)
- [ ] **每小时 AI 预处理任务 (Hourly Worker)**：
    - [ ] 接入财经新闻爬虫流。
    - [ ] 利用 Cloudflare Workers AI 进行“去重+定性+打分”处理。
    - [ ] 自动标记新闻归属：大盘 vs 行业 vs 具体个股/币。
- [ ] **每日 AI 叙事化汇总 (Daily Summarizer)**：
    - [ ] 大盘维度：结合当日多空比与指数走势生成 200 字“人话”复盘。
    - [ ] 个体维度：针对当日异动标的（涨跌幅 > 5%）生成因果链诊断。
### Phase 3: 前端交互体验 (The Intelligence Wall)
- [ ] **三栏式情报墙 (Triple-Column News)**：
    - [ ] 左栏：利好 (Bullish) - 绿色/红色，高重要度置顶。
    - [ ] 中栏：中性 (Neutral) - 蓝色/灰色。
    - [ ] 右栏：利空 (Bearish) - 橙色/深红色，风险预警。
- [ ] **K 线联动标记 (Chart Insight Linkage)**：
    - [ ] 在 K 线图时间轴上标记新闻锚点（点选新闻同步高亮 K线时段）。
    - [ ] 点击 K 线锚点弹出对应的 AI 新闻摘要卡片。

### Phase 4: 用户反馈与闭环 (Feedback Loop)
- [ ] **AI 准确性反馈**：增加用户“纠错”按钮，允许手动调整新闻归类（利好/利空）。
- [ ] **重要异动推送**：根据 AI 识别的“极高重要度利好/利空”发送 Webhook 提醒。
