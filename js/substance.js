document.addEventListener('DOMContentLoaded', async () => {
  const gruppeSelect = document.getElementById('gruppe-select');
  const unterkatSelect = document.getElementById('unterkat-select');
  const unterkatLabel = document.getElementById('unterkat-label');
  const resultDiv = document.getElementById('substanz-result');
  let data = {};

  // Daten laden
  try {
    const res = await fetch('data/substances.json');
    if (!res.ok) throw new Error('Fehler beim Laden');
    data = await res.json();
  } catch (err) {
    resultDiv.innerHTML = "<strong>Fehler beim Laden der Substanzen.</strong>";
    resultDiv.classList.remove("hidden");
    return;
  }

  // Bei Altersauswahl Gruppen laden
  document.querySelectorAll("input[name='infant']").forEach(radio => {
    radio.addEventListener("change", showGroups);
  });
  showGroups(); // initial

  function showGroups() {
    const isInfant = document.querySelector("input[name='infant']:checked").value === "yes";
    const key = isInfant ? "unter1" : "ueber1";
    gruppeSelect.innerHTML = `<option value="">Essensgruppe wählen</option>`;
    data[key].forEach((g, idx) => {
      gruppeSelect.innerHTML += `<option value="${idx}">${g.gruppe}</option>`;
    });
    gruppeSelect.disabled = false;
    unterkatSelect.classList.add('hidden');
    unterkatLabel.classList.add('hidden');
    resultDiv.classList.add('hidden');
    unterkatSelect.innerHTML = "";
  }

  // Essensgruppe gewählt
  gruppeSelect.addEventListener('change', function () {
    const isInfant = document.querySelector("input[name='infant']:checked").value === "yes";
    const key = isInfant ? "unter1" : "ueber1";
    const gruppe = data[key][this.value];
    if (!gruppe) {
      resultDiv.classList.add('hidden');
      unterkatSelect.classList.add('hidden');
      unterkatLabel.classList.add('hidden');
      return;
    }

    // Unterkategorien anzeigen, wenn vorhanden
    if (gruppe.unterkategorien && gruppe.unterkategorien.length > 0) {
      unterkatSelect.innerHTML = `<option value="">Unterkategorie wählen</option>`;
      gruppe.unterkategorien.forEach(u =>
        unterkatSelect.innerHTML += `<option value="${u}">${u}</option>`
      );
      unterkatSelect.classList.remove('hidden');
      unterkatLabel.classList.remove('hidden');
    } else {
      unterkatSelect.classList.add('hidden');
      unterkatLabel.classList.add('hidden');
    }

    showResult(gruppe, "");
    unterkatSelect.value = "";
  });

  // Unterkategorie gewählt
  unterkatSelect.addEventListener('change', function () {
    const isInfant = document.querySelector("input[name='infant']:checked").value === "yes";
    const key = isInfant ? "unter1" : "ueber1";
    const gruppe = data[key][gruppeSelect.value];
    const unterkategorie = this.value;
    showResult(gruppe, unterkategorie);
  });

  function showResult(gruppe, unterkategorie) {
    let html = "";
    if (gruppe.panda) {
      html += `<img src="../assets/${gruppe.panda}" class="panda-result" alt="Panda Illustration">`;
    }
    html += `<p><b>${gruppe.gruppe}:</b></p>`;
    html += `<div style="margin-bottom:1em;">${gruppe.hinweis}</div>`;
    if (unterkategorie) {
      html += `<div>Ausgewählt: <b>${unterkategorie}</b></div>`;
    }
    resultDiv.innerHTML = html;
    resultDiv.classList.remove('hidden');
  }
});

