-- Create blog_posts table for CMS
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  content text not null,
  author_name text not null default 'online2day Team',
  cover_image text,
  tags text[] default array[]::text[],
  published boolean not null default false,
  published_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.blog_posts enable row level security;

-- Create policies - anyone can read published posts, but only authenticated users can manage
create policy "Anyone can view published blog posts"
  on public.blog_posts for select
  using (published = true);

create policy "Authenticated users can view all blog posts"
  on public.blog_posts for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert blog posts"
  on public.blog_posts for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update blog posts"
  on public.blog_posts for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can delete blog posts"
  on public.blog_posts for delete
  using (auth.role() = 'authenticated');

-- Create indexes for performance
create index if not exists blog_posts_slug_idx on public.blog_posts(slug);
create index if not exists blog_posts_published_idx on public.blog_posts(published);
create index if not exists blog_posts_published_at_idx on public.blog_posts(published_at desc);
create index if not exists blog_posts_tags_idx on public.blog_posts using gin(tags);

-- Reuse the updated_at trigger
drop trigger if exists on_blog_posts_updated on public.blog_posts;
create trigger on_blog_posts_updated
  before update on public.blog_posts
  for each row
  execute function public.handle_updated_at();
