// content.js — TRACK A (DOM de LinkedIn). Corre dentro de la página de LinkedIn.
// Recibe mensajes del side panel y toca el DOM. Solo cambia lo que VOS ves
// (modo probador) — no modifica tu perfil real para los demás.
//
// TU TRABAJO (Track A):
//   1) Abrí tu perfil, F12, inspeccioná y completá los SELECTORES de abajo.
//   2) LinkedIn ofusca clases — usá selectores estables: por aria-label, por
//      data-* , o por estructura. Probá en consola: document.querySelector('...')
//   3) Guardá el estado original para poder revertir.
//   4) Cuando los 4 (foto, banner, headline, about) anden, sumá los posts.

// COMPLETAR: estos selectores son tentativos. Verificalos en tu perfil real.
const SELECTORS = {
  pfp: "img.pv-top-card-profile-picture__image, .pv-top-card__photo img, img.profile-photo-edit__preview",
  banner: ".profile-background-image img, .pv-top-card-background, .live-video-hero-image__image",
  headline: ".text-body-medium.break-words, .pv-text-details__left-panel .text-body-medium",
  about: "#about ~ .display-flex .inline-show-more-text, section.pv-about-section .inline-show-more-text"
};

const original = {}; // backup para revertir

function q(sel) {
  for (const s of sel.split(",")) {
    const el = document.querySelector(s.trim());
    if (el) return el;
  }
  return null;
}

// --- SCRAPE: leer el perfil actual y devolverlo al side panel ----------------
function scrape() {
  const headlineEl = q(SELECTORS.headline);
  const aboutEl = q(SELECTORS.about);
  // TODO: agarrar los textos de los últimos posts del feed del perfil.
  const posts = [];
  return {
    headline: headlineEl?.textContent?.trim() || "",
    about: aboutEl?.textContent?.trim() || "",
    posts
  };
}

// --- APPLY: inyectar el personaje generado -----------------------------------
function applyTransform(p) {
  // Foto
  const pfp = q(SELECTORS.pfp);
  if (pfp && p.pfpDataUrl) {
    original.pfp ??= pfp.src;
    pfp.src = p.pfpDataUrl;
    pfp.srcset = "";
  }
  // Banner
  const banner = q(SELECTORS.banner);
  if (banner && p.bannerDataUrl) {
    if (banner.tagName === "IMG") {
      original.banner ??= banner.src;
      banner.src = p.bannerDataUrl;
    } else {
      original.bannerBg ??= banner.style.backgroundImage;
      banner.style.backgroundImage = `url(${p.bannerDataUrl})`;
    }
  }
  // Headline
  const headlineEl = q(SELECTORS.headline);
  if (headlineEl && p.headline) {
    original.headline ??= headlineEl.textContent;
    headlineEl.textContent = p.headline;
  }
  // About
  const aboutEl = q(SELECTORS.about);
  if (aboutEl && p.about) {
    original.about ??= aboutEl.textContent;
    aboutEl.textContent = p.about;
  }
  // TODO: reescribir los posts del feed con p.posts[].

  // 💥 Momento wow: un flash sutil al transformar.
  flashTransform();
  return { ok: true, applied: Object.keys(original) };
}

// --- REVERT ------------------------------------------------------------------
function revert() {
  const pfp = q(SELECTORS.pfp);
  if (pfp && original.pfp != null) pfp.src = original.pfp;
  const banner = q(SELECTORS.banner);
  if (banner) {
    if (banner.tagName === "IMG" && original.banner != null) banner.src = original.banner;
    else if (original.bannerBg != null) banner.style.backgroundImage = original.bannerBg;
  }
  const headlineEl = q(SELECTORS.headline);
  if (headlineEl && original.headline != null) headlineEl.textContent = original.headline;
  const aboutEl = q(SELECTORS.about);
  if (aboutEl && original.about != null) aboutEl.textContent = original.about;
  return { ok: true };
}

// --- Animación de transformación ---------------------------------------------
function flashTransform() {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;inset:0;z-index:99999;pointer-events:none;" +
    "background:radial-gradient(circle at 30% 20%,rgba(216,242,58,.55),transparent 60%);" +
    "opacity:0;transition:opacity .25s ease;";
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; });
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 320);
}

// --- Router de mensajes ------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg.type === "SCRAPE") sendResponse(scrape());
    else if (msg.type === "APPLY_TRANSFORM") sendResponse(applyTransform(msg.payload));
    else if (msg.type === "REVERT") sendResponse(revert());
  } catch (e) {
    sendResponse({ ok: false, error: String(e) });
  }
  return true; // respuesta async
});
