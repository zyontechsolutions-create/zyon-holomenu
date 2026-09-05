-- ============================================================
-- Zyon Admin Panel — run this AFTER schema.sql and public_access_policies.sql
-- ============================================================

-- Marks which logins are Zyon staff (not restaurant owners).
-- A user can be both an admin AND a restaurant owner if you want.
create table zyon_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table zyon_admins enable row level security;

-- Anyone can check whether THEY are an admin (needed so the app can show/hide the Admin link)
create policy "Users can check their own admin status" on zyon_admins
  for select using (user_id = auth.uid());

-- ---- Add yourself as the first admin ----
-- Replace the UUID below with your own user ID (Supabase > Authentication > Users > copy UID)
-- insert into zyon_admins (user_id) values ('PASTE-YOUR-UID-HERE');


-- ============================================================
-- Give admins full access across every restaurant's data,
-- on top of the existing owner-only policies (these are added,
-- not replacements — Postgres OR's every matching policy together).
-- ============================================================

create policy "Admins manage all restaurants" on restaurants
  for all using (exists (select 1 from zyon_admins where user_id = auth.uid()));

create policy "Admins manage all categories" on categories
  for all using (exists (select 1 from zyon_admins where user_id = auth.uid()));

create policy "Admins manage all dishes" on dishes
  for all using (exists (select 1 from zyon_admins where user_id = auth.uid()));

create policy "Admins manage all qr codes" on qr_codes
  for all using (exists (select 1 from zyon_admins where user_id = auth.uid()));

create policy "Admins manage all orders" on orders
  for all using (exists (select 1 from zyon_admins where user_id = auth.uid()));

create policy "Admins manage all order items" on order_items
  for all using (exists (select 1 from zyon_admins where user_id = auth.uid()));

create policy "Admins view all menu analytics" on menu_views
  for all using (exists (select 1 from zyon_admins where user_id = auth.uid()));
