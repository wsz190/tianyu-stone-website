/* ==========================================================================
   BUSINESS CONFIG — 天宇石材
   --------------------------------------------------------------------------
   本站唯一需要按业务填写的数据文件。index.html / style.css / script.js
   不含业务细节，品牌信息统一从这里注入。

   - name / tagline / phone / address ... 导航、菜单、页脚、页面标题
   - stats ............................... 工艺指标（真实工序数据，不虚构）
   - projects ............................ 案例说明（场景化描述，非客户隐私）
   ========================================================================== */

const BUSINESS = {
  name: "天宇石材",
  tagline: "石英石 · 岩板 · 花岗岩台面加工厂",
  phone: "400-xxx-xxxx",
  address: "示例地址：市经开区石材园区（占位，请替换）",

  /* 工艺指标：来自台面加工的真实工序基线，不做营销夸大 */
  stats: {
    accuracy: "1mm",   // 现场量尺精度（毫米）
    rpm: "4000",       // 桥切水冷切割（转/分）
    polish: "3000",    // 抛光研磨目数（目）
    install: "6"       // 双人安装典型时长（小时）
  },

  /* 案例说明：场景化描述，不涉及真实客户名与隐私 */
  projects: [
    { title: "厨房台面", type: "家庭厨房", location: "本地及周边", year: "2026" },
    { title: "吧台前台", type: "商业空间", location: "本地及周边", year: "2026" }
  ]
};

/* --------------------------------------------------------------------------
   Applier — 填充所有 [data-biz="path"] 元素并接线链接。
   以下逻辑无需修改。
   -------------------------------------------------------------------------- */

function applyBusiness() {
  const get = (obj, path) =>
    path.split(".").reduce((o, key) => (o == null ? undefined : o[key]), obj);

  document.querySelectorAll("[data-biz]").forEach((el) => {
    const value = get(BUSINESS, el.dataset.biz);
    if (value !== undefined && value !== null) el.textContent = value;
  });

  document.querySelectorAll('[data-link="tel"]').forEach((a) => {
    a.href = "tel:" + String(BUSINESS.phone).replace(/[^\d+]/g, "");
  });

  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  document.title = BUSINESS.name + " | " + BUSINESS.tagline;

  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", BUSINESS.name + " — " + BUSINESS.tagline + "。" + BUSINESS.address + "。");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyBusiness);
} else {
  applyBusiness();
}
