const GOOGLE_REVIEWS_URL = 'https://www.google.com/searchviewer/10?svid=CAwSHRIbCgNwdnESFENnMHZaeTh4TVhvMWRESTRjalJxGAo#sv=CAESzQEKuQEStgEKd0FERGJXZWFtMWJtaXdDYlhSeWx2VzY1Q2tGNlI2Vk1FUlNhUU01T2pPVk9FUG9mOHIxT2NwTGg3TWlHTUl1Y0pOcElPM3IzQ2RaOU5OajBRelhNZXdubzhYcTZPWi1WOW1VSVk0UUsxZHcwNWNPbXQwWmUzbGg4Ehd2VHZtYXBhdEhjdVFzZU1QNDdiYjRRTRoiQUhOMEU3RXNPSDZKWEpHd2NDTnBYWGRPQmR2eTdjNnJEQRIEODA1MRoBMyoAMAA4AUAAGAAgmrSm4QNKAhAB';

function initChatButtonVisibility(section) {
  const chatButton = document.querySelector('.floating-whatsapp-fab');
  const footer = document.querySelector('.site-footer-bar');
  if (!chatButton || !('IntersectionObserver' in window)) return;

  const originalTabIndex = chatButton.getAttribute('tabindex');
  let reviewsVisible = false;
  let footerVisible = false;

  function updateVisibility() {
    const hideButton = (reviewsVisible || footerVisible) && !chatButton.contains(document.activeElement);
    chatButton.classList.toggle('is-hidden-for-reviews', hideButton);

    if (hideButton) {
      chatButton.setAttribute('aria-hidden', 'true');
      chatButton.setAttribute('tabindex', '-1');
    } else {
      chatButton.removeAttribute('aria-hidden');
      if (originalTabIndex === null) {
        chatButton.removeAttribute('tabindex');
      } else {
        chatButton.setAttribute('tabindex', originalTabIndex);
      }
    }
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target === section) {
        reviewsVisible = entry.isIntersecting;
      }
      if (entry.target === footer) {
        footerVisible = entry.isIntersecting;
      }
    });
    updateVisibility();
  });

  if (section) observer.observe(section);
  if (footer) observer.observe(footer);

  chatButton.addEventListener('focus', updateVisibility);
  chatButton.addEventListener('blur', () => {
    window.setTimeout(updateVisibility, 0);
  });
}

export function initGoogleReviews() {
  const section = document.querySelector('.google-reviews-section');
  const cardsContainer = document.querySelector('#google-review-cards');
  const reviewsLink = section?.querySelector('.google-reviews-link');

  if (!section) return;

  if (reviewsLink) {
    reviewsLink.href = GOOGLE_REVIEWS_URL;
  }
  if (cardsContainer) {
    cardsContainer.setAttribute('aria-busy', 'false');
  }

  initChatButtonVisibility(section);
}
