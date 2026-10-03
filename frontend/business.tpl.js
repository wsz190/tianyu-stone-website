/* ==========================================================================
   BUSINESS CONFIG
   --------------------------------------------------------------------------
   This is the ONLY file you edit when cloning the template for a new business.
   index.html, style.css and script.js contain no business-specific details.

   - name / tagline / phone / address .... shown in nav, menu, footer, page title
   - whatsapp ............................ digits only, with country code
   - whatsappMessage ..................... pre-filled text for the WhatsApp chat
   - stats ............................... the three animated numbers ("15+", "500+" ...)
   - projects ............................ captions for the two featured projects
   ========================================================================== */

const BUSINESS = {
  name: "ATELIER",
  tagline: "Premium Tiles, Marble & Surfaces",
  phone: "+91 00000 00000",
  whatsapp: "910000000000",
  whatsappMessage: "Hello, I would like a quote for my project.",
  address: "Ambala, Haryana",

  stats: {
    years: "15+",
    projects: "500+",
    designs: "120+"
  },

  projects: [
    { title: "Private Residence", location: "Ambala, Haryana", type: "Residential", year: "2024" },
    { title: "Corporate Atrium", location: "Chandigarh", type: "Commercial", year: "2023" }
  ]
};

/* --------------------------------------------------------------------------
   Applier — fills every [data-biz="path"] element and wires the links.
   Nothing below needs editing.
   -------------------------------------------------------------------------- */

function applyBusiness() {
  const get = (obj, path) =>
    path.split(".").reduce((o, key) => (o == null ? undefined : o[key]), obj);

  document.querySelectorAll("[data-biz]").forEach((el) => {
    const value = get(BUSINESS, el.dataset.biz);
    if (value !== undefined && value !== null) el.textContent = value;
  });

  const waText = BUSINESS.whatsappMessage
    ? "?text=" + encodeURIComponent(BUSINESS.whatsappMessage)
    : "";

  document.querySelectorAll('[data-link="whatsapp"]').forEach((a) => {
    a.href = "https://wa.me/" + BUSINESS.whatsapp + waText;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });

  document.querySelectorAll('[data-link="tel"]').forEach((a) => {
    a.href = "tel:" + String(BUSINESS.phone).replace(/[^\d+]/g, "");
  });

  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  document.title = BUSINESS.name + " | " + BUSINESS.tagline;

  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", BUSINESS.name + " — " + BUSINESS.tagline + ". " + BUSINESS.address + ".");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyBusiness);
} else {
  applyBusiness();
}
