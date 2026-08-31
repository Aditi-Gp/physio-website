/**
 * faq.js - FAQ Accordion Logic
 */
export function initFaqAccordion() {
  // Support both old and new accordion structures
  const faqItems = document.querySelectorAll('.faq-item');
  const accordionItems = document.querySelectorAll('.accordion-item');

  // Handle traditional FAQ items
  faqItems.forEach((item) => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    if (question && answer) {
      question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        // Close all other FAQ items
        faqItems.forEach((otherItem) => {
          if (otherItem !== item) {
            otherItem.classList.remove('active');
            const otherAnswer = otherItem.querySelector('.faq-answer');
            if (otherAnswer) {
              otherAnswer.style.maxHeight = null;
            }
          }
        });

        // Toggle current FAQ item
        if (isActive) {
          item.classList.remove('active');
          answer.style.maxHeight = null;
        } else {
          item.classList.add('active');
          answer.style.maxHeight = answer.scrollHeight + 30 + 'px';
        }
      });
    }
  });

  // Handle new accordion items (collapsed by default)
  accordionItems.forEach((item) => {
    const question = item.querySelector('.accordion-question');
    const answer = item.querySelector('.accordion-answer');

    if (question && answer) {
      question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        // Toggle current accordion item
        if (isActive) {
          item.classList.remove('active');
          answer.style.maxHeight = null;
        } else {
          item.classList.add('active');
          answer.style.maxHeight = answer.scrollHeight + 30 + 'px';
        }
      });
    }
  });
}

/**
 * Toggle expandable conditions detail section
 */
export function toggleConditionsDetail() {
  const detailBox = document.getElementById('conditions-detail');
  if (detailBox) {
    if (detailBox.style.display === 'none' || !detailBox.style.display) {
      detailBox.style.display = 'block';
    } else {
      detailBox.style.display = 'none';
    }
  }
}
