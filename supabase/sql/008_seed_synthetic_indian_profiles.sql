-- Synthetic Indian demo profiles for local/testing environments.
-- These rows intentionally avoid storing any government-issued identity numbers.

insert into public.users (
  id,
  username,
  email,
  password_hash,
  full_name,
  bio,
  professional_role,
  human_verification_status,
  human_verification_provider,
  human_verified_at,
  human_verification_evidence,
  created_at
)
values
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea01',
    'aarya.sharma',
    'aarya.sharma@luminas-demo.test',
    extensions.crypt('DemoPass123!', extensions.gen_salt('bf')),
    'Aarya Sharma',
    'Frontend engineer in Bengaluru building polished React experiences for fintech and creator tools.',
    'Frontend Engineer',
    'verified',
    'seed',
    timezone('utc', now()) - interval '21 days',
    jsonb_build_object('seeded', true, 'synthetic_profile', true, 'region', 'india'),
    timezone('utc', now()) - interval '28 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea02',
    'rohan.mehta',
    'rohan.mehta@luminas-demo.test',
    extensions.crypt('DemoPass123!', extensions.gen_salt('bf')),
    'Rohan Mehta',
    'Product manager from Mumbai focused on B2B SaaS onboarding, activation, and customer discovery.',
    'Product Manager',
    'verified',
    'seed',
    timezone('utc', now()) - interval '18 days',
    jsonb_build_object('seeded', true, 'synthetic_profile', true, 'region', 'india'),
    timezone('utc', now()) - interval '24 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea03',
    'kavya.iyer',
    'kavya.iyer@luminas-demo.test',
    extensions.crypt('DemoPass123!', extensions.gen_salt('bf')),
    'Kavya Iyer',
    'ML engineer in Chennai working on recommendation systems, retrieval pipelines, and evaluation loops.',
    'ML Engineer',
    'verified',
    'seed',
    timezone('utc', now()) - interval '17 days',
    jsonb_build_object('seeded', true, 'synthetic_profile', true, 'region', 'india'),
    timezone('utc', now()) - interval '22 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea04',
    'arjun.patel',
    'arjun.patel@luminas-demo.test',
    extensions.crypt('DemoPass123!', extensions.gen_salt('bf')),
    'Arjun Patel',
    'Growth marketer in Ahmedabad helping early-stage products improve lifecycle journeys and paid experiments.',
    'Growth Marketer',
    'verified',
    'seed',
    timezone('utc', now()) - interval '16 days',
    jsonb_build_object('seeded', true, 'synthetic_profile', true, 'region', 'india'),
    timezone('utc', now()) - interval '20 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea05',
    'sneha.reddy',
    'sneha.reddy@luminas-demo.test',
    extensions.crypt('DemoPass123!', extensions.gen_salt('bf')),
    'Sneha Reddy',
    'Startup founder from Hyderabad building workflow products for operations teams and distributed support orgs.',
    'Founder',
    'verified',
    'seed',
    timezone('utc', now()) - interval '14 days',
    jsonb_build_object('seeded', true, 'synthetic_profile', true, 'region', 'india'),
    timezone('utc', now()) - interval '19 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea06',
    'imran.khan',
    'imran.khan@luminas-demo.test',
    extensions.crypt('DemoPass123!', extensions.gen_salt('bf')),
    'Imran Khan',
    'Backend engineer in Pune building reliable APIs, background jobs, and event-driven platform services.',
    'Backend Engineer',
    'verified',
    'seed',
    timezone('utc', now()) - interval '12 days',
    jsonb_build_object('seeded', true, 'synthetic_profile', true, 'region', 'india'),
    timezone('utc', now()) - interval '17 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea07',
    'neha.verma',
    'neha.verma@luminas-demo.test',
    extensions.crypt('DemoPass123!', extensions.gen_salt('bf')),
    'Neha Verma',
    'UX designer in Delhi working on mobile-first onboarding, accessibility, and conversion-focused flows.',
    'Product Designer',
    'verified',
    'seed',
    timezone('utc', now()) - interval '10 days',
    jsonb_build_object('seeded', true, 'synthetic_profile', true, 'region', 'india'),
    timezone('utc', now()) - interval '15 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea08',
    'dev.menon',
    'dev.menon@luminas-demo.test',
    extensions.crypt('DemoPass123!', extensions.gen_salt('bf')),
    'Dev Menon',
    'Data analyst in Kochi focused on experimentation dashboards, retention reporting, and GTM insights.',
    'Data Analyst',
    'verified',
    'seed',
    timezone('utc', now()) - interval '8 days',
    jsonb_build_object('seeded', true, 'synthetic_profile', true, 'region', 'india'),
    timezone('utc', now()) - interval '13 days'
  )
on conflict (id) do update
set
  username = excluded.username,
  email = excluded.email,
  password_hash = excluded.password_hash,
  full_name = excluded.full_name,
  bio = excluded.bio,
  professional_role = excluded.professional_role,
  human_verification_status = excluded.human_verification_status,
  human_verification_provider = excluded.human_verification_provider,
  human_verified_at = excluded.human_verified_at,
  human_verification_evidence = excluded.human_verification_evidence,
  created_at = excluded.created_at;

insert into public.user_settings (
  user_id,
  profile_photo_url,
  skilled_domains,
  preferred_suggestions,
  created_at,
  updated_at
)
values
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea01',
    'https://i.pravatar.cc/400?img=11',
    array['React', 'TypeScript', 'Design Systems'],
    array['recruiter', 'founder'],
    timezone('utc', now()) - interval '27 days',
    timezone('utc', now()) - interval '5 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea02',
    'https://i.pravatar.cc/400?img=12',
    array['Product Strategy', 'B2B SaaS', 'User Research'],
    array['founder', 'advisor'],
    timezone('utc', now()) - interval '23 days',
    timezone('utc', now()) - interval '4 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea03',
    'https://i.pravatar.cc/400?img=13',
    array['Machine Learning', 'Python', 'RAG Systems'],
    array['founder', 'recruiter'],
    timezone('utc', now()) - interval '21 days',
    timezone('utc', now()) - interval '3 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea04',
    'https://i.pravatar.cc/400?img=14',
    array['Growth Marketing', 'Performance Ads', 'Lifecycle CRM'],
    array['founder', 'advisor'],
    timezone('utc', now()) - interval '19 days',
    timezone('utc', now()) - interval '3 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea05',
    'https://i.pravatar.cc/400?img=15',
    array['Operations', 'SaaS', 'Customer Support'],
    array['investor', 'advisor'],
    timezone('utc', now()) - interval '18 days',
    timezone('utc', now()) - interval '2 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea06',
    'https://i.pravatar.cc/400?img=16',
    array['Node.js', 'Postgres', 'Distributed Systems'],
    array['recruiter', 'founder'],
    timezone('utc', now()) - interval '16 days',
    timezone('utc', now()) - interval '2 days'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea07',
    'https://i.pravatar.cc/400?img=17',
    array['UX Design', 'Figma', 'Mobile UX'],
    array['founder', 'recruiter'],
    timezone('utc', now()) - interval '14 days',
    timezone('utc', now()) - interval '1 day'
  ),
  (
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea08',
    'https://i.pravatar.cc/400?img=18',
    array['Analytics', 'SQL', 'Experimentation'],
    array['founder', 'recruiter'],
    timezone('utc', now()) - interval '12 days',
    timezone('utc', now()) - interval '1 day'
  )
on conflict (user_id) do update
set
  profile_photo_url = excluded.profile_photo_url,
  skilled_domains = excluded.skilled_domains,
  preferred_suggestions = excluded.preferred_suggestions,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.user_experiences (
  id,
  user_id,
  title,
  organization,
  period,
  summary,
  created_at
)
values
  (
    '2ab6b614-9181-4d39-9306-7ab10fcf4701',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea01',
    'Senior Frontend Engineer',
    'FinCraft Labs',
    '2023 - Present',
    'Leading the React migration for merchant-facing dashboards and improving page performance across high-traffic workflows.',
    timezone('utc', now()) - interval '26 days'
  ),
  (
    '2ab6b614-9181-4d39-9306-7ab10fcf4702',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea02',
    'Product Manager',
    'SaaSBridge',
    '2022 - Present',
    'Owns onboarding and activation funnels for an India-focused SMB finance platform with weekly experiment reviews.',
    timezone('utc', now()) - interval '22 days'
  ),
  (
    '2ab6b614-9181-4d39-9306-7ab10fcf4703',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea03',
    'ML Engineer',
    'VectorLeap AI',
    '2021 - Present',
    'Built retrieval and ranking pipelines for support automation and internal knowledge search use cases.',
    timezone('utc', now()) - interval '20 days'
  ),
  (
    '2ab6b614-9181-4d39-9306-7ab10fcf4704',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea04',
    'Growth Lead',
    'Launchlane',
    '2022 - Present',
    'Runs paid, lifecycle, and referral growth experiments for a startup-focused productivity suite.',
    timezone('utc', now()) - interval '18 days'
  ),
  (
    '2ab6b614-9181-4d39-9306-7ab10fcf4705',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea05',
    'Founder',
    'OpsNest',
    '2024 - Present',
    'Building internal tooling for distributed operations teams with a focus on response quality and process visibility.',
    timezone('utc', now()) - interval '17 days'
  ),
  (
    '2ab6b614-9181-4d39-9306-7ab10fcf4706',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea06',
    'Backend Engineer',
    'ScaleForge',
    '2021 - Present',
    'Maintains APIs and background workers for real-time reporting and partner integrations.',
    timezone('utc', now()) - interval '15 days'
  ),
  (
    '2ab6b614-9181-4d39-9306-7ab10fcf4707',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea07',
    'Product Designer',
    'PixelMint',
    '2022 - Present',
    'Designs onboarding, upgrade, and self-serve admin flows for SaaS products serving distributed teams.',
    timezone('utc', now()) - interval '13 days'
  ),
  (
    '2ab6b614-9181-4d39-9306-7ab10fcf4708',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea08',
    'Data Analyst',
    'MetricHarbor',
    '2023 - Present',
    'Builds SQL models and dashboards for retention, conversion, and experiment readouts.',
    timezone('utc', now()) - interval '11 days'
  )
on conflict (id) do update
set
  user_id = excluded.user_id,
  title = excluded.title,
  organization = excluded.organization,
  period = excluded.period,
  summary = excluded.summary,
  created_at = excluded.created_at;

insert into public.skill_posts (
  id,
  author_id,
  skilled_domain,
  content,
  media_items,
  created_at
)
values
  (
    '36165f31-86b1-49c4-8f77-6dc950551001',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea01',
    'React',
    'Wrapped up a dashboard cleanup that cut render churn on our analytics filters. Small UI details made a big difference for power users.',
    jsonb_build_array(
      jsonb_build_object(
        'kind', 'image',
        'url', 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80'
      )
    ),
    timezone('utc', now()) - interval '6 days'
  ),
  (
    '36165f31-86b1-49c4-8f77-6dc950551002',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea02',
    'Product Strategy',
    'Testing a shorter onboarding path for SMB admins this week. Curious how others balance first-value speed with collecting enough setup context.',
    jsonb_build_array(
      jsonb_build_object(
        'kind', 'image',
        'url', 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80'
      )
    ),
    timezone('utc', now()) - interval '5 days 12 hours'
  ),
  (
    '36165f31-86b1-49c4-8f77-6dc950551003',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea03',
    'Machine Learning',
    'Spent the week comparing reranking strategies for a support copilot. Evaluation quality improved once we separated intent-heavy queries from troubleshooting flows.',
    '[]'::jsonb,
    timezone('utc', now()) - interval '5 days'
  ),
  (
    '36165f31-86b1-49c4-8f77-6dc950551004',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea04',
    'Growth Marketing',
    'One lifecycle change that keeps winning for us: clearer milestone messaging in the first 7 days. Activation lifts were better than another discount test.',
    jsonb_build_array(
      jsonb_build_object(
        'kind', 'image',
        'url', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80'
      )
    ),
    timezone('utc', now()) - interval '4 days 10 hours'
  ),
  (
    '36165f31-86b1-49c4-8f77-6dc950551005',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea05',
    'Operations',
    'Hiring for a founding ops generalist soon. Looking for someone who enjoys ambiguity, process design, and working closely with product and support.',
    jsonb_build_array(
      jsonb_build_object(
        'kind', 'image',
        'url', 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80'
      )
    ),
    timezone('utc', now()) - interval '4 days'
  ),
  (
    '36165f31-86b1-49c4-8f77-6dc950551006',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea06',
    'Node.js',
    'We replaced a slow polling path with event-driven updates and finally reduced noisy retries in one of our partner sync jobs.',
    '[]'::jsonb,
    timezone('utc', now()) - interval '3 days 8 hours'
  ),
  (
    '36165f31-86b1-49c4-8f77-6dc950551007',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea07',
    'UX Design',
    'Reworked a mobile signup flow with fewer decision points and better error recovery. The calmer layout tested better than the more feature-heavy version.',
    jsonb_build_array(
      jsonb_build_object(
        'kind', 'image',
        'url', 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80'
      )
    ),
    timezone('utc', now()) - interval '3 days'
  ),
  (
    '36165f31-86b1-49c4-8f77-6dc950551008',
    '1dbdd0ff-37d4-45b2-a1be-21223cb3ea08',
    'Analytics',
    'Building a cleaner experiment scorecard for product reviews. Teams move faster when the readout is obvious without extra explanation.',
    jsonb_build_array(
      jsonb_build_object(
        'kind', 'image',
        'url', 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80'
      )
    ),
    timezone('utc', now()) - interval '2 days 12 hours'
  )
on conflict (id) do update
set
  author_id = excluded.author_id,
  skilled_domain = excluded.skilled_domain,
  content = excluded.content,
  media_items = excluded.media_items,
  created_at = excluded.created_at;
