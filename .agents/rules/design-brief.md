# Locked design brief

## Palette — Clean & Clinical (Concept 1)
- Dominant (60%) — Crisp White background: #FFFFFF
- Secondary (30%) — Soft Ice-Teal (cards, sections): #F0F8F9
- Accent (10%) — Deep Navy (headings, primary text): #0F172A
- CTA / Action — Vibrant Medical Teal (buttons): #0D9488
- Text — Slate Gray for body text: #475569
Fonts: Modern sans-serif stack (Inter/Roboto) for clean app-like UI.

## Section order (single scrolling page)
1. Header — name, credentials (Physiotherapist | Reg. No: MIAP 61713 | CVRS), tagline, photo,
   "Book Now on WhatsApp" CTA
2. About — empathy-led opening, 6,000+ patients, Jaypee Hospital Noida + Narendra Mohan Hospital
   Ghaziabad, "every session done personally by Anchal" differentiator
3. Experience stat cards — 6,000+ Patients Treated / Jaypee Hospital / Narendra Mohan Hospital
4. What We Treat — Spine & Neck / Joints & Muscles / Sports Injuries / Post-Surgical Rehab
5. Techniques Used — Manual Therapy, Dry Needling, Joint Manipulation
6. How It Works — 4 numbered steps (Assessment, Customized Plan, Active Therapy, Home Recovery)
7. Pricing — ₹700 initial consult, ₹600 follow-up, international ~$25–30 via PayPal (placeholder
   until Anchal confirms)
8. Testimonials — 3–5 slots, placeholder content until provided
9. FAQs — 6 questions (see brief PDF for exact text)
10. Footer — "Ready to Start?" heading, WhatsApp CTA, Google Reviews button (placeholder link)

## Booking form fields (exact, in this order)
Full Name, Phone Number, City, "What's bothering you" (short text), Duration of issue (dropdown),
Consulted a doctor before (Yes/No + optional file upload), Preferred day/time, How did you hear
about this (dropdown)

## Functional requirements
- WhatsApp button → wa.me/917042123365
- UPI/Razorpay for domestic payment, PayPal for international, toggle between them by
  domestic/international selection so both aren't shown at once
- Google Reviews button in footer (placeholder until link provided)
- Mobile-first — most traffic is from Instagram on phones
- Fast load — this is a conversion page, not a portfolio site