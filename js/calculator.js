/* calculator.js – OP-Termin / Essensphasen (modular, JSON-getrieben)
   - Lädt Regeln aus data/fastingrules.json
   - Titelzeile: "Phasen-Titel" + ?-Badge (öffnet Modal)
   - Timer: animierte SVG-Uhr + verbleibende Zeit
   - Detailzeile: "bis HH:MM Uhr am DD.MM.YY (bis X Stunde(n) vor OP)"
*/

(function () {
  // ---------- DOM Helpers ----------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- DOM Elements ----------
  const opInput     = $("#opDateTime");
  const ageRadios   = $$('input[name="ageGroup"]');
  const calcBtn     = $("#calcBtn");
  const resetBtn    = $("#resetBtn");
  const validation  = $("#validation");
  const list        = $("#phase-list");

  // Modal
  const modal       = $("#info-modal");
  const modalTitle  = $("#modal-title");
  const modalBody   = $("#modal-body");

  // ---------- State ----------
  let RULES = null;
  let tickHandle = null;

  // ---------- Utils ----------
  const pad = (n) => String(n).padStart(2, "0");
  const toHM = (d) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const normalizeMax = (v) =>
    (v === null || typeof v === "undefined") ? Number.POSITIVE_INFINITY : v;

  function parseLocalDateTime(value) {
    if (!value) return null;
    const [date, time] = value.split("T");
    if (!date || !time) return null;
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm]  = time.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  const hoursUntil  = (opDate) => (opDate.getTime() - Date.now()) / 36e5;
  const deadlineFor = (opDate, hoursBefore) => new Date(opDate.getTime() - hoursBefore * 3600 * 1000);

  // Humanisiertes Timerformat (kein "und")
  function fmtHuman(msLeft) {
    if (msLeft < 0) msLeft = 0;
    const totalMin = Math.floor(msLeft / 60000);
    const days  = Math.floor(totalMin / (60 * 24));
    const hours = Math.floor((totalMin % (60 * 24)) / 60);
    const mins  = totalMin % 60;
    const dd = pad(days);
    const hh = pad(hours);
    const mm = pad(mins);
    return days > 0
      ? `${dd} Tage ${hh} Stunden ${mm} Minuten`
      : `${hh} Stunden ${mm} Minuten`;
  }
  function fmtDateDEshort(d) {
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth()+1);
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}.${mm}.${yy}`;
  }
  function plural(n, s, p) { return n === 1 ? s : p; }

  // ---------- Modal ----------
  function openModalFromInfoKey(key) {
    const info = RULES?.infoTexts?.[key];
    if (!info) return;
    modalTitle.textContent = info.title || "Info";
    modalBody.innerHTML = "";
    const ul = document.createElement("ul");
    ul.className = "bullet";
    (info.items || []).forEach(t => {
      const li = document.createElement("li");
      li.textContent = t;
      ul.appendChild(li);
    });
    modalBody.appendChild(ul);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function showModal(title, html) {
    modalTitle.textContent = title || "Info";
    modalBody.innerHTML = html || "";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  modal.addEventListener("click", e => {
    if (e.target.classList.contains("modal__backdrop")) closeModal();
  });
  modal.querySelector(".modal__close")?.addEventListener("click", closeModal);
  $$("[data-close]", modal).forEach(el => el.addEventListener("click", closeModal));

  // ---------- Rendering ----------
  function createPhaseCard({ imageSrc, imageAlt, title, until, cutoffH, infoKey, noTimer }) {
    const card = document.createElement("article");
    card.className = "phase-card state-allowed";

    // Panda
    const media = document.createElement("div");
    media.className = "phase-card__media";
    const img = document.createElement("img");
    img.className = "phase-card__img";
    img.src = imageSrc || "";
    img.alt = imageAlt || "";
    img.loading = "lazy";
    img.decoding = "async";
    media.appendChild(img);

    // Content
    const content = document.createElement("div");
    content.className = "phase-card__content";

    // Titelzeile: Titel + ?-Badge
    const titleRow = document.createElement("div");
    titleRow.className = "phase-card__title-row";

    const h = document.createElement("h3");
    h.className = "phase-card__title";
    h.textContent = title;
    titleRow.appendChild(h);

    if (infoKey && RULES?.infoTexts?.[infoKey]) {
      const infoBtn = document.createElement("button");
      infoBtn.type = "button";
      infoBtn.className = "info-badge info-badge--sm";
      infoBtn.setAttribute("aria-label", RULES.infoTexts[infoKey].title || "Info");
      infoBtn.setAttribute("title", RULES.infoTexts[infoKey].title || "Info");
      infoBtn.textContent = "?";
      infoBtn.addEventListener("click", () => openModalFromInfoKey(infoKey));
      titleRow.appendChild(infoBtn);
    }
    content.appendChild(titleRow);

    // Meta (Timer + Detail)
    if (!noTimer && until) {
      const meta = document.createElement("div");
      meta.className = "phase-card__meta";

      // Timer-Badge mit animierter SVG-Uhr
      const timer = document.createElement("div");
      timer.className = "timer";
      timer.dataset.deadline = String(until.getTime());
      timer.setAttribute("aria-live", "polite");
      timer.innerHTML = `
        <svg class="clock" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
             fill="none" stroke="#006677" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="12" x2="12" y2="6"></line>                 <!-- Minutenzeiger -->
          <line class="seconds-hand" x1="12" y1="12" x2="16" y2="12"></line> <!-- Sekundenzeiger -->
        </svg>
        <span class="timer-text"></span>
      `;

      const detail = document.createElement("div");
      detail.className = "timer-detail";
      const cutoffText = `${cutoffH} ${plural(cutoffH, "Stunde", "Stunden")}`;
      detail.textContent = `bis ${toHM(until)} Uhr am ${fmtDateDEshort(until)} (bis ${cutoffText} vor OP)`;

      meta.append(timer, detail);
      content.appendChild(meta);
    }

    card.append(media, content);
    return card;
  }

  function render() {
    if (!RULES) {
      validation.textContent = "Regelwerk konnte nicht geladen werden.";
      list.innerHTML = "";
      return;
    }

    validation.textContent = "";
    list.innerHTML = "";

    const ageGroup = ageRadios.find(r => r.checked)?.value || "gte1";
    const group = RULES.groups?.[ageGroup];
    if (!group) { validation.textContent = "Konfiguration für die gewählte Altersgruppe fehlt."; return; }

    const opDate = parseLocalDateTime(opInput.value);
    if (!opDate) { validation.textContent = "Bitte OP-Termin wählen."; return; }

    const deltaH = hoursUntil(opDate);
    if (deltaH < 0) { validation.textContent = "Der OP-Termin liegt in der Vergangenheit."; return; }

    const win = (group.windows || []).find(w => deltaH >= w.min && deltaH < normalizeMax(w.max));
    if (!win) { validation.textContent = "Kein passendes Zeitfenster gefunden."; return; }

    (win.phases || []).forEach(code => {
      const def = group.phaseDefs?.[code];
      if (!def) return;

      let until = null, cutoffH = null;
      if (!def.noTimer) {
        cutoffH = group.cutoffs?.[code];
        if (typeof cutoffH === "number") until = deadlineFor(opDate, cutoffH);
      }

      const card = createPhaseCard({
        imageSrc: def.imageSrc,
        imageAlt: def.imageAlt,
        title:    def.title,
        until,
        cutoffH,
        infoKey:  def.infoKey,
        noTimer:  !!def.noTimer
      });
      list.appendChild(card);
    });

    startTicking();
  }

  // ---------- Ticker ----------
  function tick() {
    const now = Date.now();
    $$(".timer", list).forEach(el => {
      const deadline = Number(el.dataset.deadline || "0");
      const msLeft = deadline - now;

      const span = el.querySelector(".timer-text");
      if (span) span.textContent = fmtHuman(msLeft);
      else      el.textContent   = fmtHuman(msLeft);

      // Zustandsfarben
      const card = el.closest(".phase-card");
      card.classList.remove("state-ending-soon", "state-expired", "state-allowed");
      if (msLeft <= 0) card.classList.add("state-expired");
      else if (msLeft <= 30 * 60 * 1000) card.classList.add("state-ending-soon");
      else card.classList.add("state-allowed");
    });
  }
  function startTicking(){ stopTicking(); tick(); tickHandle = setInterval(tick, 1000); }
  function stopTicking(){ if (tickHandle) clearInterval(tickHandle); tickHandle = null; }

  // ---------- Events ----------
  const onAnyChange = () => render();
  ageRadios.forEach(r => r.addEventListener("change", onAnyChange));
  opInput.addEventListener("change", onAnyChange);
  calcBtn.addEventListener("click", (e) => { e.preventDefault(); render(); });
  resetBtn.addEventListener("click", (e) => {
    e.preventDefault();
    stopTicking();
    opInput.value = "";
    list.innerHTML = "";
    validation.textContent = "";
  });
  window.addEventListener("beforeunload", stopTicking);

  // Alters-Info (Badge mit "?")
  const ageHintBtn = document.getElementById("age-hint");
  if (ageHintBtn) {
    ageHintBtn.addEventListener("click", () => {
      showModal(
        "Warum das Alter wichtig ist",
        "<ul class='bullet'><li>Für Kinder <strong>unter 1 Jahr</strong> gelten angepasste Fastenregeln.</li><li>Daher unterscheiden wir zwischen ≥ 1 Jahr und &lt; 1 Jahr.</li></ul>"
      );
    });
  }

  // ---------- Init (Regeln laden) ----------
  document.addEventListener("DOMContentLoaded", async () => {
    const rulesUrl = "data/fastingrules.json";
    try {
      const res = await fetch(rulesUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const txt = await res.text();
      RULES = JSON.parse(txt.replace(/^\uFEFF/, "")); // BOM-sicher

      if (!RULES.groups || !RULES.infoTexts) throw new Error("Ungültiges Regelwerk");
      validation.textContent = "";
    } catch (err) {
      console.error("Regeln konnten nicht geladen werden:", err);
      validation.textContent = "Regelwerk konnte nicht geladen werden.";
      RULES = null;
      return;
    }
  });
})();
