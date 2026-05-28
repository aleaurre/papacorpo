// email.js — los dos avisos por mail. Corre en el contexto del side panel.
// Por defecto abre un BORRADOR (mailto) para que le des Enviar vos — no manda solo.
// Si configurás un webhook en storage (mailerWebhook), hace POST automático (stretch).
//
// Config en chrome.storage.local:
//   emergencyContact : un email
//   contactList      : emails separados por coma o salto de línea
//   mailerWebhook    : (opcional) URL que recibe {to, subject, body} y envía de verdad

async function cfg() {
  return chrome.storage.local.get(["emergencyContact", "contactList", "mailerWebhook"]);
}

function openDraft({ to = "", bcc = "", subject, body }) {
  const qs = new URLSearchParams();
  if (bcc) qs.set("bcc", bcc);
  qs.set("subject", subject);
  qs.set("body", body);
  const a = document.createElement("a");
  a.href = `mailto:${encodeURIComponent(to)}?${qs.toString()}`;
  a.click();
}

async function send({ to, bcc, subject, body }) {
  const { mailerWebhook } = await cfg();
  if (mailerWebhook) {
    await fetch(mailerWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, bcc, subject, body })
    });
    return { mode: "webhook" };
  }
  openDraft({ to, bcc, subject, body });
  return { mode: "draft" };
}

// 1) Al ir a cambiar el perfil → al contacto de emergencia.
async function notifyEmergencyContact() {
  const { emergencyContact } = await cfg();
  if (!emergencyContact) return { skipped: "Sin contacto de emergencia configurado." };
  const subject = "🚨 Código rojo: tengo demasiado tiempo libre";
  const body =
    "Hola,\n\n" +
    "Si estás recibiendo este mail es porque estoy, una vez más, rediseñando mi perfil de LinkedIn.\n\n" +
    "Históricamente esto significa una de dos cosas: tengo mucho tiempo al pedo, o estoy evitando algo importante. " +
    "Probablemente ambas.\n\n" +
    "Te designé como mi contacto de emergencia profesional. Por favor, considerá intervenir: " +
    "mandame un meme, ofreceme un café, o recordame que ya tengo un trabajo.\n\n" +
    "Gracias por tu servicio.";
  return send({ to: emergencyContact, subject, body });
}

// 2) Al concretar los cambios → a TODOS los contactos (borrador en BCC, revisás y enviás).
async function announceNewProfile(personaLabel = "una versión renovada de mí") {
  const { contactList } = await cfg();
  const list = (contactList || "").split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  if (!list.length) return { skipped: "Sin lista de contactos configurada." };
  const subject = "📣 Actualicé mi perfil de LinkedIn (sí, otra vez)";
  const body =
    "Familia, amigos, ex compañeros y esa persona que conocí una vez en un evento de networking:\n\n" +
    `Tengo el agrado de anunciar que rebrandié mi identidad profesional. Ahora soy oficialmente "${personaLabel}".\n\n` +
    "Este es el resultado de un profundo proceso de introspección de aproximadamente once minutos. " +
    "Los invito a pasar por mi perfil, dejar una reacción, y reflexionar sobre sus propias trayectorias.\n\n" +
    "Sigamos creciendo juntos. 🚀\n\n" +
    "(Este mail fue enviado a todos mis contactos porque, como ya saben, tengo bastante tiempo libre.)";
  // Borrador con todos en BCC: lo revisás y le das Enviar vos (a propósito — nada de envío masivo silencioso).
  openDraft({ bcc: list.join(","), subject, body });
  return { mode: "draft", count: list.length };
}

window.Mailer = { notifyEmergencyContact, announceNewProfile };
