/**
 * main.js - Application Entrypoint
 */
import { initNavigation } from './nav.js';
import { initBookingForm } from './booking.js';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initBookingForm();
});
