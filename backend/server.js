'use strict';

/**
 * =============================================================================
 * 天宇石材 品牌官网 —— 独立后端 API 服务
 * =============================================================================
 * 技术约束：零依赖，仅使用 Node 内置模块（http / fs / path / url）
 * 启动方式：node server.js        （无需 npm install）
 * 适用环境：Node v22.x
 *
 * -----------------------------------------------------------------------------
 * 【管理端 Token 配置】
 * -----------------------------------------------------------------------------
 * 默认 token：tianyu-admin-2026
 * 覆盖方式：启动前设置环境变量 ADMIN_TOKEN，例如：
 *     ADMIN_TOKEN=my-secret-token PORT=3000 node server.js
 * 请求时通过请求头携带：x-admin-token: <token>
 *
 * 调用示例（新增公告）：
 *     curl -X POST http://localhost:3000/api/admin/announcements \
 *       -H "Content-Type: application/json" \
 *       -H "x-admin-token: tianyu-admin-2026" \
 *       -d '{"title":"标题","date":"2026-10-03","summary":"摘要","content":"正文"}'
 *
 * 鉴权失败（缺少或错误的 token）统一返回 401 JSON：{ ok:false, error:"..." }
 * -----------------------------------------------------------------------------
 * 【端口】默认 3000，可用环境变量 PORT 覆盖
 * 【数据】JSON 文件存储于 ./data/ 目录（运行时自动创建，无需数据库）
 * =============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// -----------------------------------------------------------------------------
// 基础配置
// -----------------------------------------------------------------------------

/** 管理端鉴权 token：优先读取环境变量 ADMIN_TOKEN，未设置时用默认值 */
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'tianyu-admin-2026';

/** 服务监听端口：优先读取环境变量 PORT，未设置时默认 3000 */
const PORT = Number(process.env.PORT) || 3000;

/** 数据目录与各数据文件的绝对路径（便携：始终相对 server.js 所在目录） */
const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  announcements: path.join(DATA_DIR, 'announcements.json'),
  contact: path.join(DATA_DIR, 'contact.json'),
  chat: path.join(DATA_DIR, 'chat.json'),
};

/** 请求体大小上限（1MB），防止超大 body 拖垮进程 */
const MAX_BODY_BYTES = 1024 * 1024;

/**
 * 首次启动预置的 4 条公告（厂家口吻，来自真实经营场景，
 * 不编造成立年份、产能、荣誉等不可验证信息）。
 */
const SEED_ANNOUNCEMENTS = [
  {
    id: 1,
    title: '秋季装修旺季：量尺与安装请提前排期',
    date: '2026-09-30',
    summary:
      '秋季是装修集中期，上门量尺与安装档期较满，有台面需求的渠道伙伴和业主请尽早预约，便于我们统一排单。',
    content:
      '秋季是装修集中期，上门量尺与安装档期较满，有台面需求的渠道伙伴和业主请尽早预约，便于我们统一排单。\n\n预约方式：站内留言或来电，注明地址、台面位置与期望时间。',
  },
  {
    id: 2,
    title: '新到岩板大板：哑光与亮光可选',
    date: '2026-09-20',
    summary:
      '新到一批岩板大板，规格齐全，哑光与亮光面可选，纹理稳定。欢迎来厂看样板或联系发样。',
    content:
      '新到一批岩板大板，规格齐全，哑光与亮光面可选，纹理稳定。欢迎来厂看样板或联系发样。\n\n大规格岩板适合吧台、岛台、餐桌与电视墙等一体台面。',
  },
  {
    id: 3,
    title: '台面边型样品更新：直边、圆边、罗马边',
    date: '2026-09-12',
    summary:
      '车间边型样品已更新，直边、圆边、罗马边等常见样式现场可看，下单前先定边型更省事。',
    content:
      '车间边型样品已更新，直边、圆边、罗马边等常见样式现场可看，下单前先定边型更省事。\n\n台面下单前建议先确认：板材、边型、开孔位置与尺寸、是否需要后挡水。',
  },
  {
    id: 4,
    title: '节假日前后加工排期提醒',
    date: '2026-09-05',
    summary:
      '节假日前后加工与安装档期紧张，建议提前一周预约量尺、确认下单，避免赶工影响质量。',
    content:
      '节假日前后加工与安装档期紧张，建议提前一周预约量尺、确认下单，避免赶工影响质量。\n\n台面从量尺到安装一般需要数天到一周，具体以排单为准。',
  },
];

// -----------------------------------------------------------------------------
// 存储层：JSON 文件读写
// -----------------------------------------------------------------------------

/**
 * 确保 data 目录存在（首次运行时自动创建）。
 * 失败只告警不抛出：让服务仍能起来，由具体读写函数再报错。
 */
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(`[storage] 已创建数据目录：${DATA_DIR}`);
    }
  } catch (err) {
    console.error('[storage] 创建数据目录失败：', err.message);
  }
}

/**
 * 读取 JSON 文件。
 * 健壮性约定：
 *   1. 文件不存在      → 返回 fallback（不报错）
 *   2. 文件内容损坏    → 打印告警，返回空数组 []（不抛出，避免服务被脏数据打挂）
 *   3. 读盘异常        → 打印告警，返回 fallback
 */
function readJSON(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return fallback; // 空文件按“无数据”处理
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.warn(
      `[storage] 读取失败，已按空数据处理：${path.basename(filePath)} → ${err.message}`
    );
    return fallback;
  }
}

/**
 * 原子化写入 JSON 文件（先写临时文件再重命名，避免写一半断电产生半截文件）。
 * 返回 true / false，不抛出异常。
 */
function writeJSON(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  try {
    ensureDataDir();
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (err) {
    console.error(`[storage] 写入失败：${path.basename(filePath)} → ${err.message}`);
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (_) {
      /* 清理失败可忽略 */
    }
    return false;
  }
}

/** 确保数组类型（数据文件被写成对象/字符串等异常结构时兜底） */
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * 加载公告列表。
 * 首次启动（文件不存在）时写入 4 条预置公告。
 */
function loadAnnouncements() {
  if (!fs.existsSync(FILES.announcements)) {
    writeJSON(FILES.announcements, SEED_ANNOUNCEMENTS);
    console.log(`[storage] 已预置 ${SEED_ANNOUNCEMENTS.length} 条示例公告`);
    return SEED_ANNOUNCEMENTS.slice();
  }
  return asArray(readJSON(FILES.announcements, []));
}

/** 生成留言 / 聊天消息的 id（时间戳 + 随机串，保证同一毫秒内也不重复） */
function genId(prefix) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}${rand}`;
}

/** 生成当前时间的 ISO 字符串（带本地时区偏移，便于前端直接展示） */
function nowISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

// -----------------------------------------------------------------------------
// HTTP 工具层
// -----------------------------------------------------------------------------

/** 统一的 CORS 响应头（允许任意来源，方便官网前端跨端口联调） */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,x-admin-token',
  'Access-Control-Max-Age': '86400',
};

/** 统一 JSON 响应 */
function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...CORS_HEADERS,
  });
  res.end(body);
}

/** 成功响应快捷方法 */
function sendOk(res, extra) {
  sendJSON(res, 200, { ok: true, ...(extra || {}) });
}

/** 失败响应快捷方法 */
function sendFail(res, statusCode, error) {
  sendJSON(res, statusCode, { ok: false, error });
}

/**
 * 读取请求体并解析为 JSON。
 * - 空 body 视为 {}
 * - 非法 JSON / 超过大小上限 抛错（由调用方兜住并返回 400）
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求体过大（上限 1MB）'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch (_) {
        reject(new Error('请求体不是合法的 JSON'));
      }
    });
    req.on('error', reject);
  });
}

/** 取字符串并去除首尾空白（非字符串一律返回 ''） */
function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** 常见中国大陆手机号校验：1 开头 + 3~9 段位 + 共 11 位 */
const PHONE_RE = /^1[3-9]\d{9}$/;

// -----------------------------------------------------------------------------
// 路由处理函数
// -----------------------------------------------------------------------------

/** GET /api/announcements —— 公告列表（按日期倒序，最新在前） */
function handleGetAnnouncements(req, res) {
  const list = loadAnnouncements();
  list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  sendOk(res, { list });
}

/** POST /api/admin/announcements —— 新增公告（需 x-admin-token） */
async function handleCreateAnnouncement(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return sendFail(res, 400, err.message);
  }

  const title = str(body.title);
  const content = str(body.content);
  const date = str(body.date) || new Date().toISOString().slice(0, 10);
  const summary = str(body.summary);

  // 标题与正文为必填项
  if (!title) return sendFail(res, 400, '标题不能为空');
  if (!content) return sendFail(res, 400, '正文不能为空');

  const list = loadAnnouncements();
  // 自增 id：取现有最大数字 id + 1（非数字 id 不参与计算）
  const maxId = list.reduce((max, item) => {
    const n = Number(item && item.id);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  const record = { id: maxId + 1, title, date, summary, content };
  list.push(record);

  if (!writeJSON(FILES.announcements, list)) {
    return sendFail(res, 500, '公告保存失败，请查看服务端日志');
  }
  console.log(`[admin] 新增公告 #${record.id}：${title}`);
  sendOk(res, { item: record });
}

/** POST /api/contact —— 提交联系表单 */
async function handleCreateContact(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return sendFail(res, 400, err.message);
  }

  const name = str(body.name);
  const phone = str(body.phone);
  const message = str(body.message);

  // 三字段非空校验
  if (!name) return sendFail(res, 400, '请填写您的姓名');
  if (!phone) return sendFail(res, 400, '请填写正确的手机号');
  if (!message) return sendFail(res, 400, '请填写留言内容');
  // 手机号格式校验
  if (!PHONE_RE.test(phone)) return sendFail(res, 400, '请填写正确的手机号');

  const list = asArray(readJSON(FILES.contact, []));
  const record = {
    id: genId('c'),
    name,
    phone,
    message,
    createdAt: nowISO(),
  };
  list.push(record);

  if (!writeJSON(FILES.contact, list)) {
    return sendFail(res, 500, '提交失败，请稍后重试');
  }
  console.log(`[contact] 收到留言：${name} / ${phone}`);
  sendOk(res, { id: record.id, createdAt: record.createdAt });
}

/** GET /api/contact —— 留言列表（最新在前，供管理员查看） */
function handleGetContacts(req, res) {
  const list = asArray(readJSON(FILES.contact, []));
  list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  sendOk(res, { list });
}

/** POST /api/chat/messages —— 在线客服浮窗发消息 */
async function handleCreateChatMessage(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (err) {
    return sendFail(res, 400, err.message);
  }

  const content = str(body.content);
  const name = str(body.name) || '访客';
  if (!content) return sendFail(res, 400, '消息内容不能为空');

  const list = asArray(readJSON(FILES.chat, []));
  const record = {
    id: genId('m'),
    name,
    content,
    createdAt: nowISO(),
  };
  list.push(record);

  if (!writeJSON(FILES.chat, list)) {
    return sendFail(res, 500, '消息发送失败，请稍后重试');
  }
  sendOk(res, { id: record.id, createdAt: record.createdAt });
}

/** GET /api/chat/messages?limit=50 —— 聊天消息列表（最新在前） */
function handleGetChatMessages(req, res, url) {
  const rawLimit = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 200) : 50;

  const list = asArray(readJSON(FILES.chat, []));
  list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  sendOk(res, { list: list.slice(0, limit), limit });
}

// -----------------------------------------------------------------------------
// 路由表
// -----------------------------------------------------------------------------
const ROUTES = [
  { method: 'GET', path: '/api/announcements', needAuth: false, handler: handleGetAnnouncements, desc: '公告列表' },
  { method: 'POST', path: '/api/contact', needAuth: false, handler: handleCreateContact, desc: '提交联系表单' },
  { method: 'GET', path: '/api/contact', needAuth: false, handler: handleGetContacts, desc: '留言列表（管理员）' },
  { method: 'POST', path: '/api/chat/messages', needAuth: false, handler: handleCreateChatMessage, desc: '发送客服消息' },
  { method: 'GET', path: '/api/chat/messages', needAuth: false, handler: handleGetChatMessages, desc: '客服消息列表' },
  { method: 'POST', path: '/api/admin/announcements', needAuth: true, handler: handleCreateAnnouncement, desc: '新增公告（需 token）' },
];

/**
 * 主请求分发器。
 * 处理顺序：CORS 预检 → 路由匹配 → 鉴权 → 业务处理 → 404
 */
async function handleRequest(req, res) {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (_) {
    return sendFail(res, 400, '请求 URL 不合法');
  }
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    res.writeHead(200, CORS_HEADERS);
    return res.end();
  }

  const route = ROUTES.find((r) => r.method === method && r.path === pathname);
  if (!route) {
    const allowed = ROUTES.filter((r) => r.path === pathname).map((r) => r.method);
    const error = allowed.length
      ? `不支持的方法 ${method}，该路径仅支持：${allowed.join(', ')}`
      : `未找到路由：${method} ${pathname}`;
    return sendFail(res, 404, error);
  }

  if (route.needAuth) {
    const token = req.headers['x-admin-token'];
    if (!token || token !== ADMIN_TOKEN) {
      return sendFail(res, 401, '鉴权失败：缺少或无效的 x-admin-token');
    }
  }

  try {
    await route.handler(req, res, url);
  } catch (err) {
    console.error(`[error] ${method} ${pathname} →`, err);
    if (!res.headersSent) sendFail(res, 500, '服务器内部错误');
  }
}

// -----------------------------------------------------------------------------
// 启动服务
// -----------------------------------------------------------------------------

const server = http.createServer(handleRequest);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] 启动失败：端口 ${PORT} 已被占用，请先释放端口或改用其他 PORT`);
  } else {
    console.error('[server] 启动失败：', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  ensureDataDir();
  const announcements = loadAnnouncements();

  const addr = server.address();
  console.log('==========================================================');
  console.log(' 天宇石材 品牌官网 API 服务已启动');
  console.log('==========================================================');
  console.log(` 监听地址：http://localhost:${addr.port}`);
  console.log(` 管理 token：${ADMIN_TOKEN}（环境变量 ADMIN_TOKEN 可覆盖）`);
  console.log(` 数据目录：${DATA_DIR}`);
  console.log(` 当前公告数：${announcements.length}`);
  console.log('----------------------------------------------------------');
  console.log(' 已注册路由清单：');
  ROUTES.forEach((r) => {
    console.log(
      `   ${r.method.padEnd(6)} ${r.path.padEnd(30)} ${r.desc}${r.needAuth ? ' [需 x-admin-token]' : ''}`
    );
  });
  console.log(`   OPTIONS 任意路径（CORS 预检）→ 200`);
  console.log(`   其他路径 → 404 JSON`);
  console.log('----------------------------------------------------------');
  console.log(` 健康检查：curl http://localhost:${addr.port}/api/announcements`);
  console.log('==========================================================');
});

// 优雅退出：收到终止信号时先关闭连接再退出，避免端口残留
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => {
    console.log(`\n[server] 收到 ${sig}，正在关闭服务...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
});
