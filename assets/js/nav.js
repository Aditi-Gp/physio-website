/**
 * nav.js - Mobile Menu, Sticky Navigation & Smooth Scrolling
 */
export function initNavigation() {
  const mobileToggle = document.querySelector('.mobile-menu-toggle') || document.querySelector('.mobile-menu-btn');
  const mainNav = document.querySelector('.main-nav');
  const navLinks = document.querySelectorAll('.nav-link, .nav-links a');
  const siteHeader = document.querySelector('.site-header');

  // Mobile menu toggle
  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener('click', () => {
      const isOpening = !mainNav.classList.contains('active');
      mainNav.classList.toggle('active');
      mobileToggle.setAttribute('aria-expanded', isOpening ? 'true' : 'false');
    });

    // Close mobile menu on outside click
    document.addEventListener('click', (e) => {
      if (mainNav.classList.contains('active') && !e.target.closest('.main-nav') && !e.target.closest('.mobile-menu-toggle') && !e.target.closest('.mobile-menu-btn')) {
        mainNav.classList.remove('active');
        mobileToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Smooth scroll and active link state
  navLinks.forEach((link) => {
    link.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId.startsWith('#') && targetId.length > 1) {
        e.preventDefault();
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          navLinks.forEach((l) => l.classList.remove('active'));
          this.classList.add('active');

          const headerHeight = siteHeader ? siteHeader.offsetHeight : 0;
          const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;

          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });

          // Close mobile menu if open
          if (mainNav && mainNav.classList.contains('active')) {
            mainNav.classList.remove('active');
            if (mobileToggle) mobileToggle.setAttribute('aria-expanded', 'false');
          }
        }
      }
    });
  });

  // Sticky header styling on scroll
  window.addEventListener('scroll', () => {
    if (!siteHeader) return;
    if (window.scrollY > 30) {
      siteHeader.style.boxShadow = '0 4px 16px rgba(13, 92, 99, 0.08)';
    } else {
      siteHeader.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.02)';
    }
  });
}
