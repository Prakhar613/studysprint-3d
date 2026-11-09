# StudySprint India

A free study web app for Indian students. No npm dependencies: Node 22.13+ only.

## Features
- Pomodoro focus timer (bubble-sheet display) that keeps running across pages. Completed sessions are verified on the server and count on the focus leaderboard.
- Timed subject quizzes (8 subjects). The server owns the clock and the answer key, so answers cannot be faked from the browser.
- Weekly contests on a fixed IST schedule, with a waiting room, identical questions for everyone and a live leaderboard.
- Leaderboards for quiz points, focus minutes and top helpers; filter by period, subject and state.
- All-India live chat (rooms by subject and exam) over server-sent events; doubts forum with answers, votes, accepted answers and reporting.
- Research page: a Google Scholar button (Scholar cannot be embedded or queried by API) plus in-page OpenAlex results with free PDF links.
- Books page: curated official sources (NCERT, NPTEL, OpenStax, SWAYAM and more) plus Open Library search.
- AI tutor "Sprint" (floating button on every page and a full page at `#/tutor`): streaming answers in English, Hindi or Hinglish; modes for explaining topics, solving doubts step by step, quizzing, study plans, quick notes and reviewing the student's own wrong quiz answers. Details below.
- Home page: Nobel, science, current-affairs and space headlines from public RSS feeds, linking to publishers.
- Safety: scrypt password hashing, HttpOnly cookies, CSRF origin check, strict CSP, rate limits, phone and e-mail masking in all user text, report-to-hide, account deletion.

## Run locally
    npm start      # http://localhost:3000
    npm test       # backend tests

## Questions
The server pulls extra questions from Open Trivia DB (Maths, CS, History, Geography) every 12 hours and ships a built-in bank of 96. Add your own with `npm run import-questions -- questions.json` (format in `scripts/import-questions.js`). Aim for at least 40 per subject so contests stay fresh.

## Deploy
Any host with a persistent disk works (Render, Fly.io, Railway, a VPS):

    docker build -t studysprint .
    docker run -p 3000:3000 -v studysprint-data:/data \
      -e TRUST_PROXY=true -e ADMIN_USERS=yourusername -e CONTACT_EMAIL=you@example.com studysprint

Serve over HTTPS (cookies are Secure in production). SQLite lives in `/data`; back it up.
Variables: `GROQ_API_KEY` or `GEMINI_API_KEY` (turns the AI tutor on, see the AI tutor section), `TUTOR_PROVIDER`, `TUTOR_MODEL`, `TUTOR_DAILY_LIMIT`, `PORT`, `DATA_DIR`, `TRUST_PROXY` (true only behind your own proxy), `ADMIN_USERS` (usernames who can remove chat messages and posts), `SYNC_QUESTIONS=false`, `CONTACT_EMAIL`.

## AI tutor (Sprint)
Pick ONE provider and set its key as an environment variable (on Render: your service, Environment, Add Environment Variable). Never put a key in the code or in GitHub. With no key the tutor shows "not switched on" and the rest of the site works as before.

| Provider | Cost | Variable | Default model |
|---|---|---|---|
| Groq (recommended) | free tier, no card | `GROQ_API_KEY` (key from console.groq.com, API Keys) | `llama-3.3-70b-versatile` |
| Google Gemini | free tier, no card, but small daily limits | `GEMINI_API_KEY` (key from aistudio.google.com) | `gemini-3.5-flash-lite` |
| OpenRouter | some free models | `OPENROUTER_API_KEY` | `openrouter/free` |
| Anthropic Claude | paid | `ANTHROPIC_API_KEY` | `claude-sonnet-5-5` |

- If several keys are set, the order above wins; force one with `TUTOR_PROVIDER` (`groq`, `gemini`, `openrouter` or `anthropic`).
- `TUTOR_MODEL` overrides the model name (free model names change, so check the provider's model list if you get an error). `TUTOR_DAILY_LIMIT` is messages per student per IST day (default 40).
- Free-tier limits and model names change. Check the provider's current limits page before a big launch.
- Restart or redeploy after changing variables.

How it behaves
- Students must log in, which keeps the key from being used by strangers. Limits: 6 messages a minute, a daily allowance, one reply at a time, 12 messages of history, 1,500 characters per message.
- Phone numbers and e-mail addresses are masked before anything is sent. The username is never sent. Only the class level, the chosen subject, the Pomodoro phase and (in "Review my mistakes" mode only) the student's own recent wrong answers and accuracy go to the model.
- Voice typing: a microphone button turns speech into text (English or Hindi, following the reply-language choice) for the student to review before sending. It uses the browser's built-in speech recognition (Chrome, Edge, Safari; hidden elsewhere), which sends the audio to the browser maker's speech service, so mention it in your privacy policy. It needs HTTPS (Render provides it) and the student's permission. The site's `Permissions-Policy` header allows the microphone for this site only.
- Sprint sits out while a quiz or contest attempt is still running (the server returns a message and the button is hidden on those pages), so it cannot be used to cheat on scored answers.
- The chat history lives in the student's own browser and is cleared when a different account logs in or the student logs out. Nothing is stored on the server except a per-day message counter in memory.
- The system prompt is in `src/tutor.js`. Edit it to change Sprint's style, add exam-specific rules, or add a school's name.
- Costs and privacy: free tiers cost nothing but have limits, and the student's question goes to the provider you choose, so name that provider in your privacy policy. Free tiers may allow the provider to use prompts to improve its products (Google's Gemini free tier does), so for students who may be minors prefer a provider whose terms say API data is not used for training, and read the current terms.

## Before a public launch
Students may be minors: add a privacy policy and terms, name a moderator, and keep the Open Trivia DB (CC BY-SA) credit in the footer. One server instance is assumed, since live chat and rate limits are held in memory.

## Look and feel (frontend)
- Theme: `public/css/app.css` (colors and components), `public/css/home.css` (home page story), `public/css/fx.css` (background, cursor and hover effects, language toggle).
- Animated background and hover effects: `public/js/fx.js`. It is generated live (canvas and CSS), not a video file. Everything switches off for visitors who prefer reduced motion, and the cursor effects only run on devices with a mouse.
- Language: `public/js/i18n.js` holds the English and Hindi text. To translate another page, add keys to both dictionaries and use `t('your.key')` in that page.
- Optional fonts: see `public/css/fonts.css` (the site works without them).
