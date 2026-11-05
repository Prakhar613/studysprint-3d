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
Variables: `PORT`, `DATA_DIR`, `TRUST_PROXY` (true only behind your own proxy), `ADMIN_USERS` (usernames who can remove chat messages and posts), `SYNC_QUESTIONS=false`, `CONTACT_EMAIL`.

## Before a public launch
Students may be minors: add a privacy policy and terms, name a moderator, and keep the Open Trivia DB (CC BY-SA) credit in the footer. One server instance is assumed, since live chat and rate limits are held in memory.

## Look and feel (frontend)
- Theme: `public/css/app.css` (colors and components), `public/css/home.css` (home page story), `public/css/fx.css` (background, cursor and hover effects, language toggle).
- Animated background and hover effects: `public/js/fx.js`. It is generated live (canvas and CSS), not a video file. Everything switches off for visitors who prefer reduced motion, and the cursor effects only run on devices with a mouse.
- Language: `public/js/i18n.js` holds the English and Hindi text. To translate another page, add keys to both dictionaries and use `t('your.key')` in that page.
- Optional fonts: see `public/css/fonts.css` (the site works without them).
