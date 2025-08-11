/* OP-Termin – Essensphasen (JSON-getrieben mit Panda-PNGs)
   Änderungen:
   - Kein Auto-Prefill/Render beim Laden
   - "Beispiel setzen" entfernt
   - Reset-Button
   - Zusatzanzeige >24h: "X T Y h Z min"
*/
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- Fallback-Config (falls fetch fehlschlägt) -------------------
  const DEFAULT_CONFIG = {
    infoTexts: {
      lightMeal: {
        title: "Was ist eine leichte Mahlzeit?",
        items: [
          "z. B. 1 Toast mit Marmelade, 1 Zwieback oder 1 Becher Milch/ Kakao"
        ]
      },
      clearFluids: {
        title: "Was ist eine klare Flüssigkeit?",
        items: [
          "Wasser, ungesüßter Tee",
          "klarer Fruchtsaft ohne Fruchtfleisch"
        ]
      },
      smallBeikost: {
        title: "Was ist eine kleine Portion Beikost?",
        items: [
          "ca. 1/2 Standardportion Brei oder Fläschchen"
        ]
      }
    },
    groups: {
      gte1: {
        cutoffs: { free: 8, normal: 6, light: 4, clear: 1 },
        windows: [
          { min: 8, max: null, phases: ["free", "normal", "light", "clear"] },
          { min: 6, max: 8, phases: ["normal", "light", "clear"] },
          { min: 4, max: 6, phases: ["light", "clear"] },
          { min: 1, max: 4, phases: ["clear"] },
          { min: 0, max: 1, phases: ["fasting"] }
        ],
        phaseDefs: {
          free:   { title: "Freies Essen möglich",       imageSrc: "assets/panda_eats.png",   imageAlt: "Panda isst" },
          normal: { title: "Normale Mahlzeit möglich",   imageSrc: "assets/panda_eats.png",   imageAlt: "Panda isst" },
          light:  { title: "Leichte Mahlzeit möglich",   imageSrc: "assets/panda_apple.png",  imageAlt: "Panda mit Apfel", infoKey: "lightMeal" },
          clear:  { title: "Klare Flüssigkeit möglich",  imageSrc: "assets/panda_drinks.png", imageAlt: "Panda trinkt",    infoKey: "clearFluids" },
          fasting:{ title: "Bitte nüchtern bleiben",     imageSrc: "assets/panda_fasting.png",imageAlt: "Panda fastet",    noTimer: true }
        }
      },
      lt1: {
        cutoffs: { free: 8, beikost: 6, smallBeikost: 4, breastmilk: 3, clear: 1 },
        windows: [
          { min: 8, max: null, phases: ["free", "beikost", "smallBeikost", "breastmilk", "clear"] },
          { min: 6, max: 8, phases: ["beikost", "smallBeikost", "breastmilk", "clear"] },
          { min: 4, max: 6, phases: ["smallBeikost", "breastmilk", "clear"] },
          { min: 3, max: 4, phases: ["breastmilk", "clear"] },
          { min: 1, max: 3, phases: ["clear"] },
          { min: 0, max: 1, phases: ["fasting"] }
        ],
        phaseDefs: {
          free:         { title: "Freies Essen möglich",                   imageSrc: "assets/panda_eats.png",     imageAlt: "Panda isst" },
          beikost:      { title: "Beikost & Milch möglich",                imageSrc: "assets/panda_porridge.png", imageAlt: "Panda mit Brei" },
          smallBeikost: { title: "Kleine Portion Beikost & Milch möglich", imageSrc: "assets/panda_porridge.png", imageAlt: "Panda mit Brei", infoKey: "smallBeikost" },
          breastmilk:   { title: "Muttermilch möglich",                    imageSrc: "assets/panda_nursed.png",   imageAlt: "Panda wird gestillt" },
          clear:        { title: "Klare Flüssigkeit möglich",              imageSrc: "assets/panda_drinks.png",   imageAlt: "Panda trinkt", infoKey: "clearFluids" },
          fasting:      { title: "Bitte nüchtern bleiben",                 imageSrc: "assets/panda_fasting.png",  imageAlt: "Panda fastet", noTimer: true }
        }
      }
    }
  };

  // ---------- Utils -------------------------------------------------------
  const pad = (n) => n.toString().padStart(2, "0");
  const toHM = (d) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  function parseLocalDateTime(value) {
    if (!value) return null;
    const [date, time] = value.split("T");
    if (!date || !time) return null;
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  function hoursUntil(opDate) {
    return (opDate.getTime() - Date.now()) / 36e5;
  }
  function deadlineFor(opDate, hoursBefore) {
    return new Date(opDate.getTime() - hoursBefore * 3600 * 1000);
  }
  function fmtClock(msLeft) {
    if (msLeft < 0) msLeft = 0;
    const s = Math.floor(msLeft / 1000);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  }
  function fmtDHM(msLeft) {
    if (msLeft < 0) msLeft = 0;
    const totalMin = Math.floor(msLeft / 60000);
    const days = Math.floor(totalMin / (60*24));
    const hours = Math.floor((totalMin % (60*24)) / 60);
    const mins = totalMin % 60;
    return `${days} T ${hours} h ${mins} min`;
  }

  // ---------- DOM ---------------------------------------------------------
  const opInput = $("#opDateTime");
  const ageRadios = $$('input[name="ageGroup"]');
  const calcBtn = $("#calcBtn");
  const resetBtn = $("#resetBtn");
  const validation = $("#validation");
  const list = $("#phase-list");

  // Modal
  const modal = $("#info-modal");
  const modalTitle = $("#modal-title");
  const modalBody = $("#modal-body");
  function showModalFromConfig(key) {
    const info = CONFIG.infoTexts?.[key];
    if (!info) return;
    modalTitle.textContent = info.title || "Info";
    const ul = document.createElement("ul");
    ul.className = "bullet";
    (info.items || []).forEach(t => {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });
    modalBody.innerHTML = "";
    modalBody.appendChild(ul);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function hideModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal__backdrop")) hideModal();
  });
  modal.querySelector(".modal__close").addEventListener("click", hideModal);
  $$("[data-close]", modal).forEach(el => el.addEventListener("click", hideModal));

  // ---------- Rendering ----------------------------------------------------
  let TICK_HANDLE = null;
  let CONFIG = null;

  function normalizeMax(v) {
    return (v === null || typeof v === "undefined") ? Number.POSITIVE_INFINITY : v;
  }

  function createPhaseCard({ imageSrc, imageAlt, title, until, cutoffLabel, infoKey, noTimer }) {
    const card = document.createElement("article");
    card.className = "phase-card state-allowed";

    const media = document.createElement("div");
    media.className = "phase-card__media";

    const img = document.createElement("img");
    img.className = "phase-card__img";
    img.src = imageSrc || "";
    img.alt = imageAlt || "";
    img.decoding = "async";
    img.loading = "lazy";
    media.appendChild(img);

    const content = document.createElement("div");
    content.className = "phase-card__content";

    const h = document.createElement("h3");
    h.className = "phase-card__title";
    h.textContent = title;
    content.appendChild(h);

    if (!noTimer && until) {
      const meta = document.createElement("div");
      meta.className = "phase-card__meta";

      const timer = document.createElement("div");
      timer.className = "timer";
      timer.dataset.deadline = until.getTime().toString();
      timer.setAttribute("aria-live", "polite");

      const timerAlt = document.createElement("div");
      timerAlt.className = "timer-alt hidden"; // wird bei >24h angezeigt

      const when = document.createElement("div");
      when.className = "until";
      when.textContent = `bis ${toHM(until)} (${cutoffLabel})`;

      meta.appendChild(timer);
      meta.appendChild(when);
      meta.appendChild(timerAlt);

      if (infoKey && CONFIG.infoTexts?.[infoKey]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "info-btn";
        btn.textContent = CONFIG.infoTexts[infoKey].title || "Info";
        btn.addEventListener("click", () => showModalFromConfig(infoKey));
        meta.appendChild(btn);
      }

      content.appendChild(meta);
    } else {
      const note = document.createElement("p");
      note.className = "phase-card__note";
      note.textContent = "Nur Wasser zum Spülen des Mundes, bitte nichts trinken/essen.";
      content.appendChild(note);
    }

    card.appendChild(media);
    card.appendChild(content);
    return card;
  }

  function render() {
    if (!CONFIG) return;
    validation.textContent = "";
    list.innerHTML = "";

    const ageGroup = ageRadios.find(r => r.checked)?.value || "gte1";
    const group = CONFIG.groups?.[ageGroup];
    if (!group) { validation.textContent = "Konfiguration für die gewählte Altersgruppe fehlt."; return; }

    const opDate = parseLocalDateTime(opInput.value);
    if (!opDate) { validation.textContent = "Bitte OP-Termin wählen."; return; }

    const deltaH = hoursUntil(opDate);
    if (deltaH < 0) { validation.textContent = "Der OP-Termin liegt in der Vergangenheit."; return; }

    const win = (group.windows || []).find(w => deltaH >= w.min && deltaH < normalizeMax(w.max));
    if (!win) { validation.textContent = "Kein passendes Zeitfenster gefunden."; return; }

    (win.phases || []).forEach(key => {
      const def = group.phaseDefs?.[key];
      if (!def) return;

      let until = null, cutoffLabel = "";
      if (!def.noTimer) {
        const cutoffH = group.cutoffs?.[key];
        if (typeof cutoffH === "number") {
          until = deadlineFor(opDate, cutoffH);
          cutoffLabel = `✕ ${cutoffH} h vor OP`;
        }
      }

      const card = createPhaseCard({
        imageSrc: def.imageSrc,
        imageAlt: def.imageAlt,
        title: def.title,
        until,
        cutoffLabel,
        infoKey: def.infoKey,
        noTimer: !!def.noTimer
      });
      list.appendChild(card);
    });

    startTicking();
  }

  function startTicking() { stopTicking(); tick(); TICK_HANDLE = setInterval(tick, 1000); }
  function stopTicking() { if (TICK_HANDLE) clearInterval(TICK_HANDLE); TICK_HANDLE = null; }
  function tick() {
    const now = Date.now();
    const timers = $$(".timer", list);
    timers.forEach(el => {
      const deadline = Number(el.dataset.deadline || "0");
      const msLeft = deadline - now;
      el.textContent = fmtClock(msLeft);

      const card = el.closest(".phase-card");
      const alt = card.querySelector(".timer-alt");

      // Zusatzanzeige in Tagen, Stunden, Minuten falls > 24h
      if (alt) {
        if (msLeft >= 24 * 3600 * 1000) {
          alt.textContent = fmtDHM(msLeft);
          alt.classList.remove("hidden");
        } else {
          alt.classList.add("hidden");
        }
      }

      card.classList.remove("state-ending-soon", "state-expired", "state-allowed");
      if (msLeft <= 0) card.classList.add("state-expired");
      else if (msLeft <= 30 * 60 * 1000) card.classList.add("state-ending-soon");
      else card.classList.add("state-allowed");
    });
  }

  // ---------- Bootstrapping ----------------------------------------------
  async function loadConfig() {
    try {
      const res = await fetch("data/fastingrules.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.groups || !json.infoTexts) throw new Error("Ungültiges JSON-Schema");
      return json;
    } catch (e) {
      console.warn("[calculator] Fallback auf DEFAULT_CONFIG:", e?.message || e);
      return DEFAULT_CONFIG;
    }
  }

  // Events
  const onAnyChange = () => render();
  $$('input[name="ageGroup"]').forEach(r => r.addEventListener("change", onAnyChange));
  $("#opDateTime").addEventListener("change", onAnyChange);
  $("#calcBtn").addEventListener("click", (e) => { e.preventDefault(); render(); });
  $("#resetBtn").addEventListener("click", (e) => {
    e.preventDefault();
    stopTicking();
    $("#opDateTime").value = "";
    $("#phase-list").innerHTML = "";
    $("#validation").textContent = "";
  });
  window.addEventListener("beforeunload", stopTicking);

  (async function init() {
    CONFIG = await loadConfig();
    // Kein Auto-Render / kein Prefill: Seite bleibt leer bis zur ersten Eingabe
  })();
})();
