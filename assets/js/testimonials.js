/**
 * testimonials.js - Testimonial Carousel / Slider
 */
export function initTestimonialsSlider() {
  const slides = document.querySelectorAll('.testimonial-slide');
  const prevBtn = document.querySelector('.slider-btn.prev-btn');
  const nextBtn = document.querySelector('.slider-btn.next-btn');
  const dotsContainer = document.querySelector('.slider-dots');

  if (!slides.length) return;

  let currentIndex = 0;

  // Create indicator dots dynamically if container exists
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    slides.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.className = `dot ${idx === 0 ? 'active' : ''}`;
      dot.setAttribute('aria-label', `Go to testimonial ${idx + 1}`);
      dot.addEventListener('click', () => showSlide(idx));
      dotsContainer.appendChild(dot);
    });
  }

  const dots = document.querySelectorAll('.slider-dots .dot');

  function showSlide(index) {
    if (index < 0) {
      currentIndex = slides.length - 1;
    } else if (index >= slides.length) {
      currentIndex = 0;
    } else {
      currentIndex = index;
    }

    slides.forEach((slide, idx) => {
      slide.classList.toggle('active', idx === currentIndex);
    });

    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentIndex);
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => showSlide(currentIndex - 1));
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => showSlide(currentIndex + 1));
  }

  // Auto advance every 7 seconds
  setInterval(() => {
    showSlide(currentIndex + 1);
  }, 7000);
}
