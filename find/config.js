// ============================================================
//  KYP · Pawwltu — website config
//  Fill these values, then deploy. All are safe to be public.
// ============================================================
window.KYPWEB = {
  // From Supabase → Project Settings → API
  SUPABASE_URL: "https://xmlcyxdmctnfviufoghm.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtbGN5eGRtY3RuZnZpdWZvZ2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTgwOTgsImV4cCI6MjEwMTQzNDA5OH0.fKFBZ0blr1JMZofwUOdUeKsQYQnchA9jd_yu-HbX3bk",


  // Your Cloudflare Tunnel URL for the re-ID server (see setup steps).
  // Example: https://reid.pawwltu.com  (or the temporary trycloudflare URL)
  REID_BASE: "https://reid.pawwltu.com",

  // Public base for shareable card links (must match the app's PETPASS_CARD_BASE).
  // GitHub Pages uses the static card page at /d/, so use the ?c= form:
  CARD_BASE: "https://www.pawwltu.com/d/?c=",

  // Storage bucket that holds pet photos (public bucket)
  BUCKET: "pet-media"
};
