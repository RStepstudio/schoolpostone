PRAGMA foreign_keys = ON;

-- Add session tracking for soft delete eligibility
CREATE TABLE IF NOT EXISTS post_sessions (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, session_id)
);

-- Add deleted/hidden flag to posts
ALTER TABLE posts ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;

-- Add file attachment support to posts
ALTER TABLE posts ADD COLUMN file_name TEXT;
ALTER TABLE posts ADD COLUMN file_type TEXT;
ALTER TABLE posts ADD COLUMN file_size INTEGER;
ALTER TABLE posts ADD COLUMN file_data TEXT; -- base64 encoded

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Verification system
CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS club_members (
  club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_verification (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  reason TEXT
);

-- Indexes for comments and verification
CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments(post_id);
CREATE INDEX IF NOT EXISTS comments_created_at_idx ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS posts_likes_created_idx ON posts(likes_count DESC, created_at DESC);