const GOOGLE_REVIEWS_URL = 'https://www.google.com/searchviewer/10?svid=CAwSHRIbCgNwdnESFENnMHZaeTh4TVhvMWRESTRjalJxGAo#sv=CAESzQEKuQEStgEKd0FERGJXZWFtMWJtaXdDYlhSeWx2VzY1Q2tGNlI2Vk1FUlNhUU01T2pPVk9FUG9mOHIxT2NwTGg3TWlHTUl1Y0pOcElPM3IzQ2RaOU5OajBRelhNZXdubzhYcTZPWi1WOW1VSVk0UUsxZHcwNWNPbXQwWmUzbGg4Ehd2VHZtYXBhdEhjdVFzZU1QNDdiYjRRTRoiQUhOMEU3RXNPSDZKWEpHd2NDTnBYWGRPQmR2eTdjNnJEQRIEODA1MRoBMyoAMAA4AUAAGAAgmrSm4QNKAhAB';

function createStarRating(rating, className = 'google-review-stars') {
  const stars = document.createElement('div');
  const roundedRating = Math.round(rating);
  stars.className = className;
  stars.setAttribute('role', 'img');
  stars.setAttribute('aria-label', `${rating} out of 5 stars`);

  for (let value = 1; value <= 5; value += 1) {
    const star = document.createElement('span');
    star.className = `google-review-star${value > roundedRating ? ' is-empty' : ''}`;
    star.setAttribute('aria-hidden', 'true');
    star.textContent = '★';
    stars.appendChild(star);
  }

  return stars;
}

function createStatusMessage(message) {
  const status = document.createElement('p');
  status.className = 'google-reviews-status';
  status.textContent = message;
  return status;
}

function createReviewCard(review) {
  const card = document.createElement('article');
  card.className = 'testimonial-quote-box google-review-card';

  const authorUrl = isHttpsUrl(review.authorUrl) ? review.authorUrl : '';
  const author = document.createElement(authorUrl ? 'a' : 'p');
  author.className = 'google-review-author';
  author.textContent = review.authorName;

  if (authorUrl) {
    author.href = authorUrl;
    author.target = '_blank';
    author.rel = 'noopener noreferrer';
    author.setAttribute('aria-label', `${review.authorName} on Google`);
  }

  card.append(author, createStarRating(review.rating));

  const quote = document.createElement('blockquote');
  quote.className = 'google-review-quote';
  quote.textContent = review.text;
  card.appendChild(quote);

  if (review.relativeTime) {
    const date = document.createElement('p');
    date.className = 'google-review-date';
    date.textContent = review.relativeTime;
    card.appendChild(date);
  }

  return card;
}

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function initChatButtonVisibility(section) {
  const chatButton = document.querySelector('.floating-whatsapp-fab');
  if (!chatButton || !('IntersectionObserver' in window)) return;

  const originalTabIndex = chatButton.getAttribute('tabindex');
  let reviewsVisible = false;

  function updateVisibility() {
    const hideButton = reviewsVisible && !chatButton.contains(document.activeElement);
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

  const observer = new IntersectionObserver(([entry]) => {
    reviewsVisible = entry.isIntersecting;
    updateVisibility();
  });
  observer.observe(section);
  chatButton.addEventListener('focus', updateVisibility);
  chatButton.addEventListener('blur', () => {
    window.setTimeout(updateVisibility, 0);
  });
}

export async function initGoogleReviews() {
  const section = document.querySelector('.google-reviews-section');
  const cardsContainer = document.querySelector('#google-review-cards');
  const ratingElement = document.querySelector('[data-google-rating]');
  let ratingStars = document.querySelector('[data-google-rating-stars]');
  const countElement = document.querySelector('[data-google-review-count]');
  const statusElement = document.querySelector('[data-google-rating-status]');
  const reviewsLink = section?.querySelector('.google-reviews-link');

  if (!section || !cardsContainer || !ratingElement || !ratingStars || !countElement || !statusElement || !reviewsLink) return;

  reviewsLink.href = GOOGLE_REVIEWS_URL;
  initChatButtonVisibility(section);
  cardsContainer.setAttribute('aria-busy', 'false');

  try {
    const response = await fetch('/api/google-reviews', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Google Reviews request failed with status ${response.status}.`);
    }

    const data = await response.json();
    if (!Number.isFinite(data.rating) || !Number.isFinite(data.reviewCount) || !Array.isArray(data.reviews)) {
      throw new Error('Google Reviews returned an invalid response.');
    }

    ratingElement.textContent = data.rating.toFixed(1);
    const populatedRatingStars = createStarRating(data.rating, 'google-rating-stars');
    ratingStars.replaceWith(populatedRatingStars);
    ratingStars = populatedRatingStars;
    const reviewLabel = data.reviewCount === 1 ? 'review' : 'reviews';
    countElement.textContent = `Based on ${data.reviewCount.toLocaleString()} Google ${reviewLabel}`;

    const liveReviews = document.createDocumentFragment();
    if (data.reviews.length) {
      data.reviews.forEach((review) => {
        if (
          typeof review.authorName === 'string'
          && typeof review.text === 'string'
          && Number.isFinite(review.rating)
        ) {
          liveReviews.appendChild(createReviewCard(review));
        }
      });
    }

    if (liveReviews.childElementCount) {
      cardsContainer.replaceChildren(liveReviews);
      statusElement.textContent = 'Live Google data · updated just now';
    } else {
      statusElement.textContent = 'Live rating · saved review snapshot';
      const liveStatus = createStatusMessage('Google did not return review text in this response; showing the saved review snapshot.');
      liveStatus.classList.add('google-reviews-fallback-status');
      cardsContainer.appendChild(liveStatus);
    }
  } catch (error) {
    console.error('Unable to load Google Reviews:', error);
    statusElement.textContent = '';
    const liveStatus = createStatusMessage('Showing saved Google reviews. Open Google for the latest ratings and reviews.');
    liveStatus.classList.add('google-reviews-fallback-status');
    cardsContainer.appendChild(liveStatus);
  } finally {
    cardsContainer.setAttribute('aria-busy', 'false');
  }
}
