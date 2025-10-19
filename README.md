# 82-Day Clean Tracker — Project

This repository contains the **client** (static site) and **server** (Node.js) for the Clean Tracker app.

## Goals for this release
- Keep previous releases intact; **do not overwrite** older versions. Use tags and branches.
- Client: multi-page static site (home, challenge, add, settings), responsive, uses localStorage for offline and optional sync to server.
- Server: Express.js endpoints for subscriptions, emails, user accounts (email link), import/export, and basic persistence (lowdb).
- Push notifications via Web Push (vapid) and email reminders via nodemailer.
- Easy deploy: static client -> GitHub Pages / Netlify; server -> Render/Heroku/Vercel.

## How to use
1. Clone repo.
2. Client: `cd client` and open `index.html` locally to test or deploy to GitHub Pages.
3. Server: `cd server && npm install && npm start` after configuring `.env`.

## Versioning policy (important)
- **Never change existing release files**: create a new commit and tag like `v1.0.1` for improvements.
- Keep a `releases/` folder with zip copies of production-ready builds to preserve them.
- Use branches: `main` = production, `dev` = active improvements, `archive/vX.Y.Z` to store immutable snapshots.

## Deploy notes
- Static client -> GitHub Pages (serve `/client` folder) or Netlify.
- Server -> Render/Heroku, set environment variables from `.env.example`.