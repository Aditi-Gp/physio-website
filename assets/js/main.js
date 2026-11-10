/**
 * main.js - Application Entrypoint
 */
import { initNavigation } from './nav.js';
import { initBookingForm } from './booking.js';
import { initFaqAccordion } from './faq.js';
import { initGoogleReviews } from './google-reviews.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initBookingForm();
  initFaqAccordion();
  initGoogleReviews();
});
