// content.js — TRACK A (DOM de LinkedIn). Corre dentro de la página.
// AHORA cambia el perfil DE VERDAD automatizando la UI real de edición de LinkedIn
// (abre el modal, escribe, guarda) y guarda un snapshot para revertir.
// No usa la API de LinkedIn (está bloqueada): maneja la UI como si clickearas vos.
//
// Mensajes que recibe del side panel:
//   SCRAPE        -> { headline, about, posts }   (leer estado actual)
//   APPLY_PREVIEW -> overlay local seguro (solo lo ves vos)   { payload }
//   CLEAR_PREVIEW -> saca el overlay
//   APPLY_REAL    -> snapshot + escribe de verdad             { payload }
//   RESTORE_REAL  -> reescribe el snapshot (deshacer real)
//
// TU TRABAJO (Track A): completar SELECTORES marcados con ⚠️ inspeccionando tu perfil.
// Lo difícil ya está hecho: setter de inputs React, waitFor, snapshot/restore.

// ============================================================================
//  HELPERS (ya resueltos — no deberías tocarlos)
// ============================================================================

// React ignora `el.value = x`. Hay que usar el setter NATIVO y disparar input.
function setReactValue(el, value) {
  const proto = el.tagName === "TEXTAREA"
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// Para campos contenteditable (composer de posts).
function setEditableText(el, text) {
  el.focus();
  el.textContent = text;
  el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
}

// Espera a que aparezca un elemento (los modales de LinkedIn cargan async).
function waitFor(selector, timeout = 9000) {
  return new Promise((resolve, reject) => {
    const hit = document.querySelector(selector);
    if (hit) return resolve(hit);
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { obs.disconnect(); resolve(el); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); reject(new Error("timeout: " + selector)); }, timeout);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Busca un botón por su texto o aria-label (robusto ante clases ofuscadas).
function findByLabel(labels, scope = document) {
  const wanted = labels.map(l => l.toLowerCase());
  const els = scope.querySelectorAll('button, a, [role="button"]');
  for (const el of els) {
    const txt = (el.getAttribute("aria-label") || el.textContent || "").trim().toLowerCase();
    if (wanted.some(w => txt.includes(w))) return el;
  }
  return null;
}

// ============================================================================
//  SELECTORES  ⚠️ VERIFICAR EN TU PERFIL (LinkedIn en español)
// ============================================================================
const SEL = {
  // Lápiz "Editar introducción" (abre el modal con titular + about resumido).
  editIntroBtn: ['editar presentación', 'editar introducción', 'edit intro'],
  // Dentro del modal de intro:
  headlineInput: 'input[id*="headline"], textarea[id*="headline"], #single-line-text-form-component-headline',
  // El About largo suele tener su propio lápiz y un <textarea> grande.
  editAboutBtn: ['editar acerca de', 'editar extracto', 'edit about', 'edit summary'],
  aboutTextarea: 'textarea[id*="summary"], textarea[id*="about"], .ql-editor[contenteditable="true"]',
  // Guardar (sirve para ambos modales).
  saveBtn: ['guardar', 'save'],
  // Para leer el perfil sin abrir modales:
  headlineRead: '.text-body-medium.break-words',
  aboutRead: '#about ~ .display-flex .inline-show-more-text, section[data-section="summary"] .inline-show-more-text',
  postContainers: 'main article, main div[data-urn*="activity"], main div[role="article"]'
};

// ============================================================================
//  LEER (SCRAPE)
// ============================================================================
function cleanText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function uniqueTexts(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractPosts(limit = 5) {
  const candidates = Array.from(document.querySelectorAll(SEL.postContainers));
  const posts = [];

  for (const node of candidates) {
    const textNodes = Array.from(
      node.querySelectorAll(
        '.update-components-text, .feed-shared-update-v2__description, .feed-shared-inline-show-more-text, span[dir="ltr"]'
      )
    )
      .map(el => cleanText(el.textContent))
      .filter(Boolean);

    const combined = cleanText(textNodes.join(" "));
    if (combined.length < 80) continue;
    posts.push(combined);
    if (posts.length >= limit) break;
  }

  return uniqueTexts(posts);
}

function extractRawProfileText() {
  const main = document.querySelector("main");
  return cleanText(main?.innerText || document.body?.innerText || "").slice(0, 20000);
}

function scrape() {
  const h = document.querySelector(SEL.headlineRead);
  const a = document.querySelector(SEL.aboutRead);
  const posts = extractPosts();
  return {
    headline: cleanText(h?.textContent) || "",
    about: cleanText(a?.textContent) || "",
    posts,
    rawProfileText: extractRawProfileText()
  };
}

// ============================================================================
//  CAMBIO REAL vía UI  +  SNAPSHOT / RESTORE
// ============================================================================
async function editHeadline(text) {
  const pencil = findByLabel(SEL.editIntroBtn);
  if (!pencil) throw new Error("No encontré el lápiz 'Editar introducción' (revisá SEL.editIntroBtn).");
  pencil.click();
  const input = await waitFor(SEL.headlineInput);
  setReactValue(input, text);
  await sleep(250);
  const save = findByLabel(SEL.saveBtn, input.closest('[role="dialog"]') || document);
  if (!save) throw new Error("No encontré el botón Guardar del modal.");
  save.click();
  await sleep(900); // esperar que cierre y persista
}

async function editAbout(text) {
  const pencil = findByLabel(SEL.editAboutBtn);
  if (!pencil) throw new Error("No encontré el lápiz 'Editar acerca de'.");
  pencil.click();
  const area = await waitFor(SEL.aboutTextarea);
  if (area.classList.contains("ql-editor")) setEditableText(area, text);
  else setReactValue(area, text);
  await sleep(250);
  const save = findByLabel(SEL.saveBtn, area.closest('[role="dialog"]') || document);
  save?.click();
  await sleep(900);
}

async function applyReal(payload) {
  // 1) Snapshot del estado REAL actual, solo si no hay uno guardado.
  const { snapshot } = await chrome.storage.local.get("snapshot");
  if (!snapshot) {
    const current = scrape();
    await chrome.storage.local.set({ snapshot: { headline: current.headline, about: current.about, ts: Date.now() } });
  }
  // 2) Escribir de verdad (titular y about).
  if (payload.headline) await editHeadline(payload.headline);
  if (payload.about) await editAbout(payload.about);
  // (foto/banner -> descarga manual desde el panel; posts -> stretch)
  return { ok: true, committed: ["headline", "about"] };
}

async function restoreReal() {
  const { snapshot } = await chrome.storage.local.get("snapshot");
  if (!snapshot) return { ok: false, error: "No hay snapshot para restaurar." };
  if (snapshot.headline) await editHeadline(snapshot.headline);
  if (snapshot.about) await editAbout(snapshot.about);
  await chrome.storage.local.remove("snapshot");
  return { ok: true };
}

// ============================================================================
//  OVERLAY LOCAL (preview seguro — solo lo ves vos, sin tocar el perfil real)
// ============================================================================
const ov = {};
function applyPreview(p) {
  const h = document.querySelector(SEL.headlineRead);
  if (h && p.headline) { ov.headline ??= h.textContent; h.textContent = p.headline; }
  const a = document.querySelector(SEL.aboutRead);
  if (a && p.about) { ov.about ??= a.textContent; a.textContent = p.about; }
  flash();
  return { ok: true };
}
function clearPreview() {
  const h = document.querySelector(SEL.headlineRead);
  if (h && ov.headline != null) h.textContent = ov.headline;
  const a = document.querySelector(SEL.aboutRead);
  if (a && ov.about != null) a.textContent = ov.about;
  return { ok: true };
}
function flash() {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;inset:0;z-index:99999;pointer-events:none;opacity:0;" +
    "transition:opacity .25s;background:radial-gradient(circle at 30% 20%,rgba(216,242,58,.55),transparent 60%);";
  document.body.appendChild(el);
  requestAnimationFrame(() => el.style.opacity = "1");
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 320);
}

// ============================================================================
//  ROUTER
// ============================================================================
chrome.runtime.onMessage.addListener((msg, _s, send) => {
  (async () => {
    try {
      if (msg.type === "SCRAPE") send(scrape());
      else if (msg.type === "APPLY_PREVIEW") send(applyPreview(msg.payload));
      else if (msg.type === "CLEAR_PREVIEW") send(clearPreview());
      else if (msg.type === "APPLY_REAL") send(await applyReal(msg.payload));
      else if (msg.type === "RESTORE_REAL") send(await restoreReal());
    } catch (e) {
      send({ ok: false, error: String(e.message || e) });
    }
  })();
  return true; // respuesta async
});
