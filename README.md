# Modo Corpo — Persona Studio

Extensión de Chrome que deja elegir un "personaje" de LinkedIn y usa Gemini para
reescribir headline/about/posts y generar foto + banner coherentes (Nano Banana).
**Modo probador:** cambia lo que vos ves, no tu perfil real para los demás.

## Cargar la extensión (30 segundos)
1. Chrome → `chrome://extensions`
2. Activá "Modo desarrollador" (arriba a la derecha)
3. "Cargar descomprimida" → elegí esta carpeta
4. Abrí tu perfil de LinkedIn → clic en el ícono → se abre el side panel
5. Pegá tu API key de Google AI Studio en el panel (o hardcodeala en `gemini.js` → `DEFAULT_KEY`)

## Modelos
- Texto: `gemini-2.5-flash` (bumpeá a gemini-3 flash si tu cuenta lo tiene)
- Imágenes: `gemini-3.1-flash-image-preview` (Nano Banana 2, free tier ~500/día)

---

## División de tareas (2 personas)

### Track B — IA + orquestación  ✅ HECHO
`gemini.js`, `sidepanel.js`, `sidepanel.html`, `sidepanel.css`, `manifest.json`, `background.js`
- Reescritura de perfil, generación de imágenes, cringe-o-meter, presets de personas, UI.
- Para mejorar: afinar los prompts de cada persona, sumar personas, pulir la UI.

### Track A — DOM de LinkedIn  ⬜ TU COMPAÑERO/A
`content.js` (stub funcional con TODOs)
- Completar los SELECTORES reales inspeccionando el perfil propio.
- Hacer andar scrape → apply → revert para foto, banner, headline, about.
- Stretch: reescribir los posts del feed.

### El contrato entre ambos (NO romper)
El side panel manda al content script:
```js
{ type: "SCRAPE" }              // → responde { headline, about, posts: [] }
{ type: "APPLY_TRANSFORM", payload: { headline, about, posts, pfpDataUrl, bannerDataUrl } }
{ type: "REVERT" }
```
Mientras respeten estos 3 mensajes, cada uno trabaja sin pisar al otro.

---

## Brief para pegar en el Claude del Track A

> Estoy en una hackathon de 2hs armando una extensión de Chrome (Manifest V3) que
> personaliza el perfil de LinkedIn como "modo probador" (solo cambia lo que ve el
> usuario, no el perfil real). Yo tengo el track del DOM. Mi compañera ya tiene listo
> el side panel y la integración con Gemini; se comunican por `chrome.tabs.sendMessage`
> con estos 3 mensajes: SCRAPE (devuelve {headline, about, posts}), APPLY_TRANSFORM
> (payload {headline, about, posts, pfpDataUrl, bannerDataUrl}) y REVERT.
> Tengo un `content.js` stub con un router de mensajes y funciones scrape/applyTransform/
> revert, pero los SELECTORES de LinkedIn son tentativos. Ayudame a: (1) encontrar
> selectores robustos para la foto de perfil, el banner, el headline y el About en mi
> perfil real (te paso el HTML que copie con inspeccionar), (2) que applyTransform
> inyecte data URLs en la foto y el banner sin que LinkedIn los pise al re-renderizar,
> (3) guardar el estado original para revertir. Después vemos reescribir los posts.
> El objetivo es un demo visual con efecto wow en MI perfil, no generalizar a cualquiera.

---

## Checklist de demo (no te olvides)
- [ ] API key cargada y validada (probá una transformación temprano)
- [ ] 4–5 personas bien distintas (incluí una "en serio" tipo Founder)
- [ ] Botón revertir andando (antes/después es el momento del aplauso)
- [ ] **Grabá un video del demo funcionando** como backup
- [ ] Para postear de verdad: copiar/descargar (mencionar en el pitch)
