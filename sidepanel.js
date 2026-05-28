// sidepanel.js — orquestador. Une Track B (GeminiAPI) con Track A (content.js vía mensajes).

const $ = (id) => document.getElementById(id);
let activePersona = null;

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
  const { geminiKey } = await chrome.storage.local.get("geminiKey");
  if (geminiKey) { $("apiKey").value = geminiKey; $("keyState").textContent = "✓ guardada"; }
}
$("saveKey").onclick = async () => {
  await chrome.storage.local.set({ geminiKey: $("apiKey").value.trim() });
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

    // 3) Preview en el panel.
    renderPreview(payload);

    // 4) Cringe-o-meter sobre el headline nuevo.
    GeminiAPI.cringeScore(payload.headline).then(renderCringe).catch(() => {});

    // 5) Aplicar al DOM (Track A).
    status("Aplicando en LinkedIn…");
    try {
      await sendToPage({ type: "APPLY_TRANSFORM", payload });
      status("✓ Listo. Mirá tu perfil.");
      $("revert").hidden = false;
    } catch (e) {
      status("Preview generado. (El inyector de DOM todavía no responde — Track A.)", false);
    }
  } catch (err) {
    status(err.message || String(err), true);
  } finally {
    setBusy(false);
  }
};

$("revert").onclick = async () => {
  try { await sendToPage({ type: "REVERT" }); status("Perfil restaurado."); $("revert").hidden = true; }
  catch (e) { status(e.message, true); }
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

// ---- Init -------------------------------------------------------------------
renderPersonas();
initKey();
