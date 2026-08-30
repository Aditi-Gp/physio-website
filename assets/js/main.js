/**
 * main.js - Application entrypoint
 */
import { initNavigation } from './nav.js';
import { initFaqAccordion } from './faq.js';
import { initTestimonialsSlider } from './testimonials.js';
import { initBookingForm } from './booking.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initFaqAccordion();
  initTestimonialsSlider();
  initBookingForm();
});
