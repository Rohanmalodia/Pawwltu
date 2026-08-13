// ============================================================
//  KYP · Pawwltu — website config
//  Fill these values, then deploy. All are safe to be public.
// ============================================================
window.KYPWEB = {
  // From Supabase → Project Settings → API
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",

  // Your Cloudflare Tunnel URL for the re-ID server (see setup steps).
  // Example: https://reid.pawwltu.com  (or the temporary trycloudflare URL)
  REID_BASE: "https://reid.pawwltu.com",

  // Public base for shareable card links (must match the app's PETPASS_CARD_BASE).
  // GitHub Pages uses the static card page at /d/, so use the ?c= form:
  CARD_BASE: "https://www.pawwltu.com/d/?c=",

  // Storage bucket that holds pet photos (public bucket)
  BUCKET: "pet-media"
};
