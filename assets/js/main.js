/**
 * main.js - Application entrypoint
 */
import { initNavigation } from './nav.js';
import { initFaqAccordion, toggleConditionsDetail } from './faq.js';
import { initTestimonialsSlider } from './testimonials.js';
import { initBookingForm } from './booking.js';

// Make toggleConditionsDetail available globally for inline onclick
window.toggleConditionsDetail = toggleConditionsDetail;

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initFaqAccordion();
  initTestimonialsSlider();
  initBookingForm();
});
