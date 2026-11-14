# Dr. Anchal Gupta — Online Physiotherapy Booking Site

Single-page site for booking paid online physiotherapy video consultation

## Stack
Static HTML/CSS/vanilla JS (House Physio base) on Vercel, an Express API on Render, MongoDB Atlas
booking storage, Razorpay payments, and EmailJS notifications.

## Local development
1. `npm install`
2. Set the required environment variables in the ignored `.env` file.
3. Run `npm run dev` and open http://localhost:10000. The local Express server serves the page
   and API together. `npm run build` builds the Vercel static site.

## Environment variables (see .env.example)
- Render only: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `MONGODB_URI`,
  `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `ALLOWED_ORIGINS`, `GOOGLE_PLACES_API_KEY`, and
  `GOOGLE_PLACE_ID`.
- Vercel build only: `PUBLIC_API_BASE_URL`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`,
  `EMAILJS_DOCTOR_TEMPLATE_ID`, `EMAILJS_PATIENT_TEMPLATE_ID`, and `DOCTOR_EMAIL`. EmailJS's
  public key and template configuration are embedded in the public frontend build; do not put
  database, Razorpay secret, or Google API credentials here.

Never commit real values — only `.env.example` with placeholders goes in git.

## Configure MongoDB Atlas booking storage
The Render API saves bookings and patients' contact/issue information in the `bookings` collection.
Each Razorpay checkout attempt is stored separately in `payments`; this project does not need a
separate patients collection for its current flow.

1. Create a MongoDB Atlas database user and an Atlas cluster. Restrict network access to the
   addresses needed by your deployment; avoid opening database access to all IPs unless required.
2. Set `MONGODB_USERNAME` and `MONGODB_PASSWORD` to the database user's credentials. To follow
   your requested setup, you can enter the same values currently used in local development into
   Render's environment settings. Do not send them to Vercel or commit them. Prefer a database user
   restricted to `readWrite` on only this database.
3. Set `MONGODB_URI` to the cluster URI with a database name in its path, for example
   `mongodb+srv://cluster-host/physiotherapy?retryWrites=true&w=majority`. The API uses the
   username and password from their dedicated variables, overriding any credentials embedded in
   the URI; keeping credentials out of the URI avoids stale duplicate credentials.
4. For local development, add all three values to the ignored `.env` file. In production, set them
   only in Render's environment settings. For Atlas network access, allowlist the outbound IP ranges
   displayed for the Render service's region; do not use `0.0.0.0/0` for production.

## Razorpay payment verification
The API creates Razorpay orders server-side from the booking's server-defined price. After checkout,
it validates the HMAC signature, fetches the payment from Razorpay, checks order/amount/currency,
captures authorized payments, and only then marks the booking paid. A signed `payment.captured`
webhook independently updates paid status if the browser closes before returning to the site.
Configure automatic capture in Razorpay as recommended, add
`https://<service>.onrender.com/api/webhooks/razorpay` as a webhook in both Test and Live modes,
subscribe to `payment.captured`, and put each mode's webhook secret in Render. Test the full flow
with test keys before switching to live keys. No card or bank details are stored.

## Deploy: Render API + Vercel frontend
### 1. Prepare accounts and branch
1. Make sure the repository and all reviewed changes are pushed to GitHub. Connect the same repo to
   Render and Vercel. Do not deploy from a worktree containing unreviewed changes.
2. Select plans appropriate for a real patient-booking business. Render's Free web services sleep
   after inactivity and Render explicitly says Free instances are not for production; use a paid
   instance for the API. Vercel Hobby is free and includes HTTPS, but its pricing page positions it
   for personal projects; check plan eligibility for the clinic's commercial use.

### 2. Create the Render API
1. In Render, choose **New → Web Service**, connect this repository, and select the production
   branch.
2. Set **Build Command** to `npm ci` and **Start Command** to `npm start`. Set the health-check path
   to `/healthz`. The app binds to Render's `PORT` on `0.0.0.0`.
3. Add these environment variables in the Render service settings:
   - `NODE_ENV=production`
   - `MONGODB_URI`, `MONGODB_USERNAME`, `MONGODB_PASSWORD` (same values as local if you choose;
     do not paste them into GitHub or Vercel)
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` (start with test-mode
     keys and webhook secret)
   - `GOOGLE_PLACES_API_KEY` and `GOOGLE_PLACE_ID`
   - `ALLOWED_ORIGINS` set to the exact Vercel production URL, e.g.
     `https://your-project.vercel.app` (later add your custom frontend origins, comma-separated,
     with no trailing slashes)
4. Deploy and wait for `https://<service>.onrender.com/healthz` to return `{"status":"ok"}`.
5. In Razorpay Test mode, add `https://<service>.onrender.com/api/webhooks/razorpay` as a webhook,
   select `payment.captured`, copy the webhook secret into Render, and redeploy.

### 3. Deploy the static frontend to Vercel
1. Import the same GitHub repository as a Vercel project. Set the framework preset to **Other**,
   Build Command to `npm run build`, and Output Directory to `dist`.
2. Set these **Production** build environment variables in Vercel:
   - `PUBLIC_API_BASE_URL=https://<service>.onrender.com` (or your Render API custom domain)
   - `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`, `EMAILJS_DOCTOR_TEMPLATE_ID`,
     `EMAILJS_PATIENT_TEMPLATE_ID`, `DOCTOR_EMAIL`
3. Leave `MONGODB_*`, `RAZORPAY_KEY_SECRET`, and `GOOGLE_PLACES_API_KEY` out of Vercel. The build
   script embeds only the Render API URL and EmailJS public configuration.
4. Deploy. Test booking creation, rejected invalid input, payment test mode, payment verification,
   confirmation emails, Google reviews, and the health endpoint before using live payment keys.
5. Do not point Preview deployments at the production database or payment environment. Configure
   separate test services if preview workflows need working booking/payment APIs.

### 4. Add a custom domain and free SSL/TLS
1. A custom domain name itself is usually paid. For initial testing, Vercel's `*.vercel.app` and
   Render's `*.onrender.com` hostnames are already HTTPS.
2. In Vercel **Project → Settings → Domains**, add the chosen frontend domain (for example
   `www.example.com`). Copy the exact DNS records Vercel shows into your registrar's DNS settings.
3. In Render **API service → Settings → Custom Domains**, add an API host such as
   `api.example.com`. Copy the exact DNS records Render provides. Remove conflicting `AAAA`
   records for the Render hostname as Render's current custom-domain guidance recommends.
4. Wait for both providers to verify DNS and issue certificates. Vercel and Render automatically
   provision and renew managed TLS certificates at no certificate charge, and redirect HTTP to
   HTTPS; there is no certificate file to upload or renew manually.
5. Update Vercel's `PUBLIC_API_BASE_URL` to `https://api.example.com`, add the frontend origin(s) to
   Render's `ALLOWED_ORIGINS`, and redeploy both services.

### 5. Go-live checklist
- Confirm the exact domain DNS and HTTPS in a clean browser.
- Confirm Atlas database user scope, IP allowlist, backups/retention, and that no database secret is
  in the Vercel build output or browser source.
- Replace Razorpay test credentials with approved **Live Mode** credentials in Render only, then
  make a controlled real payment/refund and verify it in the Razorpay dashboard.
- Confirm business pricing, PayPal support, refund/cancellation terms, and appointment-confirmation
  process. The current checkout implements Razorpay only; PayPal is not wired into the booking flow
  even though it appears in some page copy.
- Have the owner review privacy notice/consent, health-data handling, retention, and third-party
  EmailJS/Atlas processing before collecting real patient data.
- Review the deployment diff and logs. Never push/deploy a production change without owner review.
- International PayPal checkout is not implemented yet; page copy currently mentions PayPal/Stripe.
  Remove unsupported claims or implement and test the international payment flow before advertising
  those methods.

## Configure live Google Reviews
The page starts with its saved Google snapshot and refreshes the rating and review cards from the
Google Places API (New) via `/api/google-reviews`. Configure the following environment variables in
Render (and in `.env` for local development):

1. In Google Cloud Console, select a project, enable **Places API (New)**, and configure billing
   for that project.
2. Create an API key restricted to **Places API (New)**. Store it as `GOOGLE_PLACES_API_KEY` in
   Render's service environment variables; never add the key to frontend code or commit it. Set
   appropriate API quotas and billing alerts in Google Cloud.
3. Find the business in Google's [Place ID Finder](https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder),
   confirm it is **Move Essence Advanced Physiotherapy Clinic and Rehab** at Aditya Urban Casa,
   Sector 78, Noida, and set its Place ID as `GOOGLE_PLACE_ID`.
4. Add both variables to Render and redeploy. For local testing, add them to the ignored `.env`
   file and run `npm run dev`.

The endpoint requests the current rating, total review count, and up to three review excerpts from
Google on each page load. If Google cannot be reached, the saved cards remain available and the
link to the Google listing remains available.

## Platform documentation
- [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build)
- [Vercel pricing and HTTPS](https://vercel.com/pricing)
- [Render web services](https://render.com/docs/web-services)
- [Render free-instance limits](https://render.com/docs/free)
- [Render outbound IP ranges](https://render.com/docs/outbound-ip-addresses)
- [Render custom domains and TLS](https://render.com/docs/custom-domains)
- [Render managed TLS](https://render.com/docs/tls)
- [Razorpay Node.js integration](https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps/)
- [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/)

## Content still needed from Anchal before launch
- [ ] Professional photo(s)
- [ ] Final domestic + international pricing
- [x] Google Business Profile review link and current rating
- [x] Three patient review quotes sourced from Google Reviews
- [ ] Domain name purchased
