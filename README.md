# online2day - Bespoke Web Development Website

A production-grade website for online2day.com, a UK-based bespoke web development company. Built with Next.js 16, TypeScript, Tailwind CSS, and Supabase.

## Features

### Marketing Website
- **Homepage** - Hero section, trust indicators, services overview, and CTAs
- **Services Page** - Detailed service offerings with process overview
- **Work Portfolio** - Showcase of example projects and case studies
- **Blog** - CMS-backed blog with article listings and individual post pages
- **About Page** - Company mission, values, and team information
- **Contact Page** - Contact form with multiple contact methods

### Authenticated Dashboard
- **Project Builder** - Multi-step project creation wizard with autosave
- **Project Management** - View, edit, and delete projects
- **Dashboard Stats** - Real-time statistics on project status
- **User Authentication** - Secure email/password authentication via Supabase

### Technical Highlights
- ⚡ **Performance-First** - Optimized for Lighthouse 90+ scores
- 🎨 **Modern Design System** - Dark theme with electric blue accent
- 📱 **Fully Responsive** - Mobile-first design approach
- 🔒 **Secure Authentication** - Supabase Auth with Row Level Security
- 💾 **Database-Backed** - PostgreSQL with Supabase for all data persistence
- 🚀 **Production Ready** - Built with Next.js 16 App Router and TypeScript

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Deployment:** Vercel
- **UI Components:** shadcn/ui
- **Icons:** Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- Supabase account with project created

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables (configured via Vercel integration)

4. Run database migrations:
   - Execute the SQL scripts in the `/scripts` folder in your Supabase SQL Editor:
     1. `001_create_projects_table.sql`
     2. `002_create_blog_posts_table.sql`
     3. `003_seed_blog_posts.sql`

5. Start the development server:
   ```bash
   pnpm dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Database Schema

### Projects Table
Stores user project submissions with full CRUD support and RLS policies.

### Blog Posts Table
Stores blog articles with support for categories, excerpts, and published status.

## Project Structure

```
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── sign-up/
│   │   └── error/
│   ├── dashboard/
│   │   ├── projects/
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   └── page.tsx
│   ├── blog/
│   │   ├── [slug]/
│   │   └── page.tsx
│   ├── services/
│   ├── work/
│   ├── about/
│   ├── contact/
│   └── page.tsx
├── components/
│   ├── dashboard/
│   ├── ui/
│   ├── header.tsx
│   └── footer.tsx
├── lib/
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       └── proxy.ts
└── scripts/
    ├── 001_create_projects_table.sql
    ├── 002_create_blog_posts_table.sql
    └── 003_seed_blog_posts.sql
```

## Key Features Implementation

### Authentication
- Email/password authentication via Supabase
- Protected routes with middleware
- Session management with automatic token refresh

### Project Builder
- Multi-field project creation form
- Autosave functionality (2-second debounce)
- Status tracking (draft, in progress, completed)
- Full CRUD operations with RLS

### Blog CMS
- Database-backed blog posts
- SEO-friendly slugs
- Category support
- Reading time estimates
- Published/draft status

## Performance Optimizations

- Server Components by default
- Optimized images and fonts
- Minimal JavaScript bundle
- CSS-only animations where possible
- Efficient database queries with proper indexing

## Security

- Row Level Security (RLS) on all tables
- Server-side authentication checks
- Secure session management
- Input validation and sanitization
- HTTPS-only in production

## License

Proprietary - All rights reserved by online2day

## Support

For questions or support, contact info@online2day.com
