-- migration: initial_schema
-- description: creates the initial database schema for lettera application
-- affected tables: users, cvs, letters
-- author: system
-- date: 2025-10-28
--
-- this migration sets up:
-- 1. core tables (users, cvs, letters) with uuid primary keys
-- 2. foreign key relationships with cascade delete
-- 3. row level security (rls) policies for multi-tenant isolation
-- 4. indexes for query performance
-- 5. triggers for automatic timestamp updates
-- 6. check constraints for data validation
--
-- note: this schema assumes the application will set 'app.current_user' 
-- session variable after jwt validation to enable rls policies

-- ============================================================================
-- extensions
-- ============================================================================

-- enable pgcrypto for gen_random_uuid() function
create extension if not exists "pgcrypto";

-- ============================================================================
-- table: users
-- ============================================================================

-- stores user authentication and profile information
-- note: password_hash should contain argon2 or bcrypt hash, never plaintext
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  
  -- ensure email is not empty
  constraint users_email_not_empty check (char_length(email) > 0)
);

-- create unique index on email for fast lookup during authentication
create unique index if not exists idx_users_email on users (email);

-- ============================================================================
-- table: cvs
-- ============================================================================

-- stores metadata for cv/resume files uploaded to s3
-- actual file content is stored in s3, only reference (s3_key) is in db
-- max 5 cvs per user (enforced transactionally in application layer)
create table if not exists cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  s3_key text not null,
  filename text not null,
  created_at timestamptz not null default now(),
  
  -- prevent excessively long filenames that could cause issues
  constraint cvs_filename_length check (char_length(filename) <= 255),
  -- ensure s3_key is not empty
  constraint cvs_s3_key_not_empty check (char_length(s3_key) > 0),
  -- ensure filename is not empty
  constraint cvs_filename_not_empty check (char_length(filename) > 0)
);

-- index for fetching all cvs for a specific user
create index if not exists idx_cvs_user_id on cvs (user_id);

-- composite index for pagination queries (newest first)
-- optimizes queries like: select * from cvs where user_id = ? order by created_at desc
create index if not exists idx_cvs_user_created_at_desc on cvs (user_id, created_at desc);

-- ============================================================================
-- table: letters
-- ============================================================================

-- stores generated cover letters in html format
-- pdf versions are stored in s3 (pdf_s3_key reference)
-- max 5 letters per user (enforced transactionally in application layer)
create table if not exists letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  html text not null,
  pdf_s3_key text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- prevent storing excessively large html content (200k chars ~400kb)
  constraint letters_html_max_length check (char_length(html) <= 200000),
  -- ensure html is not empty
  constraint letters_html_not_empty check (char_length(html) > 0)
);

-- index for fetching all letters for a specific user
create index if not exists idx_letters_user_id on letters (user_id);

-- composite index for pagination queries (newest first)
-- optimizes queries like: select * from letters where user_id = ? order by created_at desc
create index if not exists idx_letters_user_created_at_desc on letters (user_id, created_at desc);

-- ============================================================================
-- trigger: auto-update updated_at timestamp
-- ============================================================================

-- function to automatically set updated_at to current timestamp on row update
create or replace function trigger_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- trigger to call the function before any update on letters table
create trigger trg_letters_set_updated_at
before update on letters
for each row
execute function trigger_set_updated_at();

-- ============================================================================
-- row level security (rls) setup
-- ============================================================================

-- enable rls on all tables to enforce multi-tenant data isolation
-- application must set app.current_user session variable after authentication
alter table users enable row level security;
alter table cvs enable row level security;
alter table letters enable row level security;

-- ============================================================================
-- rls policies: users table
-- ============================================================================

-- policy: users can only select their own user record
-- rationale: prevents users from viewing other users' data
-- note: application should avoid selecting password_hash in queries
create policy users_select_own on users
  for select
  using (id = current_setting('app.current_user', true)::uuid);

-- policy: users can only insert their own user record
-- rationale: during registration, ensures user_id matches session context
create policy users_insert_own on users
  for insert
  with check (id = current_setting('app.current_user', true)::uuid);

-- policy: users can only update their own user record
-- rationale: prevents users from modifying other users' profiles
create policy users_update_own on users
  for update
  using (id = current_setting('app.current_user', true)::uuid)
  with check (id = current_setting('app.current_user', true)::uuid);

-- policy: users can only delete their own user record
-- rationale: prevents unauthorized account deletion
-- note: cascade delete will remove associated cvs and letters
create policy users_delete_own on users
  for delete
  using (id = current_setting('app.current_user', true)::uuid);

-- ============================================================================
-- rls policies: cvs table
-- ============================================================================

-- policy: users can only select their own cvs
-- rationale: ensures users cannot view other users' uploaded resumes
create policy cvs_select_own on cvs
  for select
  using (user_id = current_setting('app.current_user', true)::uuid);

-- policy: users can only insert cvs for themselves
-- rationale: prevents users from creating cvs under another user's account
-- note: application must enforce max 5 cvs per user transactionally
create policy cvs_insert_own on cvs
  for insert
  with check (user_id = current_setting('app.current_user', true)::uuid);

-- policy: users can only update their own cvs
-- rationale: prevents unauthorized modification of cv metadata
create policy cvs_update_own on cvs
  for update
  using (user_id = current_setting('app.current_user', true)::uuid)
  with check (user_id = current_setting('app.current_user', true)::uuid);

-- policy: users can only delete their own cvs
-- rationale: prevents unauthorized deletion of cv records
-- note: application must coordinate s3 object deletion with db record deletion
create policy cvs_delete_own on cvs
  for delete
  using (user_id = current_setting('app.current_user', true)::uuid);

-- ============================================================================
-- rls policies: letters table
-- ============================================================================

-- policy: users can only select their own letters
-- rationale: ensures users cannot view other users' generated cover letters
create policy letters_select_own on letters
  for select
  using (user_id = current_setting('app.current_user', true)::uuid);

-- policy: users can only insert letters for themselves
-- rationale: prevents users from creating letters under another user's account
-- note: application must enforce max 5 letters per user transactionally
create policy letters_insert_own on letters
  for insert
  with check (user_id = current_setting('app.current_user', true)::uuid);

-- policy: users can only update their own letters
-- rationale: prevents unauthorized modification of cover letter content
create policy letters_update_own on letters
  for update
  using (user_id = current_setting('app.current_user', true)::uuid)
  with check (user_id = current_setting('app.current_user', true)::uuid);

-- policy: users can only delete their own letters
-- rationale: prevents unauthorized deletion of cover letter records
-- note: application should coordinate pdf s3 object deletion if pdf_s3_key exists
create policy letters_delete_own on letters
  for delete
  using (user_id = current_setting('app.current_user', true)::uuid);

-- ============================================================================
-- security: restrict access to sensitive columns
-- ============================================================================

-- revoke direct access to password_hash column from public role
-- rationale: password hashes should only be accessed by authentication service
-- application should use specific service account with limited privileges
revoke select (password_hash) on users from public;

-- ============================================================================
-- comments for documentation
-- ============================================================================

comment on table users is 'stores user accounts with authentication credentials';
comment on column users.password_hash is 'argon2 or bcrypt hash - never plaintext password';
comment on column users.email is 'unique user email address for authentication';

comment on table cvs is 'metadata for cv/resume files stored in s3 (max 5 per user)';
comment on column cvs.s3_key is 'reference to file location in s3 bucket';
comment on column cvs.filename is 'original filename from upload';

comment on table letters is 'generated cover letters in html format (max 5 per user)';
comment on column letters.html is 'cover letter content in html format (max 200k chars)';
comment on column letters.pdf_s3_key is 'optional reference to pdf version in s3';
comment on column letters.updated_at is 'automatically updated by trigger on row modification';

-- ============================================================================
-- migration complete
-- ============================================================================

-- next steps for application implementation:
-- 1. set app.current_user session variable after jwt validation
-- 2. implement transactional limit enforcement (max 5 cvs/letters per user)
--    using pg_advisory_xact_lock or select...for update
-- 3. coordinate s3 object deletion with db record deletion (compensating jobs)
-- 4. use connection pooling carefully - ensure app.current_user is set per request
-- 5. implement retry logic for s3 operations to maintain consistency

