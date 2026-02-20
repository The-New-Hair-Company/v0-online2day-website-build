-- Insert sample blog posts for the CMS
insert into public.blog_posts (slug, title, excerpt, content, author_name, tags, published, published_at) values
(
  'why-performance-matters',
  'Why Performance Matters in Web Development',
  'Exploring how site performance impacts user experience, conversion rates, and SEO rankings.',
  'In today''s fast-paced digital landscape, performance is not just a technical metric—it''s a business imperative. Users expect websites to load in under 2 seconds, and every 100ms delay can impact conversion rates by up to 1%.

At online2day, we prioritize performance from day one. We use modern frameworks like Next.js, optimize images with next/image, implement code splitting, and ensure our sites achieve Lighthouse scores of 90+.

Performance optimization includes:
- Minimal JavaScript bundle sizes
- Lazy loading for images and components  
- Server-side rendering for initial page loads
- CDN distribution for global reach
- Database query optimization

The result? Faster sites that rank higher in search engines, convert better, and provide exceptional user experiences.',
  'Sarah Johnson',
  array['Performance', 'Web Development', 'Best Practices'],
  true,
  timezone('utc'::text, now()) - interval '7 days'
),
(
  'modern-authentication-patterns',
  'Modern Authentication Patterns for Web Apps',
  'A deep dive into secure authentication strategies using Supabase and modern frameworks.',
  'Authentication is the cornerstone of any web application. Getting it right means balancing security, user experience, and maintainability.

We leverage Supabase Auth for robust, scalable authentication that includes:
- Email/password authentication with secure hashing
- Magic link authentication for passwordless login
- OAuth providers (Google, GitHub, etc.)
- Row Level Security (RLS) for data protection
- JWT-based session management

Key considerations:
1. Always use HTTPS in production
2. Implement proper password policies
3. Enable email verification
4. Use Row Level Security to protect user data
5. Handle auth state properly on client and server

With Next.js 16 and Supabase, we can build authentication flows that are both secure and provide seamless user experiences across all devices.',
  'Alex Chen',
  array['Authentication', 'Security', 'Supabase'],
  true,
  timezone('utc'::text, now()) - interval '14 days'
),
(
  'choosing-the-right-tech-stack',
  'Choosing the Right Tech Stack for Your Project',
  'How we evaluate and select technologies that align with your business goals.',
  'Every project is unique, and selecting the right technology stack can make or break your success. At online2day, we don''t believe in one-size-fits-all solutions.

Our evaluation framework considers:

**Project Requirements**
- Performance needs
- Scalability requirements  
- Team expertise
- Time to market
- Budget constraints

**Our Preferred Stack**
- Next.js for server-side rendering and routing
- TypeScript for type safety
- Tailwind CSS for rapid styling
- Supabase for database and authentication
- Vercel for deployment and hosting

**Why This Stack?**
- Excellent developer experience
- Outstanding performance out of the box
- Strong community support
- Scalable from MVP to enterprise
- Cost-effective for startups

We stay framework-agnostic and choose tools based on your specific needs, not trends or personal preferences.',
  'online2day Team',
  array['Technology', 'Strategy', 'Web Development'],
  true,
  timezone('utc'::text, now()) - interval '21 days'
);
