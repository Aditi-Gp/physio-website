# Dr. Anchal Gupta — Online Physiotherapy Booking Site

Single-page site for booking paid online physiotherapy video consultations.

## Stack
Static HTML/CSS/vanilla JS (House Physio base), Vercel serverless functions with MongoDB Atlas
booking storage, and Razorpay + PayPal for payment.

## Local development
1. `npm install`
2. Set the required environment variables in the ignored `.env` file.
3. Run `npx vercel dev` to serve the site and its `/api` functions together.
4. Open http://localhost:3000. Opening `index.html` directly does not provide database-backed
   booking or payment-reference storage.

## Environment variables (see .env.example)
- `RAZORPAY_KEY_ID` (public key, safe client-side) / `RAZORPAY_KEY_SECRET` (server-only, webhook verification)
- `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`
- `MONGODB_URI`, `MONGODB_USERNAME`, `MONGODB_PASSWORD` (server-only MongoDB Atlas access)
- If custom backend: `GOOGLE_SHEETS_CREDENTIALS_JSON`, `GOOGLE_SHEET_ID`
- Google reviews: `GOOGLE_PLACES_API_KEY` (server-side only) and `GOOGLE_PLACE_ID`
- If form BaaS: `STATIC_FORMS_ACCESS_KEY` or `FORMBOLD_ENDPOINT`
- `WHATSAPP_NUMBER` = 917042123365

Never commit real values — only `.env.example` with placeholders goes in git.

## Configure MongoDB Atlas booking storage
The `/api/bookings` endpoint saves each booking in the `bookings` collection, including the
patient's name, email, WhatsApp number, issue description, preferred date, and selected session.
The `/api/bookings/:id/payment` endpoint saves the Razorpay payment reference separately in the
`payments` collection. Patient information is kept with its booking; a separate patients collection
is not required for this flow.

1. Create a MongoDB Atlas database user and an Atlas cluster. Restrict network access to the
   addresses needed by your deployment; avoid opening database access to all IPs unless required.
2. Set `MONGODB_USERNAME` and `MONGODB_PASSWORD` to the database user's credentials.
3. Set `MONGODB_URI` to the cluster URI with a database name in its path, for example
   `mongodb+srv://cluster-host/physiotherapy?retryWrites=true&w=majority`. The API uses the
   username and password from their dedicated variables, overriding any credentials embedded in
   the URI; keeping credentials out of the URI avoids stale duplicate credentials.
4. For local development, add all three values to the ignored `.env` file and run
   `npm install` followed by `npx vercel dev`. For deployment, configure the same variables in
   the Vercel project's server-side environment settings. Never expose them to frontend code.

Payment references currently have `verificationStatus: unverified_client_report`: they are
submitted by the browser after Razorpay checkout and are **not proof that payment succeeded**.
The amount stored is the server's expected session amount, not an amount verified with Razorpay.
Do not use these records to fulfill or reconcile payments until server-side Razorpay order creation
and signature/webhook verification are implemented and reviewed. No card or bank details are
stored. Patient issue descriptions may contain sensitive health information; restrict database
access and establish an appropriate retention policy before launch.

## Configure live Google Reviews
The review cards and rating are loaded at runtime from the Google Places API (New) via
`/api/google-reviews`; no review content or rating is used as a fallback. Configure the following
environment variables in Vercel (and in `.env.local` for local development):

1. In Google Cloud Console, select a project, enable **Places API (New)**, and configure billing
   for that project.
2. Create an API key restricted to **Places API (New)**. Store it as `GOOGLE_PLACES_API_KEY` in
   Vercel's project environment variables; never add the key to frontend code or commit it. Set
   appropriate API quotas and billing alerts in Google Cloud.
3. Find the business in Google's [Place ID Finder](https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder),
   confirm it is **Move Essence Advanced Physiotherapy Clinic and Rehab** at Aditya Urban Casa,
   Sector 78, Noida, and set its Place ID as `GOOGLE_PLACE_ID`.
4. Add both variables to Vercel for each environment where the site runs, then redeploy. For local
   testing, add them to the ignored `.env.local` file and run `npx vercel dev` so the `/api` route
   is available.

The endpoint requests the current rating, total review count, and up to three review excerpts from
Google on each page load. Until the endpoint is available, the page displays the dated Google
snapshot in its HTML. If Google cannot be reached, that snapshot remains visible with a notice
that live refresh is unavailable, and the link to the Google listing remains available.

## Deploy
1. Push to GitHub.
2. Import the repo into Vercel or Netlify.
3. Add environment variables in the host's dashboard.
4. Connect the custom domain once purchased.

## Content still needed from Anchal before launch
- [ ] Professional photo(s)
- [ ] Final domestic + international pricing
- [x] Google Business Profile review link and current rating
- [x] Three patient review quotes sourced from Google Reviews
- [ ] Domain name purchased