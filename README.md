# Zyon HoloMenu — Control Panel

A production-ready admin panel for managing HoloMenu restaurants: dashboard analytics,
menu management, live orders, and QR code generation. Built with **Next.js** + **Supabase**.

## What's included
- **Dashboard** — total views, orders, average order value, conversion rate, top viewed dishes
  (matches the stats promised on the marketing site)
- **Menu** — add / edit / delete dishes, toggle availability
- **Orders** — live order list (updates in real time via Supabase Realtime), status updates
- **QR Codes** — generate a QR code per table, download as PNG to print

## 1. Set up Supabase (5 minutes)
1. Go to [supabase.com](https://supabase.com) → New project (free tier is fine to start).
2. Once it's created, open **SQL Editor → New query**, paste the contents of
   `supabase/schema.sql`, and run it. This creates all the tables and security rules.
3. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key
4. Go to **Authentication → Providers** and make sure **Email** is enabled (it is by default).
5. Create your first user: **Authentication → Users → Add user** — this is your login.
6. Then, back in **SQL Editor**, run this once (replace the values) to link that user to a restaurant:
   ```sql
   insert into restaurants (owner_id, name, slug)
   values ('paste-the-user-id-here', 'Ember & Oak', 'emberoak');
   ```
   (You can find the user's ID in **Authentication → Users**.)

## 2. Run it locally
```bash
npm install
cp .env.example .env.local
# paste your Supabase URL + anon key into .env.local
npm run dev
```
Visit `http://localhost:3000`, log in with the user you created, and you're in.

## 3. Deploy (free)
1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com) → New Project → import the repo.
3. Add the two environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   in Vercel's project settings.
4. Deploy. You'll get a live URL you (and your clients, if you make it multi-tenant) can log into.

## Notes on what's next
- **AR viewing itself** (the "View on Table" 3D preview) isn't in this panel yet — it lives on
  the customer-facing menu, which is a separate app (a public page per restaurant, no login).
  Happy to scaffold that next; it'd use `<model-viewer>` for the AR rendering and read from the
  same `dishes` table.
- **Photo upload**: dishes currently take a photo URL. Swapping in real image upload is a small
  addition using Supabase Storage — ask and I'll wire it in.
- **Multi-restaurant**: the schema already supports multiple restaurants per owner if you want to
  manage several clients from one login — the dashboard just needs a restaurant switcher added.
