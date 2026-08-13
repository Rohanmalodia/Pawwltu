# Pawwltu website (GitHub Pages)

Public site to **search / identify / view** dogs. Registration stays in the app.

## Files
- `index.html`  — main site (search, photo detect, lost dogs)
- `site.js`     — site logic
- `config.js`   — EDIT THIS (Supabase URL + anon key, re-ID URL, card base)
- `d/index.html`— shareable card page (opens at /d/?c=CODE)
- `functions/`  — only used on Cloudflare Pages; GitHub Pages ignores it (safe to keep or delete)

## Layman steps
1. Unzip. Open `config.js`, paste your Supabase URL + anon key, your re-ID tunnel
   URL, and keep CARD_BASE as https://www.pawwltu.com/d/?c=
2. Copy ALL these files into your GitHub Pages repo (same folder your site serves from).
3. Commit + push. Wait ~1 minute for GitHub to publish.
4. Visit your site — done.
5. In the app config.js set PETPASS_CARD_BASE = "https://www.pawwltu.com/d/?c="
6. Run the SQL from chat in Supabase.

Note: On GitHub Pages the shared link opens the card fine, but the small preview
thumbnail inside WhatsApp/Instagram won't show (static hosting can't pre-fill it).
If you want that thumbnail, host the same files on Cloudflare Pages instead — the
included functions/d/[code].js handles it automatically.
