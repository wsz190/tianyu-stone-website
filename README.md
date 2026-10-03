# 天宇石材 品牌官网

石英石 · 岩板 · 花岗岩台面**加工安装厂家**品牌站。定位纯品牌展示与线索收集，与管理系统无关。

- 视觉基调：深色石材 + 暖象牙 + 青铜金，宋体大标题（高端、简洁、大气）
- 动画引擎：Three.js（首屏 3D 石板）+ GSAP（入场/滚动揭示/数字计数），全部有降级
- 前端来源：基于 GitHub 开源模板 [Xebec7577/tilemaster](https://github.com/Xebec7577/tilemaster)（Premium 3D website template for tile, marble, granite businesses，MIT）中文化重制；图片为 AI 生成品牌图（8 张，本地 assets/）
- 后端：零依赖 Node http API（公告 / 留言 / 客服），数据 JSON 落盘

---

## 目录结构

```
天宇石材官网/
├── frontend/                # 纯静态前端（python http.server 即可跑）
│   ├── index.html           # 站点结构（中文文案 + data-biz 注入点）
│   ├── business.js          # ★ 唯一业务配置：名称/电话/地址/指标/案例，改这里
│   ├── style.css            # 设计体系（token + 区块样式 + 表单/公告/客服）
│   ├── script.js            # 渲染：loader/导航/Hero 3D/揭示/统计/表单/公告/客服
│   └── assets/              # 8 张品牌图（hero/板材×3/案例×3/工艺水刀）
└── backend/
    ├── server.js            # 零依赖 Node API（端口 3000）
    └── data/                # JSON 数据（运行时自动创建）
```

## 快速启动

```bash
# 1. 后端 API（无需 npm install）
cd backend && node server.js
# → http://localhost:3000（公告/留言/客服接口）

# 2. 前端
cd frontend && python3 -m http.server 8080
# → http://localhost:8080/index.html
```

## 功能清单

| 模块 | 说明 |
|---|---|
| 首屏 Hero | 3D 石板 + 中文主标语 + 预约量尺/看工艺双按钮 |
| 板材 | 石英石 / 岩板 / 花岗岩（大图 + 卖点），花岗岩通栏收尾 |
| 工艺体验 | 水刀车间大图 + "选板·开料·安装"大字 + 卫浴案例板 |
| 案例 | 厨房台面 / 吧台前台（业务配置注入，占位描述） |
| 工艺指标 | 量尺精度 1mm / 桥切 4,000rpm / 抛光 3,000 目 / 安装 6h（真实工序基线，非营销数据） |
| 预约表单 | 称呼 / 手机号（11 位校验）/ 留言 → `POST /api/contact` |
| 厂里动态 | 公告从后端 `GET /api/announcements` 渲染（默认 4 条厂家公告） |
| 在线客服 | 右下角浮窗，消息 → `POST /api/chat/messages` |
| 适配 | 桌面 / 移动端响应式；无 WebGL 时 Hero 自动降级为 CSS 背景图；无 GSAP 时内容直接显示 |

## 后端接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /api/announcements | 公告列表（倒序） |
| POST | /api/contact | 提交预约留言（name/phone/message，手机号 11 位校验） |
| GET | /api/contact | 留言列表（管理员查看） |
| POST | /api/chat/messages | 客服消息（content） |
| GET | /api/chat/messages?limit=50 | 消息列表 |
| POST | /api/admin/announcements | 新增公告，需请求头 `x-admin-token`（默认 `tianyu-admin-2026`，可用环境变量 `ADMIN_TOKEN` 覆盖） |

CORS 已全开，前端跨端口调用无需代理。

## 上线前必改（占位内容）

`frontend/business.js` 中以下为占位，上线前请替换为真实信息：

- `phone: "400-xxx-xxxx"` → 真实客服电话
- `address: "示例地址：…（占位）"` → 真实工厂地址
- 页脚 `ICP 备案号：示例备案号（占位）` → 真实 ICP 备案号
- 案例描述为场景化占位（厨房台面/吧台前台），可按真实业务补充

## 部署提示

- 纯静态 + 零依赖 Node，任意服务器/容器均可跑；无 HTTPS 域名时局域网 IP + 端口也可直接访问（PWA 类能力另议）
- 首次部署记得在服务器上开放 3000 端口（或前端反向代理 `/api` 到后端）
- 图片已在 `assets/`，无需外链
