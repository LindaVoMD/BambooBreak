// js/main.js

document.addEventListener('DOMContentLoaded', () => {
  // Panda-Buttons abfragen
  const btnInfo = document.querySelector('.panda-btn.info');
  const btnCalendar = document.querySelector('.panda-btn.calendar');
  const btnEating = document.querySelector('.panda-btn.eating');

  // Navigation steuern
  if (btnInfo) {
    btnInfo.addEventListener('click', () => {
      window.location.href = 'info.html';
    });
  }
  if (btnCalendar) {
    btnCalendar.addEventListener('click', () => {
      window.location.href = 'calculator.html';
    });
  }
  if (btnEating) {
    btnEating.addEventListener('click', () => {
      window.location.href = 'substance.html';
    });
  }

});
