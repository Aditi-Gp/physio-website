/**
 * nav.js - Mobile Menu, Sticky Navigation & Smooth Scrolling
 */
export function initNavigation() {
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const mainNav = document.querySelector('.main-nav');
  const navLinks = document.querySelectorAll('.nav-links a');
  const siteHeader = document.querySelector('.site-header');

  // Mobile menu toggle
  if (mobileMenuBtn && mainNav) {
    mobileMenuBtn.addEventListener('click', () => {
      mainNav.classList.toggle('active');
      const icon = mobileMenuBtn.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
      }
    });

    // Close mobile menu on outside click
    document.addEventListener('click', (e) => {
      if (mainNav.classList.contains('active') && !e.target.closest('.main-nav') && !e.target.closest('.mobile-menu-btn')) {
        mainNav.classList.remove('active');
        const icon = mobileMenuBtn.querySelector('i');
        if (icon) {
          icon.classList.add('fa-bars');
          icon.classList.remove('fa-times');
        }
      }
    });
  }

  // Smooth scroll and active link state
  navLinks.forEach((link) => {
    link.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        e.preventDefault();
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          const headerHeight = siteHeader ? siteHeader.offsetHeight : 0;
          const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;

          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });

          // Close mobile menu if open
          if (mainNav && mainNav.classList.contains('active')) {
            mainNav.classList.remove('active');
            const icon = mobileMenuBtn?.querySelector('i');
            if (icon) {
              icon.classList.add('fa-bars');
              icon.classList.remove('fa-times');
            }
          }
        }
      }
    });
  });

  // Sticky header styling on scroll
  window.addEventListener('scroll', () => {
    if (!siteHeader) return;
    if (window.scrollY > 50) {
      siteHeader.style.boxShadow = '0 4px 20px rgba(45, 55, 72, 0.08)';
    } else {
      siteHeader.style.boxShadow = 'none';
    }
  });
}
