document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("fasting-form");
  const opTimeInput = document.getElementById("op-time");
  const submitBtn = document.getElementById("submit-btn");
  const resultDiv = document.getElementById("result");
  const resetBtn = document.getElementById("reset-btn"); // Korrekte ID!
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const closeButton = document.querySelector(".close-button");

  // Submit-Button nur aktivieren, wenn OP-Zeit gesetzt ist
  opTimeInput.addEventListener("input", () => {
    submitBtn.disabled = !opTimeInput.value;
  });

  let firstRun = true;
  const rulesUrl = "data/fastingrules.json";
  const imgPath = "assets/";
  let rules = [];
  let countdownInterval = null;

  // Regeln laden
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

  // Hilfsfunktionen
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

  // Kernfunktion: Regel finden & Countdown anzeigen
  function calculateAndDisplay(opTime, isInfant) {
    const now = new Date();
    const diffMin = (opTime - now) / 60000;

    // Passende Regel wählen
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

    // Zeitpunkt, bis zu dem die Regel gilt
    const thresholdTime = new Date(opTime.getTime() - rule.min * 60000);

    // Ausgabe-HTML zusammenbauen
    let html = `<p><strong>${rule.phase}</strong></p>`;
    if (rule.min > 0 && !["free_eating", "fasting", "infant_fasting"].includes(rule.id)) {
      html += `<p><strong>Zuletzt bis:</strong> ${formatDateTime(thresholdTime)}</p>`;
    }
    html += `<div class="panda-container">`;
    const imgs = Array.isArray(rule.panda) ? rule.panda : [rule.panda];
    imgs.forEach(img => {
      html += `<img src="${imgPath}${img}" class="panda" alt="Panda" onerror="this.style.display='none'"/>`;
    });
    html += `</div>`;
    if (rule.note) {
      html += `<details><summary>${rule.note.title}</summary><p>${rule.note.text}</p></details>`;
    }

    // Countdown initialisieren
    if (countdownInterval) clearInterval(countdownInterval);
    resultDiv.innerHTML = html;
    resultDiv.classList.remove("hidden");
    const countdownEl = document.createElement("p");
    countdownEl.style.fontWeight = "bold";
    resultDiv.appendChild(countdownEl);

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
  }

  // Submit-Handler mit Validierung
  form.addEventListener("submit", e => {
    e.preventDefault();
    const raw = opTimeInput.value;
    // Datum/Zeit-Validierung
    if (!raw || raw.indexOf("T") === -1) {
      resultDiv.innerHTML = "<strong>Bitte Datum und Zeit angeben.</strong>";
      resultDiv.classList.remove("hidden");
      return;
    }
    const opDate = new Date(raw);
    const isInfant = document.querySelector("input[name='infant']:checked").value === "yes";

    calculateAndDisplay(opDate, isInfant);

    // Button-Text nach erstem Klick ändern
    if (firstRun) {
      submitBtn.textContent = "Erneut berechnen";
      firstRun = false;
    }
  });

  // Reset-Handler
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
