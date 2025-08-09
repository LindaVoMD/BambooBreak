document.addEventListener("DOMContentLoaded", async () => {
  const form        = document.getElementById("fasting-form");
  const opTimeInput = document.getElementById("op-time");
  const submitBtn   = document.getElementById("submit-btn");
  const resultDiv   = document.getElementById("result");
  const resetBtn    = document.getElementById("reset-btn");
  const modal       = document.getElementById("modal");
  const modalTitle  = document.getElementById("modal-title");
  const modalBody   = document.getElementById("modal-body");
  const closeButton = document.querySelector(".close-button");

  let firstRun = true;
  let countdownInterval = null;

  const rulesUrl = "data/fastingrules.json";
  const imgPath  = "assets/";
  let rules = [];

  // Regeln laden
  try {
    const res = await fetch(rulesUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    rules = await res.json();
  } catch {
    resultDiv.innerHTML = "<strong>Fehler beim Laden der Regeln.</strong>";
    resultDiv.classList.remove("hidden");
    return;
  }

  // Modal-Funktion
  function showModal(title, body) {
    modalTitle.textContent = title;
    modalBody.innerHTML    = body;
    modal.classList.remove("hidden");
  }
  const hideModal = () => modal.classList.add("hidden");
  closeButton.addEventListener("click", hideModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) hideModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideModal(); });

  document.getElementById("age-hint").addEventListener("click", () => {
    showModal("Warum das Alter wichtig ist",
      "<p>Für Kinder unter 1 Jahr gelten angepasste Fastenregeln bezüglich säuglingsgerechter Nahrung.</p>"
    );
  });

  // Hilfsfunktionen
  function formatDateTime(d) {
    return d.toLocaleDateString("de-DE") + " " +
           String(d.getHours()).padStart(2,"0") + ":" +
           String(d.getMinutes()).padStart(2,"0") + " Uhr";
  }
  function formatRemainingLong(sec) {
    const h = Math.floor(sec/3600),
          m = Math.floor((sec%3600)/60),
          s = sec%60;
    return `${String(h).padStart(2,"0")} Std ${String(m).padStart(2,"0")} Min ${String(s).padStart(2,"0")} Sek`;
  }

  // Folgefristen-Infobox
  function getNextDeadlineHTML(ruleId, opTime) {
    const toDateString = (date) =>
      date.toLocaleDateString("de-DE") + ", " +
      String(date.getHours()).padStart(2, "0") + ":" +
      String(date.getMinutes()).padStart(2, "0") + " Uhr";

    const timeBeforeOp = (min) => toDateString(new Date(opTime.getTime() - min * 60000));

    let html = "<ul style='margin-top:0.7em'>";
    switch (ruleId) {
      case "normal_meal":
        html += `<li>Eine kleine Mahlzeit ist bis <b>${timeBeforeOp(240)}</b> (4 Stunden vor OP) möglich.</li>
                 <li>Klare Flüssigkeit ist bis <b>${timeBeforeOp(60)}</b> (1 Stunde vor OP) möglich.</li>`;
        break;
      case "light_meal":
        html += `<li>Klare Flüssigkeit ist bis <b>${timeBeforeOp(60)}</b> (1 Stunde vor OP) möglich.</li>`;
        break;
      case "infant_solid_and_milk":
        html += `<li>Kleine Portionen Beikost oder Fertig-/Kuhmilch sind bis <b>${timeBeforeOp(240)}</b> (4 Stunden vor OP) möglich.</li>
                 <li>Muttermilch ist bis <b>${timeBeforeOp(180)}</b> (3 Stunden vor OP) möglich.</li>
                 <li>Klare Flüssigkeit ist bis <b>${timeBeforeOp(60)}</b> (1 Stunde vor OP) möglich.</li>`;
        break;
      case "infant_light_and_milk":
        html += `<li>Muttermilch ist bis <b>${timeBeforeOp(180)}</b> (3 Stunden vor OP) möglich.</li>
                 <li>Klare Flüssigkeit ist bis <b>${timeBeforeOp(60)}</b> (1 Stunde vor OP) möglich.</li>`;
        break;
      case "infant_breastmilk":
        html += `<li>Klare Flüssigkeit ist bis <b>${timeBeforeOp(60)}</b> (1 Stunde vor OP) möglich.</li>`;
        break;
      default:
        html = "";
    }
    html += "</ul>";
    return html !== "<ul style='margin-top:0.7em'></ul>" ? html : "";
  }

  // Hauptfunktion: Regel ermitteln & Ausgabe aktualisieren
  function calculateAndDisplay(opTime, isInfant) {
    const now     = new Date();
    const diffMin = (opTime - now) / 60000;

    // Vergangenheit?
    if (diffMin < 0) {
      if (countdownInterval) clearInterval(countdownInterval);
      resultDiv.innerHTML = "<strong>Der eingegebene Zeitpunkt liegt in der Vergangenheit. Bitte Datum anpassen.</strong>";
      resultDiv.classList.remove("hidden");
      return;
    }

    // Regel auswählen
    let rule;
    if (diffMin > 1440) {
      rule = rules.find(r => r.id === "free_eating");
    } else {
      const list = rules
        .filter(r => isInfant ? r.infant_only : !r.infant_only)
        .filter(r => diffMin >= r.min && diffMin < r.max);
      rule = list.length ? list.reduce((a,b) => (b.min > a.min ? b : a)) : null;
    }

    // Keine passende Regel
    if (!rule) {
      if (countdownInterval) clearInterval(countdownInterval);
      resultDiv.innerHTML = "<strong>Keine passende Regel gefunden.</strong>";
      resultDiv.classList.remove("hidden");
      return;
    }

    // Threshold-Berechnung
    const thresholdTime = new Date(opTime.getTime() - rule.min * 60000);

    // HTML zusammenbauen
    let html = `<p><strong>${rule.phase}</strong></p>`;
    if (rule.min > 0 && !["free_eating","fasting","infant_fasting"].includes(rule.id)) {
      html += `<p><strong>Zuletzt bis:</strong> ${formatDateTime(thresholdTime)}</p>`;
    }

    html += `<div class="panda-container">`;
    const imgs = Array.isArray(rule.panda) ? rule.panda : [rule.panda];
    imgs.forEach(img => {
      html += `<img src="${imgPath}${img}" class="panda" alt="Panda" onerror="this.style.display='none'">`;
    });
    html += `</div>`;

    // Timer (sofern nötig)
    const showTimer = !["free_eating","fasting","infant_fasting"].includes(rule.id);
    if (showTimer) {
      html += `<p id="countdown-timer" style="font-weight:bold;margin:1em 0 0.7em 0"></p>`;
    }

    // Info-Box zur Regel (note)
    if (rule.note) {
      html += `<details class="regel-infobox" style="margin-top:1em;">
                 <summary>${rule.note.title}</summary>
                 <p>${rule.note.text}</p>
               </details>`;
    }

    // Folgefristen-Infobox
    const idsForFristen = ["normal_meal","light_meal","infant_solid_and_milk","infant_light_and_milk","infant_breastmilk"];
    if (idsForFristen.includes(rule.id)) {
      const fristenHTML = getNextDeadlineHTML(rule.id, opTime);
      if (fristenHTML) {
        html += `<details class="regel-infobox" style="margin-top:1em;">
                   <summary>Weitere Fristen im Überblick – Was gilt als nächstes?</b></summary>
                   ${fristenHTML}
                 </details>`;
      }
    }

    // Ausgabe ins DOM
    resultDiv.innerHTML = html;
    resultDiv.classList.remove("hidden");

    // Timer einbauen
    if (showTimer) {
      if (countdownInterval) clearInterval(countdownInterval);
      const countdownEl = document.getElementById("countdown-timer");
      function updateCountdown() {
        const rem = Math.floor((thresholdTime - new Date()) / 1000);
        if (rem > 0) {
          countdownEl.textContent = `Diese Regel gilt noch: ⏰ ${formatRemainingLong(rem)}`;
        } else {
          countdownEl.textContent = "Diese Regel ist jetzt beendet. Bitte erneut berechnen.";
          clearInterval(countdownInterval);
        }
      }
      updateCountdown();
      countdownInterval = setInterval(updateCountdown, 1000);
    } else if (countdownInterval) {
      clearInterval(countdownInterval);
    }
  }

  // Submit-Handler mit Validierung
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const raw = opTimeInput.value;
    if (!raw || raw.indexOf("T") === -1) {
      if (countdownInterval) clearInterval(countdownInterval);
      resultDiv.innerHTML = "<strong>Bitte Datum und Zeit vollständig eingeben.</strong>";
      resultDiv.classList.remove("hidden");
      return;
    }

    const opDate   = new Date(raw);
    const isInfant = document.querySelector("input[name='infant']:checked").value === "yes";

    calculateAndDisplay(opDate, isInfant);

    if (firstRun) {
      submitBtn.textContent = "Erneut berechnen";
      firstRun = false;
    }
  });

  // Reset-Handler
  resetBtn.addEventListener("click", () => {
    opTimeInput.value = "";
    submitBtn.textContent = "Berechnen";
    firstRun = true;
    resultDiv.innerHTML = "";
    resultDiv.classList.add("hidden");
    if (countdownInterval) clearInterval(countdownInterval);
  });
});

