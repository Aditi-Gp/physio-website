# Project: Dr. Anchal Gupta physiotherapy booking site

## Stack
Static HTML/CSS/vanilla JS, based on the House Physio template, restyled to a locked 60-30-10
color system (see .agents/rules/design-brief.md). Backend: [fill in once you pick §4a or §4b].
Razorpay (domestic) + PayPal (international) for payment.

## Commands
- dev: npx vercel dev  (or just open index.html if no custom backend)
- deploy: git push (auto-deploys on push to main)

## Design brief (do not deviate without asking)
See .agents/rules/design-brief.md — palette (with exact hex values), section order, copy tone,
form fields, and functional requirements. Treat it as source of truth over general "best practice"
suggestions or default template styling.

## Conventions
See .agents/rules/code-style.md.

## Before implementing a new section or feature
Check .agents/rules/design-brief.md first to confirm exact copy, fields, order, and color tokens —
do not invent additional sections, fields, or colors not listed there.

## Deny rules
See .agents/rules/deny-rules.md. In particular: never commit real API keys or secrets, never modify
payment-verification logic without flagging it for explicit review first.