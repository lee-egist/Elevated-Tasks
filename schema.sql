-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS vector; -- Uncomment if using pgvector for entity_embeddings

-- ==========================================
-- 1. CORE MULTI-TENANT & IDENTITY
-- ==========================================

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.user_profiles (
  email text PRIMARY KEY,
  display_name text,
  weekly_capacity_hours numeric DEFAULT 40.0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.external_identities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email text REFERENCES public.user_profiles(email) ON DELETE CASCADE,
  provider text NOT NULL, -- e.g., 'google', 'slack'
  external_id text NOT NULL,
  UNIQUE(provider, external_id)
);

CREATE TABLE public.organization_members (
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_email text REFERENCES public.user_profiles(email) ON DELETE CASCADE,
  org_role text DEFAULT 'member' CHECK (org_role IN ('admin', 'member', 'guest')),
  PRIMARY KEY (organization_id, user_email)
);

-- ==========================================
-- 2. PROJECTS & GOALS (Restored)
-- ==========================================

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  owner_email text REFERENCES public.user_profiles(email),
  status text DEFAULT 'planning',
  start_date date,
  target_date date,
  is_system_managed boolean DEFAULT false, 
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.project_members (
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  user_email text REFERENCES public.user_profiles(email) ON DELETE CASCADE,
  access_level text CHECK (access_level IN ('view', 'comment', 'edit', 'admin')),
  PRIMARY KEY (project_id, user_email)
);

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  level text NOT NULL CHECK (level IN ('organization', 'project')),
  is_private boolean DEFAULT false,
  target_value numeric NOT NULL,
  current_value numeric DEFAULT 0,
  unit text,
  status text DEFAULT 'on_track',
  start_date date,
  deadline date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.goal_members (
  goal_id uuid REFERENCES public.goals(id) ON DELETE CASCADE,
  user_email text REFERENCES public.user_profiles(email) ON DELETE CASCADE,
  access_level text CHECK (access_level IN ('view', 'edit', 'admin')),
  PRIMARY KEY (goal_id, user_email)
);

-- ==========================================
-- 3. TASKS & TIME TRACKING (Restored)
-- ==========================================

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee text REFERENCES public.user_profiles(email),
  owner text REFERENCES public.user_profiles(email),
  status text DEFAULT 'open',
  priority text DEFAULT 'medium',
  type text DEFAULT 'general',
  start_date date,
  due_date date,
  estimated_hours numeric DEFAULT 0,
  assigned_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  blocked_by uuid REFERENCES public.tasks(id),
  google_task_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tasks_no_self_block CHECK (id <> blocked_by)
);

CREATE TABLE public.task_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_email text NOT NULL REFERENCES public.user_profiles(email),
  hours_spent numeric NOT NULL CHECK (hours_spent > 0),
  logged_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 4. AI, NLP & ML KNOWLEDGE BASE
-- ==========================================

CREATE TABLE public.inbox_buffer (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email text REFERENCES public.user_profiles(email),
  raw_text text NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'processed', 'failed'
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.task_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  recorded_at timestamp with time zone DEFAULT now(),
  status_at_time text,
  remaining_hours_estimate numeric,
  was_blocked boolean DEFAULT false
);

CREATE TABLE public.context_threads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_url text,
  summary_text text,
  raw_json_metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.task_context_links (
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.context_threads(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, thread_id)
);

-- Requires pgvector extension enabled
CREATE TABLE public.entity_embeddings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id uuid NOT NULL, 
  entity_type text NOT NULL, -- 'task', 'goal', 'comment', 'project'
  content_hash text, 
  -- embedding vector(1536), -- Uncomment once pgvector is installed
  created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 5. RISK MANAGEMENT
-- ==========================================

CREATE TABLE public.risk_factors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  category text NOT NULL, 
  name text NOT NULL UNIQUE,
  base_mitigation_strategy text, 
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.task_risks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  risk_factor_id uuid NOT NULL REFERENCES public.risk_factors(id),
  ai_confidence_score numeric, 
  probability_score int CHECK (probability_score BETWEEN 1 AND 5),
  impact_score int CHECK (impact_score BETWEEN 1 AND 5),
  is_mitigated boolean DEFAULT false,
  detected_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.risk_mitigation_suggestions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_risk_id uuid NOT NULL REFERENCES public.task_risks(id) ON DELETE CASCADE,
  suggestion_text text NOT NULL,
  status text DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'rejected', 'implemented')),
  was_effective boolean, 
  created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 6. INDEX OPTIMIZATIONS (Performance)
-- ==========================================

-- Core Lookups (Fetching all projects in an org, tasks in a project, etc.)
CREATE INDEX idx_projects_org_id ON public.projects(organization_id);
CREATE INDEX idx_goals_org_id ON public.goals(organization_id);
CREATE INDEX idx_goals_project_id ON public.goals(project_id);
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee);
CREATE INDEX idx_task_logs_task_id ON public.task_logs(task_id);

-- Junction Table Lookups (Ensures querying user permissions is lightning fast)
CREATE INDEX idx_org_members_user ON public.organization_members(user_email);
CREATE INDEX idx_project_members_user ON public.project_members(user_email);
CREATE INDEX idx_goal_members_user ON public.goal_members(user_email);

-- AI & AI Context Fast Lookups
CREATE INDEX idx_task_snapshots_task_id ON public.task_snapshots(task_id);
CREATE INDEX idx_task_context_links_thread_id ON public.task_context_links(thread_id); -- Critical reverse index
CREATE INDEX idx_entity_embeddings_entity_id ON public.entity_embeddings(entity_id);

-- Risk Management Lookups
CREATE INDEX idx_task_risks_task_id ON public.task_risks(task_id);
CREATE INDEX idx_task_risks_risk_factor_id ON public.task_risks(risk_factor_id);