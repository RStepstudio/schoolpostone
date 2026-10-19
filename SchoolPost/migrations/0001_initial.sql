PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  initials TEXT NOT NULL,
  avatar TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  kind TEXT NOT NULL DEFAULT 'post' CHECK (kind IN ('post', 'repository')),
  repo_name TEXT,
  repo_description TEXT,
  repo_language TEXT,
  repo_stars INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id != followed_id)
);

CREATE TABLE IF NOT EXISTS likes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS posts_author_id_idx ON posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS likes_post_id_idx ON likes(post_id);
CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments(post_id);

INSERT OR IGNORE INTO users (id, name, handle, initials, avatar, detail) VALUES
  ('maya', 'Maya Chen', '@mayac', 'MC', 'avatar-maya', 'Design club · Class of ''27'),
  ('jules', 'Jules Park', '@julespark', 'JP', 'avatar-jules', 'Robotics · Class of ''27'),
  ('amir', 'Amir Rivera', '@amirivera', 'AR', 'avatar-amir', 'Design & illustration'),
  ('nina', 'Nina Williams', '@ninaw', 'NW', 'avatar-nina', 'Science club · Class of ''28'),
  ('leo', 'Leo Martin', '@leomakes', 'LM', 'avatar-jules', 'Computer science · Class of ''26');

INSERT OR IGNORE INTO posts (id, author_id, text, kind, repo_name, repo_description, repo_language, repo_stars) VALUES
  ('seed-robotics', 'jules', 'Our robot finally made it through the whole course without eating a wall 😭 First scrimmage next Friday — if you''re into building things, come hang with the robotics crew after school! #BuildInPublic', 'post', NULL, NULL, NULL, 0),
  ('seed-art', 'amir', 'Little color study from art club today. We tried painting the same place at two different times of day — the courtyard looks like a completely different world at 4pm. 🎨 #SeniorArtShow', 'post', NULL, NULL, NULL, 0),
  ('seed-science', 'nina', 'Science Night is next Thursday! The bio lab is doing a microscope station and the astronomy group says they might bring the telescope. Anyone else showing something? #ScienceNight', 'post', NULL, NULL, NULL, 0),
  ('seed-timer', 'leo', 'Been learning a little JavaScript each day after class. Made this tiny study timer so I actually remember to take breaks — sharing the first version here. Feedback very welcome!', 'repository', 'little-study-timer', 'A tiny, no-fuss study timer for focused afternoons.', 'JavaScript', 12),
  ('seed-maya', 'maya', 'A reminder I needed today: you don''t have to be an expert before you start. Made my first Figma component from scratch and it is, objectively, a little wonky. Still proud of it. 🌱', 'post', NULL, NULL, NULL, 0);

INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES ('maya', 'jules'), ('maya', 'amir');
