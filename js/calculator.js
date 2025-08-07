document.addEventListener("DOMContentLoaded", async () => {
  // Element-Referenzen
  const form = document.getElementById("fasting-form");
  const opTimeInput = document.getElementById("op-time");
  const submitBtn = document.getElementById("submit-btn");
  const resultDiv = document.getElementById("result");
  const resetBtn = document.getElementById("reset-btn");
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const closeButton = document.querySelector(".close-button");

  // Button nur aktiv, wenn Termin gesetzt ist
  opTimeInput.addEventListener("input", () => {
    submitBtn.disabled = !opTimeInput.value;
  });

  let firstRun = true;
  const rulesUrl = "data/fastingrules.json";
  const imgPath = "assets/";
  let rules = [];
  let countdownInterval = null;

  // Regeln laden (JSON)
  try {
    const res = await fetch(rulesUrl);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    rules = await res.json();
  } catch (err) {
    resultDiv.innerHTML = "<strong>Fehler beim Laden der Regeln.</strong>";
    resultDiv.classList.remove("hidden");
    return;
  }

  // Modal-Funktionen
  function showModal(title, body) {
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modal.classList.remove("hidden");
  }
  closeButton.addEventListener("click", () => modal.classList.add("hidden"));
  document.getElementById("age-hint").addEventListener("click", () => {
    showModal("Warum das Alter wichtig ist",
      "<p>Für Kinder unter 1 Jahr gelten angepasste Fastenregeln bezüglich säuglingsgerechter Nahrung.</p>"
    );
  });

  // Hilfsfunktionen für Anzeige
  function formatDateTime(date) {
    return date.toLocaleDateString('de-DE') + ' ' +
      String(date.getHours()).padStart(2, "0") + ":" +
      String(date.getMinutes()).padStart(2, "0") + " Uhr";
  }
  function formatRemainingLong(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2,"0")} Std ${String(m).padStart(2,"0")} Min ${String(s).padStart(2,"0")} Sek`;
  }

  // Infobox für nächste Fristen
  function getNextDeadlineHTML(ruleId, opTime) {
    const toDateString = (date) =>
      date.toLocaleDateString('de-DE') + ', ' +
      String(date.getHours()).padStart(2, "0") + ':' +
      String(date.getMinutes()).padStart(2, "0") + ' Uhr';

    // n Minuten vor OP
    const timeBeforeOp = (min) => {
      const d = new Date(opTime.getTime() - min * 60000);
      return toDateString(d);
    };

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
      case "infant_clear_liquids":
        html += `<li>Klare Flüssigkeit ist bis <b>${timeBeforeOp(60)}</b> (1 Stunde vor OP) möglich.</li>`;
        break;
      default:
        html = "";
    }
    html += "</ul>";
    return html !== "<ul style='margin-top:0.7em'></ul>" ? html : "";
  }

  // Hauptfunktion: Regel finden & Ausgabe anzeigen
  function calculateAndDisplay(opTime, isInfant) {
    const now = new Date();
    const diffMin = (opTime - now) / 60000;

    // Aktuelle Regel bestimmen
    let rule;
    if (diffMin > 1440) {
      rule = rules.find(r => r.id === "free_eating");
    } else {
      const list = rules
        .filter(r => isInfant ? r.infant_only : !r.infant_only)
        .filter(r => diffMin >= r.min && diffMin < r.max);
      rule = list.length ? list.reduce((a, b) => b.min > a.min ? b : a) : null;
    }
    if (!rule) {
      resultDiv.innerHTML = "<strong>Der Termin liegt in der Vergangenheit. Bitte Datum und Zeit anpassen.</strong>";
      resultDiv.classList.remove("hidden");
      return;
    }

    // Bis wann gilt die Regel?
    const thresholdTime = new Date(opTime.getTime() - rule.min * 60000);

    // HTML-Ausgabe zusammenbauen
    let html = `<p><strong>${rule.phase}</strong></p>`;
    if (rule.min > 0 && !["free_eating", "fasting", "infant_fasting"].includes(rule.id)) {
      html += `<p><strong>Zuletzt bis:</strong> ${formatDateTime(thresholdTime)}</p>`;
    }

    // Panda-Grafiken
    html += `<div class="panda-container">`;
    const imgs = Array.isArray(rule.panda) ? rule.panda : [rule.panda];
    imgs.forEach(img => {
      html += `<img src="${imgPath}${img}" class="panda" alt="Panda" onerror="this.style.display='none'"/>`;
    });
    html += `</div>`;

    // Timer direkt unter Panda-Bildern (nur bei passenden Regeln)
    let showTimer = !["free_eating", "fasting", "infant_fasting"].includes(rule.id);
    if (showTimer) {
      html += `<p id="countdown-timer" style="font-weight:bold;margin:1em 0 0.7em 0"></p>`;
    }

    // Infobox zur Regel (falls vorhanden)
    if (rule.note) {
      html += `<details class="regel-infobox" style="margin-top:1em;">
                <summary>${rule.note.title}</summary>
                <p>${rule.note.text}</p>
              </details>`;
    }

    // Fristen-Infobox: gleiche Optik, nur bei passenden Regeln
    let showFristen = !["free_eating", "fasting", "infant_fasting"].includes(rule.id);
    const nextFristenHTML = showFristen ? getNextDeadlineHTML(rule.id, opTime) : "";
    if (showFristen && nextFristenHTML) {
      html += `<details class="regel-infobox" style="margin-top:1em;">
        <summary><b>Weitere Fristen im Überblick – Was gilt als nächstes?</b></summary>
        ${nextFristenHTML}
      </details>`;
    }

    // HTML in Ergebnisfeld schreiben
    resultDiv.innerHTML = html;
    resultDiv.classList.remove("hidden");

    // Countdown-Timer aktualisieren
    if (showTimer) {
      if (countdownInterval) clearInterval(countdownInterval);
      const countdownEl = document.getElementById("countdown-timer");
      function updateCountdown() {
        const now2 = new Date();
        const remSec = Math.floor((thresholdTime - now2) / 1000);
        if (remSec > 0) {
          countdownEl.textContent = `Diese Regel gilt noch: ⏰ ${formatRemainingLong(remSec)}`;
        } else {
          countdownEl.textContent = "Diese Regel ist jetzt beendet. Bitte erneut berechnen.";
          clearInterval(countdownInterval);
        }
      }
      updateCountdown();
      countdownInterval = setInterval(updateCountdown, 1000);
    } else {
      if (countdownInterval) clearInterval(countdownInterval);
    }
  }

  // Form-Submit: Berechnen
  form.addEventListener("submit", e => {
    e.preventDefault();
    const raw = opTimeInput.value;
    if (!raw || raw.indexOf("T") === -1) {
      resultDiv.innerHTML = "<strong>Bitte Datum und Zeit angeben.</strong>";
      resultDiv.classList.remove("hidden");
      return;
    }
    const opDate = new Date(raw);
    const isInfant = document.querySelector("input[name='infant']:checked").value === "yes";

    calculateAndDisplay(opDate, isInfant);

    if (firstRun) {
      submitBtn.textContent = "Erneut berechnen";
      firstRun = false;
    }
  });

  // Zurücksetzen
  resetBtn.addEventListener("click", () => {
    opTimeInput.value = "";
    submitBtn.disabled = true;
    submitBtn.textContent = "Berechnen";
    firstRun = true;
    resultDiv.innerHTML = "";
    resultDiv.classList.add("hidden");
    modal.classList.add("hidden");
    if (countdownInterval) clearInterval(countdownInterval);
  });
});
