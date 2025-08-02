document.addEventListener("DOMContentLoaded", async () => {
  const form        = document.getElementById("fasting-form");
  const opTimeInput = document.getElementById("op-time");
  const submitBtn   = document.getElementById("submit-btn");
  const resultDiv   = document.getElementById("result");
  const resetBtn    = document.getElementById("reset-btn");  // stimmt nun mit deiner HTML überein
  const modal       = document.getElementById("modal");
  const modalTitle  = document.getElementById("modal-title");
  const modalBody   = document.getElementById("modal-body");
  const closeButton = document.querySelector(".close-button");

  // Flag, um den Button-Text nur einmal zu ändern
  let firstRun = true;
  let countdownInterval = null;

  // Regeln einlesen
  const rulesUrl = "data/fastingrules.json";
  const imgPath  = "assets/";
  let rules = [];
  try {
    const res = await fetch(rulesUrl);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    rules = await res.json();
  } catch (err) {
    resultDiv.innerHTML = "<strong>Fehler beim Laden der Regeln.</strong>";
    resultDiv.classList.remove("hidden");
    return;
  }

  // Modal-Helpers
  function showModal(title, body) {
    modalTitle.textContent = title;
    modalBody.innerHTML    = body;
    modal.classList.remove("hidden");
  }
  closeButton.addEventListener("click", () => modal.classList.add("hidden"));
  document.getElementById("age-hint").addEventListener("click", () => {
    showModal("Warum das Alter wichtig ist",
      "<p>Für Kinder unter 1 Jahr gelten angepasste Fastenregeln bezüglich säuglingsgerechter Nahrung.</p>"
    );
  });

  // Format-Hilfen
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

  // Kernauswertung
  function calculateAndDisplay(opTime, isInfant) {
    const now     = new Date();
    const diffMin = (opTime - now) / 60000;

    // Regel auswählen
    let rule;
    if (diffMin > 1440) {
      rule = rules.find(r => r.id === "free_eating");
    } else {
      const list = rules
        .filter(r => isInfant ? r.infant_only : !r.infant_only)
        .filter(r => diffMin >= r.min && diffMin < r.max);
      rule = list.length ? list.reduce((a,b) => b.min > a.min ? b : a) : null;
    }

    // Keine passende Regel?
    if (!rule) {
      resultDiv.innerHTML = "<strong>Keine passende Regel gefunden.</strong>";
      resultDiv.classList.remove("hidden");
      return;
    }

    // Zeitpunkt, bis zu dem die Phase gilt
    const threshold = new Date(opTime.getTime() - rule.min * 60000);

    // HTML-Ausgabe
    let html = `<p><strong>${rule.phase}</strong></p>`;
    if (rule.min > 0 && !["free_eating","fasting","infant_fasting"].includes(rule.id)) {
      html += `<p><strong>Zuletzt bis:</strong> ${formatDateTime(threshold)}</p>`;
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

    // Countdown nur für echte Phasen
    if (!["free_eating","fasting","infant_fasting"].includes(rule.id)) {
      if (countdownInterval) clearInterval(countdownInterval);
      html += `<p id="countdown" style="font-weight:bold"></p>`;
    }

    resultDiv.innerHTML = html;
    resultDiv.classList.remove("hidden");

    // Countdown-Loop
    if (!["free_eating","fasting","infant_fasting"].includes(rule.id)) {
      const countdownEl = document.getElementById("countdown");
      function updateCountdown() {
        const rem = Math.floor((threshold - new Date())/1000);
        if (rem > 0) {
          countdownEl.textContent = `Diese Regel gilt noch: ⏰ ${formatRemainingLong(rem)}`;
        } else {
          countdownEl.textContent = "Diese Regel ist jetzt beendet. Bitte erneut berechnen.";
          clearInterval(countdownInterval);
        }
      }
      updateCountdown();
      countdownInterval = setInterval(updateCountdown, 1000);
    }
  }

  // Submit-Handler mit Validation
  form.addEventListener("submit", e => {
    e.preventDefault();
    const raw = opTimeInput.value;
    // nur ISO-Format YYYY-MM-DDTHH:MM zulassen
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
      resultDiv.innerHTML = "<strong>Bitte Datum und Uhrzeit vollständig eingeben.</strong>";
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

