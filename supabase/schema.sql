-- Zyon HoloMenu — Supabase schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

create extension if not exists "uuid-ossp";

-- One row per client restaurant using HoloMenu
create table restaurants (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) not null,
  name text not null,
  slug text unique not null,          -- used in the public menu URL, e.g. /m/emberoak
  plan text default 'starter',        -- starter | growth | full
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  name text not null,
  sort_order int default 0
);

create table dishes (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  description text,
  price numeric(10,2) not null,
  photo_url text,
  ar_enabled boolean default false,   -- true once this dish has an AR asset
  ar_model_url text,                  -- .glb/.usdz model, added once AR is set up
  is_available boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table qr_codes (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  label text not null,                -- e.g. "Table 4"
  scans_count int default 0,
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  qr_code_id uuid references qr_codes(id) on delete set null,
  status text default 'new',          -- new | preparing | served | cancelled
  total numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade not null,
  dish_id uuid references dishes(id) not null,
  quantity int default 1,
  price_at_order numeric(10,2) not null
);

-- Every menu/dish view, so the dashboard can compute "Top Viewed Dishes"
create table menu_views (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants(id) on delete cascade not null,
  dish_id uuid references dishes(id) on delete cascade,
  viewed_ar boolean default false,    -- true if they tapped "View on Table"
  created_at timestamptz default now()
);

-- Row Level Security: each restaurant owner only sees their own data
alter table restaurants enable row level security;
alter table categories enable row level security;
alter table dishes enable row level security;
alter table qr_codes enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table menu_views enable row level security;

create policy "Owners manage their restaurant" on restaurants
  for all using (auth.uid() = owner_id);

create policy "Owners manage their categories" on categories
  for all using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "Owners manage their dishes" on dishes
  for all using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "Owners manage their qr codes" on qr_codes
  for all using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "Owners manage their orders" on orders
  for all using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "Owners view their order items" on order_items
  for all using (order_id in (select id from orders where restaurant_id in
    (select id from restaurants where owner_id = auth.uid())));

create policy "Owners view their menu analytics" on menu_views
  for all using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Public read access for dishes/categories (needed for the customer-facing menu, added later)
create policy "Public can read available dishes" on dishes
  for select using (is_available = true);

create policy "Public can read categories" on categories
  for select using (true);
