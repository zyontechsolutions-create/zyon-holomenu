-- ============================================================
-- Public customer-menu access — run this AFTER schema.sql
-- Needed because customers scanning a QR code are never logged in,
-- so the owner-only policies in schema.sql don't cover them.
-- ============================================================

-- Anyone can read a restaurant by its slug (needed to load /m/[slug])
create policy "Public can read restaurants" on restaurants
  for select using (true);

-- Anyone can read qr codes (needed to validate ?table= and show the label)
create policy "Public can read qr codes" on qr_codes
  for select using (true);

-- Anonymous customers can log a menu/dish view (powers your dashboard analytics)
create policy "Public can log views" on menu_views
  for insert with check (true);

-- Anonymous customers can place an order
create policy "Public can place orders" on orders
  for insert with check (true);

create policy "Public can add order items" on order_items
  for insert with check (true);

-- Safe, scoped way to bump a QR code's scan count without opening
-- full update access to anonymous users (RLS UPDATE policies can't be
-- limited to a single column, so a function is the safer route).
create or replace function increment_qr_scan(qr_id uuid)
returns void
language sql
security definer
as $$
  update qr_codes set scans_count = scans_count + 1 where id = qr_id;
$$;
