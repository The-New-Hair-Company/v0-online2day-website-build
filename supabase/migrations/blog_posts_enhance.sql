-- Blog posts: add missing columns for cover image, author, tags, and SEO overrides
-- Run this in Supabase SQL Editor (safe — uses IF NOT EXISTS / IF NOT EXISTS guards)

create table if not exists blog_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  excerpt      text,
  content      text,            -- HTML (paste from any editor or write directly)
  category     text,
  published    boolean not null default false,
  published_at timestamptz,
  read_time    int,             -- estimated minutes
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- New columns (safe to run even if table already exists with some columns)
alter table blog_posts
  add column if not exists cover_url    text,          -- hero / OG image URL
  add column if not exists author_name  text not null default 'Online2Day Team',
  add column if not exists author_role  text not null default 'Online2Day',
  add column if not exists tags         text[] not null default '{}',  -- e.g. '{"SEO","Web Dev"}'
  add column if not exists seo_title    text,          -- overrides <title> tag if set
  add column if not exists seo_desc     text,          -- overrides meta description if set
  add column if not exists updated_at   timestamptz default now();

-- Row-level security: anyone can read published posts, no anonymous writes
alter table blog_posts enable row level security;

drop policy if exists "Public read published posts" on blog_posts;
create policy "Public read published posts"
  on blog_posts for select
  using (published = true);

-- Index for fast slug lookup (used on every post page)
create unique index if not exists blog_posts_slug_idx on blog_posts (slug);
create index if not exists blog_posts_published_at_idx on blog_posts (published_at desc)
  where published = true;

-- ─── HOW TO ADD A BLOG POST ───────────────────────────────────────────────────
--
-- Option 1 — Supabase Table Editor (easiest)
--   Open Table Editor → blog_posts → Insert row
--   Fill in: slug, title, excerpt, content (HTML), category, cover_url,
--            author_name, read_time, tags, published=true, published_at=now()
--
-- Option 2 — SQL
--   insert into blog_posts (slug, title, excerpt, content, category, cover_url,
--                           author_name, read_time, tags, published, published_at)
--   values (
--     'my-post-slug',
--     'My Post Title',
--     'One sentence that appears in cards and meta description.',
--     '<h2>Introduction</h2><p>Your HTML content here...</p>',
--     'Web Development',
--     'https://images.unsplash.com/...',   -- or leave null
--     'Oliver King',
--     5,
--     '{"SEO","Next.js"}',
--     true,
--     now()
--   );
--
-- ─── CONTENT FORMAT ───────────────────────────────────────────────────────────
--
-- The `content` column stores HTML. You can write it directly, or:
-- • Export from Notion → "HTML" export, paste the <body> content
-- • Write in any rich-text editor and copy the HTML source
-- • Use the Tiptap editor already in the project (dashboard) and copy output
--
-- Supported HTML tags: h2 h3 h4 p ul ol li blockquote code pre strong em a img hr
-- All styled automatically by the .prose-content CSS class.
--
-- ─── SLUG RULES ──────────────────────────────────────────────────────────────
--
-- slug = the URL segment: online2day.com/blog/<slug>
-- Use lowercase kebab-case: "how-we-build-fast-websites"
-- Must be unique. No spaces, no capitals.
