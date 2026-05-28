// gemini.js — TRACK B (IA). Corre en el contexto del side panel.
// Reescrito para usar la API de Anthropic (Claude) en vez de Gemini.
// Imágenes: Pollinations.ai (gratuito, sin key).
//
// Pegá tu Anthropic API key en DEFAULT_KEY (empieza con sk-ant-...)
// o cargala desde el panel de configuración.

const DEFAULT_KEY = ""; // <-- pegá tu key de Anthropic acá: sk-ant-...

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const CLAUDE_BASE = "https://api.anthropic.com/v1/messages";

async function getKey() {
  if (DEFAULT_KEY) return DEFAULT_KEY;
  const { geminiKey } = await chrome.storage.local.get("geminiKey");
  if (!geminiKey) throw new Error("Falta la API key de Anthropic. Cargala arriba en el panel.");
  return geminiKey;
}

// Llamada base a Claude — devuelve el texto de la respuesta.
async function callClaude(prompt, temperature = 0.9) {
  const key = await getKey();
  const res = await fetch(CLAUDE_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      temperature,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// Parseo defensivo de JSON en la respuesta.
function parseJSON(raw) {
  try { return JSON.parse(raw); }
  catch {
    const m = raw.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
}

// ---------------------------------------------------------------------------
// PERSONAS
// ---------------------------------------------------------------------------
const PERSONAS = {
  papa_corpo: {
    label: "Papá Corpo",
    voice:
      "Ejecutivo entrañable y motivador, mezcla de jefe buena onda y papá orgulloso. " +
      "Usa metáforas de asado, fútbol y 'el equipo'. Inspirador pero con ternura, cero cinismo. " +
      "Termina los posts con una pregunta para 'la comunidad'.",
    pfp: "professional corporate headshot of a warm middle-aged businessman, friendly dad energy, soft studio lighting, light blue shirt, gentle confident smile, clean neutral background",
    banner: "minimal corporate banner, warm cream and navy palette, subtle geometric shapes, motivational vibe, lots of negative space, premium and clean"
  },
  guru: {
    label: "Gurú de LinkedIn",
    voice:
      "Gurú de la productividad al borde del cringe. Frases cortas. Una palabra por línea para enfatizar. " +
      "Historia personal falsamente humilde que termina en lección de negocios. Hashtags genéricos. " +
      "Promete que esto 'le va a cambiar la carrera' al lector.",
    pfp: "ultra-confident entrepreneur headshot, crossed arms, blazer no tie, dramatic lighting, skyline blurred in background, intense visionary gaze",
    banner: "bold motivational banner, dark gradient, abstract upward arrows and graphs, high contrast, hustle aesthetic"
  },
  founder: {
    label: "Founder serio",
    voice:
      "Founder técnico, sobrio y creíble. Concreto, basado en datos, sin hype. " +
      "Habla de tracción, aprendizaje y producto. Tono humano, primera persona, frases completas.",
    pfp: "clean minimal founder headshot, natural light, plain knit sweater, calm and credible, neutral studio background, approachable and modern",
    banner: "refined startup banner, off-white background, single elegant accent line, editorial and restrained, premium typography space"
  },
  gamer: {
    label: "Gamer Profesional",
    voice:
      "Profesional que enmarca toda su carrera como un videojuego: 'subí de nivel', 'desbloqueé', " +
      "'XP', 'boss final', 'speedrun de la entrevista'. Energía positiva, divertido pero competente.",
    pfp: "vibrant headshot with neon RGB rim lighting, gaming setup bokeh in background, confident playful expression, modern streetwear-meets-tech style",
    banner: "energetic banner with neon accents, pixel and glitch motifs, dark background, playful gamer-meets-corporate vibe, dynamic"
  },
  cottage: {
    label: "Cottagecore Corporativo",
    voice:
      "Profesional que escribe como si trabajara desde una cabaña entre helechos. " +
      "Calma, slow-work, 'florecer en mi rol', metáforas de jardinería y estaciones. Antídoto del hustle.",
    pfp: "soft natural-light portrait, cozy knit, warm earthy tones, plants and wooden textures, serene gentle expression, film grain",
    banner: "warm organic banner, dried flowers and linen textures, muted earthy palette, soft morning light, calm and tactile"
  }
};

// ---------------------------------------------------------------------------
// TEXTO: reescribe headline + about + posts en la voz de la persona.
// ---------------------------------------------------------------------------
async function transformProfile(personaKey, scraped) {
  const persona = PERSONAS[personaKey] || { label: personaKey, voice: personaKey };

  const prompt = [
    `Sos un editor de marca personal. Reescribí el perfil de LinkedIn de abajo`,
    `en esta VOZ/PERSONA: "${persona.label}". Estilo de la voz: ${persona.voice}`,
    ``,
    `Mantené el idioma original del perfil (probablemente español rioplatense).`,
    `No inventes hechos verificables (empresas, títulos); jugá con el TONO, no con los datos.`,
    ``,
    `PERFIL ACTUAL (JSON):`,
    JSON.stringify(scraped, null, 2),
    ``,
    `Devolvé SOLO este JSON sin ningún texto adicional ni backticks:`,
    `{"headline": "<máx 220 caracteres>",`,
    ` "about": "<2 a 4 frases>",`,
    ` "posts": ["<reescritura del post 1>", "<post 2>", ...]}`,
    `Reescribí tantos posts como vengan en el input. Si no vienen posts, devolvé [].`
  ].join("\n");

  const raw = await callClaude(prompt, 0.9);
  const parsed = parseJSON(raw);
  if (!parsed) throw new Error("No se pudo parsear la respuesta de Claude.");
  return {
    headline: parsed.headline || "",
    about: parsed.about || "",
    posts: Array.isArray(parsed.posts) ? parsed.posts : []
  };
}

// ---------------------------------------------------------------------------
// IMAGEN: usa Pollinations.ai (gratuito, sin key).
// Devuelve un data URL listo para <img src>.
// ---------------------------------------------------------------------------
async function generateImage(promptText, { aspect = "1:1" } = {}) {
  // Dimensiones según aspect ratio
  const dims = {
    "1:1": [512, 512],
    "4:1": [1024, 256],
    "16:9": [1024, 576]
  }[aspect] || [512, 512];

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=${dims[0]}&height=${dims[1]}&nologo=true&model=flux`;

  // Pollinations devuelve la imagen directamente — la convertimos a data URL
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Genera foto + banner para una persona en paralelo.
async function generatePersonaImages(personaKey) {
  const persona = PERSONAS[personaKey] || {};
  const [pfpDataUrl, bannerDataUrl] = await Promise.all([
    generateImage(persona.pfp || "professional headshot", { aspect: "1:1" }),
    generateImage(persona.banner || "minimal corporate banner", { aspect: "4:1" })
  ]);
  return { pfpDataUrl, bannerDataUrl };
}

// ---------------------------------------------------------------------------
// CRINGE-O-METER
// ---------------------------------------------------------------------------
async function cringeScore(text) {
  if (!text || !text.trim()) return { score: 0, label: "Vacío", tip: "" };
  const prompt =
    `Puntuá qué tan "cringe de LinkedIn" es este texto, de 0 (humano y natural) ` +
    `a 100 (gurú motivacional insoportable). Devolvé SOLO JSON sin backticks: ` +
    `{"score": <0-100>, "label": "<2-3 palabras>", "tip": "<un consejo corto en español>"}.\n\nTEXTO:\n${text}`;
  const raw = await callClaude(prompt, 0.4);
  return parseJSON(raw) || { score: 50, label: "Indeterminado", tip: "" };
}

// ---------------------------------------------------------------------------
// COMPOSER: reescritura + idea de imagen + cringe en una sola llamada.
// ---------------------------------------------------------------------------
async function composePost(personaKey, draft) {
  if (!draft || !draft.trim()) return null;
  const persona = PERSONAS[personaKey] || { label: "profesional", voice: "profesional claro y humano" };
  const prompt =
    `Sos editor de contenido para LinkedIn. Tomá este borrador y trabajalo en la VOZ ` +
    `"${persona.label}" (${persona.voice}). Mantené el idioma del borrador.\n\n` +
    `BORRADOR:\n${draft}\n\n` +
    `Devolvé SOLO este JSON sin backticks:\n` +
    `{"rewrite": "<el post reescrito, listo para publicar>",\n` +
    ` "imageIdea": "<prompt en inglés para generar una imagen que acompañe el post>",\n` +
    ` "cringe": {"score": <0-100>, "label": "<2-3 palabras>", "tip": "<consejo corto en español>"}}`;
  const raw = await callClaude(prompt, 0.85);
  return parseJSON(raw);
}

window.GeminiAPI = {
  PERSONAS,
  transformProfile,
  generateImage,
  generatePersonaImages,
  cringeScore,
  composePost
};