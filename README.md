# Tulum Dinner Club

A curated restaurant directory for the **Tulum Dinner Club** — a community of food lovers exploring the best dining in Tulum, Mexico.

**Live site:** [emil.nyc/tdc](https://emil.nyc/tdc/)

## How It Works

The site is a single-page app that pulls restaurant data from a [published Google Sheet](https://docs.google.com/spreadsheets/d/1q2sIFDtXAfe-2TNAjHg9FDHzO-BFXyDXE_0Gb8-PXMc/) and renders it as a filterable card grid. No backend server or database required — the browser fetches the data directly.

### For Admins

Edit the Google Sheet to update the site. Changes appear within ~5 minutes. The expected columns are:

| Column | Type | Example |
|---|---|---|
| Venue Name | Text | `La Norteña` |
| Date | Date (YYYY-MM-DD) | `2025-12-01` |
| Maps Link | URL | `https://maps.app.goo.gl/...` |
| Instagram | Text (handle) | `lanortena_barbacha` |
| Is Rooftop? | Yes / No | `Yes` |
| Is Hotel? | Yes / No | `Yes` |
| In Market? | Text (market name) | `La Veleta` |

## Features

- **Search** — filter restaurants by name or market in real time
- **Category filters** — Rooftop, Hotel, Food Court / Market
- **Google Maps links** — tap a restaurant name to open directions
- **Instagram links** — each card links to the restaurant's profile
- **WhatsApp group** — floating button to join the community chat
- **Responsive** — 3 columns (desktop), 2 (tablet), 1 (mobile)
- **Client-side caching** — 5-minute localStorage cache for fast repeat visits

## Tech Stack

- HTML / CSS / vanilla JavaScript (no build step)
- [Bootstrap 5](https://getbootstrap.com/) — layout and responsive grid
- [Font Awesome 6](https://fontawesome.com/) — icons
- [Google Fonts](https://fonts.google.com/) — Playfair Display + Inter
- Google Sheets — published CSV as data source

## Deployment

Upload these 4 files to any web server:

```
index.html
styles.css
app.js
tdc-logo.jpg
```

No PHP, Node, or database setup needed. Works on any static host (Apache, Nginx, GitHub Pages, Netlify, etc.).

## Links

- [Instagram](https://www.instagram.com/tulumdinnerclub/)
- [WhatsApp Group](https://chat.whatsapp.com/LXM64zBVp9R7b3Xdtt2VVZ?mode=gi_t)
