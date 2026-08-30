# Deny rules — do not do these without explicit confirmation from me

- Never commit a real API key, secret, or credentials file (.env.local, service account JSON, etc).
- Never change payment verification/webhook signature-checking logic silently — flag it and explain
  the change first.
- Never delete or overwrite Anchal's provided content (photos, testimonials, pricing) once added.
- Never push directly to a production domain / deploy without me reviewing the diff first.
- Never add tracking/analytics scripts beyond what I've asked for (no ad pixels).
- Never introduce a new accent color or let terracotta exceed roughly 10% of visual weight on any
  section — check against .agents/rules/design-brief.md's palette before adding new UI elements.