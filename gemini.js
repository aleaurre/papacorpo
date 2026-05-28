// gemini.js — TRACK B (IA). Corre en el contexto del side panel.
// Expone window.GeminiAPI con: transformProfile, generateImage, cringeScore, PERSONAS.
//
// La API key se guarda en chrome.storage.local (campo en el side panel).
// Para el demo podés hardcodear DEFAULT_KEY abajo. OJO: en cliente la key queda
// expuesta — en la versión real esto va detrás de un proxy. Para hackathon, ok.

const DEFAULT_KEY = "AQ.Ab8RN6JhG5DPq23x05WvcbQYRpWDioKR6aosTIxPhFHnykR9iQ"; // <-- pegá tu API key de AI Studio acá para el demo, o cargala en el panel

// gemini.js
const TEXT_MODEL = "gemini-1.5-flash";              
// Cambiá el string por el modelo de Imagen estable de producción si el preview está saturado
const IMAGE_MODEL = "imagen-3.0-generate-002"; 
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function getKey() {
  if (DEFAULT_KEY) return DEFAULT_KEY;
  const { geminiKey } = await chrome.storage.local.get("geminiKey");
  if (!geminiKey) throw new Error("Falta la API key. Cargala arriba en el panel.");
  return geminiKey;
}

// ---------------------------------------------------------------------------
// PERSONAS: cada una define la voz del texto y el look de las imágenes.
// Agregá las que quieras — el demo brilla con 4 o 5 bien distintas.
// ---------------------------------------------------------------------------
const PERSONAS = {
  papa_corpo: {
    label: "Papá Corpo",
    voice:
      "Ejecutivo entrañable y motivador, mezcla de jefe buena onda y papá orgulloso. " +
      "Usa metáforas de asado, fútbol y 'el equipo'. Inspirador pero con ternura, cero cinismo. " +
      "Termina los posts con una pregunta para 'la comunidad'.",
    pfp: "professional corporate headshot of a warm middle-aged businessman, friendly dad energy, " +
      "soft studio lighting, light blue shirt, gentle confident smile, clean neutral background",
    banner: "minimal corporate banner, warm cream and navy palette, subtle geometric shapes, " +
      "a faint motivational vibe, lots of negative space, premium and clean"
  },
  guru: {
    label: "Gurú de LinkedIn",
    voice:
      "Gurú de la productividad al borde del cringe. Frases cortas. Una palabra por línea para enfatizar. " +
      "Historia personal falsamente humilde que termina en lección de negocios. Hashtags genéricos. " +
      "Promete que esto 'le va a cambiar la carrera' al lector.",
    pfp: "ultra-confident entrepreneur headshot, crossed arms, blazer no tie, dramatic lighting, " +
      "skyline blurred in background, intense visionary gaze",
    banner: "bold motivational banner, dark gradient, abstract upward arrows and graphs, " +
      "high contrast, slightly over-the-top hustle aesthetic"
  },
  founder: {
    label: "Founder serio",
    voice:
      "Founder técnico, sobrio y creíble. Concreto, basado en datos, sin hype. " +
      "Habla de tracción, aprendizaje y producto. Tono humano, primera persona, frases completas. " +
      "Este es el 'modo en serio' que muestra que la herramienta también sirve de verdad.",
    pfp: "clean minimal founder headshot, natural light, plain knit sweater, calm and credible, " +
      "neutral studio background, approachable and modern",
    banner: "refined startup banner, off-white background, single elegant accent line, " +
      "editorial and restrained, premium typography space"
  },
  gamer: {
    label: "Gamer Profesional",
    voice:
      "Profesional que enmarca toda su carrera como un videojuego: 'subí de nivel', 'desbloqueé', " +
      "'XP', 'boss final', 'speedrun de la entrevista'. Energía positiva, divertido pero competente.",
    pfp: "vibrant headshot with neon RGB rim lighting, gaming setup bokeh in background, " +
      "confident playful expression, modern streetwear-meets-tech style",
    banner: "energetic banner with neon accents, pixel and glitch motifs, dark background, " +
      "playful gamer-meets-corporate vibe, dynamic"
  },
  cottage: {
    label: "Cottagecore Corporativo",
    voice:
      "Profesional que escribe como si trabajara desde una cabaña entre helechos. " +
      "Calma, slow-work, 'florecer en mi rol', metáforas de jardinería y estaciones. Antídoto del hustle.",
    pfp: "soft natural-light portrait, cozy knit, warm earthy tones, plants and wooden textures, " +
      "serene gentle expression, film grain",
    banner: "warm organic banner, dried flowers and linen textures, muted earthy palette, " +
      "soft morning light, calm and tactile"
  }
};

// ---------------------------------------------------------------------------
// TEXTO: reescribe headline + about + posts en la voz de la persona.
// Devuelve JSON estricto via responseMimeType.
// ---------------------------------------------------------------------------
async function transformProfile(personaKey, scraped) {
  const persona = PERSONAS[personaKey] || { label: personaKey, voice: personaKey };
  const key = await getKey();

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
    `Devolvé SOLO este JSON:`,
    `{"headline": "<máx 220 caracteres>",`,
    ` "about": "<2 a 4 frases>",`,
    ` "posts": ["<reescritura del post 1>", "<post 2>", ...]}`,
    `Reescribí tantos posts como vengan en el input. Si no vienen posts, devolvé [].`
  ].join("\n");

  const res = await fetch(`${BASE}/${TEXT_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.9 }
    })
  });

  if (!res.ok) throw new Error(`Gemini texto ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "{}";

  // Parseo defensivo: a veces igual mete texto alrededor.
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { headline: "", about: "", posts: [] };
  }
  return {
    headline: parsed.headline || "",
    about: parsed.about || "",
    posts: Array.isArray(parsed.posts) ? parsed.posts : []
  };
}

// ---------------------------------------------------------------------------
// IMAGEN: Nano Banana. Devuelve un data URL listo para <img src>.
// ---------------------------------------------------------------------------
async function generateImage(promptText, { aspect = "1:1" } = {}) {
  const key = await getKey();
  const fullPrompt = `${promptText}. High quality, no text overlay, no watermark. Aspect ratio ${aspect}.`;

  const res = await fetch(`${BASE}/${IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
  });

  if (!res.ok) throw new Error(`Nano Banana ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find(p => p.inlineData || p.inline_data);
  const inline = img?.inlineData || img?.inline_data;
  if (!inline) throw new Error("Nano Banana no devolvió imagen (puede ser filtro de contenido).");
  const mime = inline.mimeType || inline.mime_type || "image/png";
  return `data:${mime};base64,${inline.data}`;
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
// CRINGE-O-METER: puntúa un borrador de 0 (humano) a 100 (gurú nivel dios).
// ---------------------------------------------------------------------------
async function cringeScore(text) {
  if (!text || !text.trim()) return { score: 0, label: "Vacío", tip: "" };
  const key = await getKey();
  const prompt =
    `Puntuá qué tan "cringe de LinkedIn" es este texto, de 0 (humano y natural) ` +
    `a 100 (gurú motivacional insoportable). Devolvé SOLO JSON: ` +
    `{"score": <0-100>, "label": "<2-3 palabras>", "tip": "<un consejo corto en español>"}.\n\nTEXTO:\n${text}`;
  const res = await fetch(`${BASE}/${TEXT_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 }
    })
  });
  if (!res.ok) throw new Error(`Cringe-o-meter ${res.status}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "{}";
  try { return JSON.parse(raw); }
  catch { return { score: 50, label: "Indeterminado", tip: "" }; }
}

// ---------------------------------------------------------------------------
// COMPOSER: en UNA llamada devuelve reescritura + idea de imagen + cringe.
// Eficiente para usar en vivo mientras la persona tipea.
// ---------------------------------------------------------------------------
async function composePost(personaKey, draft) {
  if (!draft || !draft.trim()) return null;
  const persona = PERSONAS[personaKey] || { label: "profesional", voice: "profesional claro y humano" };
  const key = await getKey();
  const prompt =
    `Sos editor de contenido para LinkedIn. Tomá este borrador y trabajalo en la VOZ ` +
    `"${persona.label}" (${persona.voice}). Mantené el idioma del borrador.\n\n` +
    `BORRADOR:\n${draft}\n\n` +
    `Devolvé SOLO este JSON:\n` +
    `{"rewrite": "<el post reescrito, listo para publicar>",\n` +
    ` "imageIdea": "<prompt en inglés para generar una imagen que acompañe el post>",\n` +
    ` "cringe": {"score": <0-100>, "label": "<2-3 palabras>", "tip": "<consejo corto en español>"}}`;
  const res = await fetch(`${BASE}/${TEXT_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.85 }
    })
  });
  if (!res.ok) throw new Error(`Composer ${res.status}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("") || "{}";
  try { return JSON.parse(raw); }
  catch { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; }
}

window.GeminiAPI = {
  PERSONAS,
  transformProfile,
  generateImage,
  generatePersonaImages,
  cringeScore,
  composePost
};
