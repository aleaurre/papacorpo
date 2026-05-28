# Modo Corpo — Persona Studio

Extensión de Chrome que deja elegir un "personaje" de LinkedIn y usa Gemini para
reescribir titular/about/posts y generar foto + banner coherentes (Nano Banana).

**Cambia el perfil DE VERDAD** (visible para todos) automatizando la UI real de
edición de LinkedIn — NO usa la API (está bloqueada para editar perfiles, incluso
con Premium o la Profile Edit API, que exige aprobación de partner). Guarda un
snapshot del original para **deshacer con un click**.

## Cargar la extensión
1. `chrome://extensions` → activá "Modo desarrollador"
2. "Cargar descomprimida" → elegí esta carpeta
3. Abrí tu perfil de LinkedIn → clic en el ícono → se abre el side panel
4. Pegá tu API key de Google AI Studio (o hardcodeala en `gemini.js` → `DEFAULT_KEY`)

## Flujo de uso
1. Elegí un personaje → **Transformar mi perfil** (genera texto + imágenes, muestra
   preview y aplica un **overlay local seguro** que solo ves vos).
2. Si te gusta → **Aplicar de verdad en LinkedIn** (snapshot + escribe titular y about
   reales vía la UI). → **Restaurar mi perfil original** deshace.
3. **Descargar foto + banner** → los subís a mano (LinkedIn bloquea la subida automática).

## Modelos
- Texto: `gemini-2.5-flash` · Imágenes: `gemini-3.1-flash-image-preview` (Nano Banana 2)

## ⚠️ Seguridad de cuenta
Automatizar escrituras puede activar el anti-bot de LinkedIn. Para el demo, disparalo
a mano un par de veces — no lo pongas en loop ni lo dejes spameando.

---

## División de tareas (2 personas)

### Track B — IA + orquestación  ✅ HECHO
`gemini.js`, `sidepanel.*`, `manifest.json`, `background.js`
Reescritura, imágenes, cringe-o-meter, personas, UI, snapshot/restore desde el panel.

### Track A — DOM + automatización de UI  ⬜ TU COMPAÑERO/A
`content.js` — ya trae resuelto lo difícil (setter de inputs React, `waitFor`,
snapshot/restore, overlay). **Falta: verificar los SELECTORES** (`SEL`) en tu perfil
real en español: lápiz "Editar introducción", input del titular, lápiz/textarea del
About, botón Guardar. Stretch: reescribir posts del feed.

### Contrato de mensajes (no romper)
```js
{ type: "SCRAPE" }                                  // → { headline, about, posts }
{ type: "APPLY_PREVIEW", payload }                  // overlay local seguro
{ type: "CLEAR_PREVIEW" }
{ type: "APPLY_REAL", payload: { headline, about } }// snapshot + escribe de verdad
{ type: "RESTORE_REAL" }                            // deshace desde el snapshot
```

---

## Brief para pegar en el Claude del Track A

> Estoy en una hackathon de 2hs. Tengo una extensión de Chrome (Manifest V3) que
> personaliza el perfil de LinkedIn como un "personaje" y lo cambia DE VERDAD
> automatizando la UI real de edición (no uso la API de LinkedIn, está bloqueada).
> Mi parte es el content.js que corre en la página. Ya tengo resueltos los helpers:
> `setReactValue` (setter nativo + evento input, porque LinkedIn es React),
> `waitFor` (MutationObserver), `findByLabel`, y la lógica de snapshot/restore en
> chrome.storage. Se comunica con el side panel por chrome.tabs.sendMessage con estos
> mensajes: SCRAPE (devuelve {headline, about, posts}), APPLY_PREVIEW (overlay local),
> APPLY_REAL ({headline, about} → guarda snapshot del valor real actual y luego abre
> el modal "Editar introducción", escribe el titular, guarda; ídem About), y
> RESTORE_REAL (reescribe el snapshot). Lo que necesito de vos: ayudame a encontrar
> SELECTORES robustos en MI perfil (LinkedIn en español) para: el lápiz de editar
> introducción, el input del titular dentro del modal, el lápiz y el textarea del
> About, y el botón Guardar. Te paso el HTML que copie con inspeccionar. Importante:
> que `editHeadline` y `editAbout` esperen a que el modal cargue, escriban con
> setReactValue, y cliqueen Guardar dentro del [role="dialog"]. Objetivo: cambiar mi
> perfil real y poder revertirlo, demo en vivo.

---

## Checklist de demo
- [ ] API key cargada y una transformación probada temprano
- [ ] APPLY_REAL anda en titular y About; RESTORE_REAL deshace
- [ ] 4–5 personas distintas (incluí una "en serio" tipo Founder)
- [ ] **Grabá un video del demo funcionando** como backup
- [ ] Foto/banner: descarga + subida manual ensayada (o como preview)
