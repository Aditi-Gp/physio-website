/**
 * faq.js - FAQ Accordion Logic
 */
export function initFaqAccordion() {
  const faqQuestions = document.querySelectorAll('.faq-question');

  faqQuestions.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const currentItem = btn.closest('.faq-item');
      if (!currentItem) return;

      const answer = currentItem.querySelector('.faq-answer');
      const inner = currentItem.querySelector('.faq-answer-inner');
      const isCurrentlyActive = currentItem.classList.contains('active');

      // Close all items
      document.querySelectorAll('.faq-item').forEach((item) => {
        item.classList.remove('active');
        const qBtn = item.querySelector('.faq-question');
        if (qBtn) qBtn.setAttribute('aria-expanded', 'false');
        const aEl = item.querySelector('.faq-answer');
        if (aEl) aEl.style.maxHeight = null;
      });

      // If it wasn't active, open it
      if (!isCurrentlyActive) {
        currentItem.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
        if (answer) {
          const contentHeight = inner ? inner.scrollHeight + 30 : 150;
          answer.style.maxHeight = contentHeight + 'px';
        }
      }
    });
  });
}
