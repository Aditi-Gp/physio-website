# Code style

- Semantic HTML5. Use the CSS custom properties defined for the palette — never hardcode hex
  colors inline once the variables exist.
- One feature per JS file under assets/js/ — do not put everything in one giant script.
- If using custom serverless functions: one responsibility per file in /api. Validate all form
  input server-side, not just client-side.
- No secrets, API keys, or tokens in any committed file — always read from process.env.
- Every new form field must have client-side validation AND (if custom backend) a matching
  server-side check.
- Keep total page weight light: compress images, avoid unnecessary JS libraries — this is a
  mobile-first conversion page, not a portfolio site.
- Comment any payment-related code clearly — this handles real money.