# Takto

> AI-powered content ideas for UGC creators. No more creator's block.

## Tech Stack
- **Frontend**: React + Vite (no extra UI libraries)
- **Auth + Database**: Supabase
- **AI**: Claude (Anthropic) via secure serverless proxy
- **Hosting**: Vercel (free tier)

---

## Local Development

### 1. Clone and install
```bash
git clone https://github.com/apptakto/takto.git
cd takto
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

> For local AI features, you'll need Vercel CLI (`npm i -g vercel && vercel dev`) 
> which runs the `/api/claude.js` proxy with your Vercel env vars.

### 3. Run
```bash
npm run dev
```

---

## Supabase Setup

You need two tables. Run this SQL in your Supabase SQL editor:

```sql
-- Profiles table
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  niche text[],
  style text[],
  posting_frequency text,
  notifications_enabled boolean default true,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Content ideas table
create table content_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  status text default 'pending',
  date_scheduled date,
  special_occasion text,
  difficulty text,
  created_at timestamptz default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table content_ideas enable row level security;

create policy "Users can manage own profile"
  on profiles for all using (auth.uid() = user_id);

create policy "Users can manage own ideas"
  on content_ideas for all using (auth.uid() = user_id);
```

---

## Deploy to Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → Add New Project → import `apptakto/takto`
3. Add Environment Variables in Vercel dashboard:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` ← **no VITE_ prefix — server only** |

4. Deploy ✓

---

## App Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Auth | `#/auth` | Sign in, sign up, forgot password + Google OAuth |
| Onboarding | `#/onboarding` | 4-step setup: niche → style → frequency → notifications |
| Dashboard | `#/dashboard` | AI idea cards + week timeline |
| Explore | `#/explore` | Creator inspiration grid |
| Generate | `#/generate` | AI chat — trending prompts + special occasions |
| Calendar | `#/calendar` | Drag-and-drop monthly schedule |
| Profile | `#/profile` | Edit settings |
