/**
 * URL fija del karaoke: el servidor de karaoke (local) publica aquí su URL de
 * túnel (POST con secreto) y el streamer usa SIEMPRE esta ruta en su OBS:
 *
 *   GET /api/public/karaoke          → { url } (informativo)
 *   GET /karaoke/overlay?t=TOKEN     → 302 al overlay actual del túnel
 *
 * El secreto va en KARAOKE_PUBLISH_SECRET (env de Render y del karaoke).
 * Estado en memoria: si Render reinicia, el karaoke re-publica cada 10 min.
 */
const express = require("express");

const router = express.Router();
let currentUrl = null; // p.ej. https://xxxx.trycloudflare.com
let updatedAt = null;

router.get("/api/public/karaoke", (req, res) => {
  res.json({ url: currentUrl, updatedAt });
});

router.post("/api/public/karaoke", (req, res) => {
  const { secret, url } = req.body || {};
  const expected = process.env.KARAOKE_PUBLISH_SECRET;
  if (!expected || secret !== expected) {
    return res.status(401).json({ error: "secret inválido" });
  }
  if (typeof url !== "string" || !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(url)) {
    return res.status(400).json({ error: "url inválida" });
  }
  currentUrl = url.replace(/\/$/, "");
  updatedAt = new Date().toISOString();
  res.json({ ok: true });
});

// El OBS del streamer carga SIEMPRE esta URL; redirige al túnel del momento.
// Reenvía TODA la query string (t=TOKEN, ch=canal, mute=1…) — si no, el overlay
// pierde el ?ch= y el servidor no sabe de qué canal es.
router.get("/karaoke/overlay", (req, res) => {
  if (!currentUrl) {
    return res
      .status(503)
      .send("<h1>Karaoke no conectado</h1><p>El servidor de karaoke no ha publicado su URL todavía (¿está arrancado?).</p>");
  }
  const qs = new URLSearchParams(req.query).toString();
  res.redirect(302, `${currentUrl}/overlay${qs ? "?" + qs : ""}`);
});

module.exports = router;
