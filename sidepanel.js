// sidepanel.js — orquestador. Une Track B (GeminiAPI) con Track A (content.js vía mensajes).

const $ = (id) => document.getElementById(id);
let activePersona = null;
let lastPayload = null; // último personaje generado (texto + imágenes)
let lastPersonaLabel = "una versión renovada de mí";

// ---- Personas (chips) -------------------------------------------------------
function renderPersonas() {
  const box = $("personas");
  Object.entries(GeminiAPI.PERSONAS).forEach(([key, p]) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = p.label;
    b.onclick = () => {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      b.classList.add("active");
      activePersona = key;
      $("customPersona").value = "";
    };
    box.appendChild(b);
  });
}

// ---- API key ----------------------------------------------------------------
async function initKey() {
  const { geminiKey, emergencyContact, contactList } = await chrome.storage.local.get(
    ["geminiKey", "emergencyContact", "contactList"]
  );
  if (geminiKey) { $("apiKey").value = geminiKey; $("keyState").textContent = "✓ guardada"; }
  if (emergencyContact) $("emergencyContact").value = emergencyContact;
  if (contactList) $("contactList").value = contactList;
}
$("saveKey").onclick = async () => {
  await chrome.storage.local.set({
    geminiKey: $("apiKey").value.trim(),
    emergencyContact: $("emergencyContact").value.trim(),
    contactList: $("contactList").value.trim()
  });
  $("keyState").textContent = "✓ guardada";
};

// ---- Mensajería con el content script (Track A) -----------------------------
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}
async function sendToPage(message) {
  const tab = await activeTab();
  if (!tab?.url?.includes("linkedin.com")) {
    throw new Error("Abrí tu perfil de LinkedIn en la pestaña activa.");
  }
  return chrome.tabs.sendMessage(tab.id, message);
}

// ---- Estado / UI ------------------------------------------------------------
function status(msg, isErr = false) {
  const s = $("status");
  s.hidden = false;
  s.textContent = msg;
  s.classList.toggle("err", isErr);
}
function setBusy(busy) {
  $("transform").disabled = busy;
  $("transform").textContent = busy ? "Transformando…" : "Transformar mi perfil";
}

// ---- Flujo principal --------------------------------------------------------
$("transform").onclick = async () => {
  const custom = $("customPersona").value.trim();
  const personaKey = custom || activePersona;
  if (!personaKey) return status("Elegí un personaje o escribí uno propio.", true);

  // Persona custom: la registramos al vuelo con prompts genéricos.
  if (custom && !GeminiAPI.PERSONAS[custom]) {
    GeminiAPI.PERSONAS[custom] = {
      label: custom, voice: custom,
      pfp: `professional headshot embodying "${custom}", studio lighting, clean background`,
      banner: `minimal LinkedIn banner embodying "${custom}", premium, lots of negative space`
    };
  }

  try {
    setBusy(true);

    // 1) Leer perfil actual (Track A devuelve {headline, about, posts}).
    status("Leyendo tu perfil…");
    let scraped;
    try {
      scraped = await sendToPage({ type: "SCRAPE" });
    } catch {
      // Si el content script aún no está listo, seguimos con datos vacíos.
      scraped = { headline: "", about: "", posts: [] };
    }

    // 2) IA en paralelo: texto + imágenes.
    status("La IA está armando tu personaje…");
    const [text, images] = await Promise.all([
      GeminiAPI.transformProfile(personaKey, scraped),
      GeminiAPI.generatePersonaImages(personaKey)
    ]);

    const payload = { ...text, ...images };
    lastPayload = payload;

    // 3) Preview en el panel.
    renderPreview(payload);

    // 4) Cringe-o-meter sobre el headline nuevo.
    GeminiAPI.cringeScore(payload.headline).then(renderCringe).catch(() => {});

    // 5) Overlay LOCAL seguro (solo lo ve la usuaria) + habilitar acciones reales.
    status("Personaje listo. Previsualizando…");
    try {
      const r = await sendToPage({ type: "APPLY_PREVIEW", payload });
      if (r?.ok) status("✓ Preview aplicado en la página. Revisalo y, si te gusta, aplicalo de verdad.");
      else status(r?.error || "No pude aplicar el preview en la página.", true);
    } catch (e) {
      status("Preview generado en el panel. (Abrí tu perfil de LinkedIn para verlo en página.)", false);
    }
    $("commitRow").hidden = false;
  } catch (err) {
    status(err.message || String(err), true);
  } finally {
    setBusy(false);
  }
};

// Aplicar DE VERDAD (automatiza la UI real de LinkedIn).
$("applyReal").onclick = async () => {
  if (!lastPayload) return;
  if (!confirm("Esto cambia tu titular y Acerca de REALES, visibles para todos. ¿Seguir? (Se guarda tu original para deshacer.)")) return;
  const btn = $("applyReal");
  btn.disabled = true; btn.textContent = "Aplicando en LinkedIn…";

  // Al IR a cambiar el perfil → aviso al contacto de emergencia.
  Mailer.notifyEmergencyContact().catch(() => {});

  try {
    const r = await sendToPage({ type: "APPLY_REAL", payload: lastPayload });
    if (r?.ok) {
      status("✓ Perfil real actualizado. Lo ve todo el mundo.");
      $("restore").hidden = false;
      // Al CONCRETAR los cambios → borrador para avisar a todos tus contactos.
      Mailer.announceNewProfile(lastPersonaLabel).catch(() => {});
    } else status(r?.error || "No se pudo aplicar.", true);
  } catch (e) { status(e.message, true); }
  finally { btn.disabled = false; btn.textContent = "Aplicar de verdad en LinkedIn"; }
};

// Deshacer real (reescribe el snapshot).
$("restore").onclick = async () => {
  try {
    const r = await sendToPage({ type: "RESTORE_REAL" });
    if (r?.ok) { status("✓ Perfil original restaurado."); $("restore").hidden = true; }
    else status(r?.error || "No había snapshot.", true);
  } catch (e) { status(e.message, true); }
};

// Descargar foto + banner para subirlos a mano (LinkedIn bloquea la subida automática).
$("download").onclick = () => {
  if (!lastPayload) return;
  const dl = (dataUrl, name) => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl; a.download = name; a.click();
  };
  dl(lastPayload.pfpDataUrl, "foto-perfil.png");
  setTimeout(() => dl(lastPayload.bannerDataUrl, "banner.png"), 300);
  status("Descargadas. Subilas desde el editor de foto/banner de LinkedIn.");
};

// ---- Render del preview -----------------------------------------------------
function renderPreview(p) {
  $("preview").hidden = false;
  if (p.bannerDataUrl) $("prevBanner").src = p.bannerDataUrl;
  if (p.pfpDataUrl) $("prevPfp").src = p.pfpDataUrl;
  $("prevHeadline").textContent = p.headline || "";
  $("prevAbout").textContent = p.about || "";
}
function renderCringe(c) {
  const score = Math.max(0, Math.min(100, c.score || 0));
  $("cringeFill").style.width = score + "%";
  $("cringeLabel").textContent = `${score} · ${c.label || ""}`;
  $("cringeTip").textContent = c.tip || "";
}

// ---- Composer en vivo --------------------------------------------------------
let composeTimer = null;
let lastCompose = null;

$("draft").addEventListener("input", () => {
  clearTimeout(composeTimer);
  const draft = $("draft").value.trim();
  if (!draft) { $("composeOut").hidden = true; return; }
  composeTimer = setTimeout(runCompose, 700); // debounce
});

async function runCompose() {
  const draft = $("draft").value.trim();
  if (!draft) return;
  const personaKey = $("customPersona").value.trim() || activePersona || "founder";
  try {
    const out = await GeminiAPI.composePost(personaKey, draft);
    if (!out) return;
    lastCompose = out;
    $("composeOut").hidden = false;
    $("rewrite").textContent = out.rewrite || "";
    $("imageIdea").textContent = out.imageIdea ? `💡 Imagen sugerida: ${out.imageIdea}` : "";
    const c = out.cringe || {};
    const score = Math.max(0, Math.min(100, c.score || 0));
    $("cCringeFill").style.width = score + "%";
    $("cCringeLabel").textContent = `${score} · ${c.label || ""}`;
    $("cCringeTip").textContent = c.tip || "";
  } catch (e) { /* silencioso mientras tipea */ }
}

$("useRewrite").onclick = () => {
  if (lastCompose?.rewrite) { $("draft").value = lastCompose.rewrite; $("composeOut").hidden = true; }
};
$("copyRewrite").onclick = async () => {
  if (lastCompose?.rewrite) { await navigator.clipboard.writeText(lastCompose.rewrite); status("Copiado al portapapeles."); }
};
$("genIdea").onclick = async () => {
  if (!lastCompose?.imageIdea) return;
  const btn = $("genIdea"); btn.disabled = true; btn.textContent = "Generando…";
  try {
    const url = await GeminiAPI.generateImage(lastCompose.imageIdea, { aspect: "1:1" });
    $("ideaImg").src = url; $("ideaImg").hidden = false;
  } catch (e) { status(e.message, true); }
  finally { btn.disabled = false; btn.textContent = "Generar imagen sugerida"; }
};

// ---- Init -------------------------------------------------------------------
renderPersonas();
initKey();
