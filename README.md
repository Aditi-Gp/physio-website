# Dr. Anchal Gupta — Online Physiotherapy Booking Site

Single-page site for booking paid online physiotherapy video consultation

## Stack
Static HTML/CSS/vanilla JS (House Physio base) + [Vercel serverless functions | Static Forms/FormBold]
for the booking form, Razorpay + PayPal for payment.

## Local development
1. `npm install` (only needed if using the custom /api route)
2. `npx vercel dev` — runs the static site AND /api functions locally, or just open index.html
   directly if using a form BaaS with no custom backend
3. Open http://localhost:3000

## Environment variables (see .env.example)
- `RAZORPAY_KEY_ID` (public key, safe client-side) / `RAZORPAY_KEY_SECRET` (server-only, webhook verification)
- `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`
- If custom backend: `GOOGLE_SHEETS_CREDENTIALS_JSON`, `GOOGLE_SHEET_ID`
- If form BaaS: `STATIC_FORMS_ACCESS_KEY` or `FORMBOLD_ENDPOINT`
- `WHATSAPP_NUMBER` = 917042123365

Never commit real values — only `.env.example` with placeholders goes in git.

## Deploy
1. Push to GitHub.
2. Import the repo into Vercel or Netlify.
3. Add environment variables in the host's dashboard.
4. Connect the custom domain once purchased.

## Content still needed from Anchal before launch
- [ ] Professional photo(s)
- [ ] Final domestic + international pricing
- [ ] Google Business Profile review link
- [ ] 3–5 testimonial quotes (name, city, condition)
- [ ] Domain name purchased

