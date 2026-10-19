const people = {
  maya: { name: "Maya Chen", handle: "@mayac", initials: "MC", avatar: "avatar-maya", detail: "Design club · Class of '27" },
  jules: { name: "Jules Park", handle: "@julespark", initials: "JP", avatar: "avatar-jules", detail: "Robotics · Class of '27" },
  amir: { name: "Amir Rivera", handle: "@amirivera", initials: "AR", avatar: "avatar-amir", detail: "Design & illustration" },
  nina: { name: "Nina Williams", handle: "@ninaw", initials: "NW", avatar: "avatar-nina", detail: "Science club · Class of '28" },
  leo: { name: "Leo Martin", handle: "@leomakes", initials: "LM", avatar: "avatar-jules", detail: "Computer science · Class of '26" },
};

const starterPosts = [];

function readStored(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // quota exceeded, silently ignore
  }
}

function makeSessionId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getCookie(name) {
  const entry = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  if (!entry) return null;
  try {
    return decodeURIComponent(entry.slice(name.length + 1));
  } catch {
    return null;
  }
}

function saveCookie(name, value, maxAge) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const lifetime = maxAge ? `; Max-Age=${maxAge}` : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${lifetime}${secure}`;
}

let username = readStored("schoolpost-username") || getCookie("schoolpost-username");
let sessionId = readStored("schoolpost-session-id") || getCookie("schoolpost-session-id") || makeSessionId();
writeStored("schoolpost-session-id", sessionId);
saveCookie("schoolpost-session-id", sessionId);

let posts = [...starterPosts];
let comments = new Map();
let currentTab = "home";
let activeSearch = "";
let toastTimeout;
let followed = new Set();
let liked = new Set();
let saved = new Set();
let clubs = new Map();
let verification = { verified: false, reason: "", verified_at: null };

let db = window.schoolpostDb || null;
let useFirebase = !!db;

function userStorageKey(key) {
  return `schoolpost-${key}-${username || "guest"}`;
}

function loadUserState() {
  try { liked = new Set(JSON.parse(readStored(userStorageKey("liked"), "[]"))); }
  catch { liked = new Set(); }
  try { saved = new Set(JSON.parse(readStored(userStorageKey("saved"), "[]"))); }
  catch { saved = new Set(); }
  try { followed = new Set(JSON.parse(readStored(userStorageKey("followed"), "[]"))); }
  catch { followed = new Set(); }
  try {
    const storedComments = readStored("schoolpost-comments");
    if (storedComments) comments = new Map(JSON.parse(storedComments));
  } catch { comments = new Map(); }
  try {
    const storedClubs = readStored("schoolpost-clubs");
    if (storedClubs) clubs = new Map(JSON.parse(storedClubs));
  } catch { clubs = new Map(); }
  try {
    const storedVer = readStored("schoolpost-verification");
    if (storedVer) verification = JSON.parse(storedVer);
  } catch { verification = { verified: false, reason: "", verified_at: null }; }
}

function persistUserState(kind, values) {
  writeStored(userStorageKey(kind), JSON.stringify([...values]));
}

function persistAllLocal() {
  try {
    writeStored("schoolpost-posts", JSON.stringify(posts.filter(p => !p.id.startsWith("starter-"))));
    writeStored("schoolpost-comments", JSON.stringify([...comments]));
    writeStored("schoolpost-clubs", JSON.stringify([...clubs]));
    writeStored("schoolpost-verification", JSON.stringify(verification));
  } catch {
    // quota exceeded
  }
}

async function firebaseGet(collection) {
  if (!useFirebase) return [];
  const snap = await db.collection(collection).get();
  return snap.docs.map(d => d.data());
}

async function firebaseSet(collection, id, data) {
  if (!useFirebase) return;
  await db.collection(collection).doc(id).set(data);
}

async function firebaseDelete(collection, id) {
  if (!useFirebase) return;
  await db.collection(collection).doc(id).delete();
}

async function savePostsFirebase() {
  if (!useFirebase) return;
  const existing = await firebaseGet("posts");
  const existingIds = new Set(existing.map(p => p.id));
  for (const post of posts) {
    if (!existingIds.has(post.id)) {
      await firebaseSet("posts", post.id, post);
    }
  }
}

async function loadFromFirebase() {
  if (!useFirebase) return false;
  try {
    const postsSnap = await db.collection("posts").orderBy("created_at", "desc").limit(50).get();
    const loadedPosts = postsSnap.docs.map(d => d.data());
    if (loadedPosts.length > 0) {
      posts = loadedPosts;
    }

    const commentsSnap = await db.collection("comments").get();
    comments = new Map();
    commentsSnap.docs.forEach(d => {
      const c = d.data();
      if (!comments.has(c.postId)) comments.set(c.postId, []);
      comments.get(c.postId).push(c);
    });

    const clubsSnap = await db.collection("clubs").get();
    clubs = new Map(clubsSnap.docs.map(d => [d.id, d.data()]));

    const verSnap = await db.collection("verification").doc(username).get();
    if (verSnap.exists) {
      verification = verSnap.data();
    }

    const followsSnap = await db.collection("follows").where("follower_id", "==", username).get();
    followed = new Set(followsSnap.docs.map(d => d.data().followed_id));

    const likesSnap = await db.collection("likes").where("user_id", "==", username).get();
    liked = new Set(likesSnap.docs.map(d => d.data().post_id));

    const savedSnap = await db.collection("saves").where("user_id", "==", username).get();
    saved = new Set(savedSnap.docs.map(d => d.data().post_id));

    return true;
  } catch {
    return false;
  }
}

async function saveToFirebase(post) {
  if (!useFirebase) return;
  await firebaseSet("posts", post.id, { ...post, created_at: post.created_at || new Date().toISOString() });
}

async function saveCommentFirebase(comment) {
  if (!useFirebase) return;
  await firebaseSet("comments", comment.id, comment);
}

async function deleteCommentFirebase(commentId) {
  if (!useFirebase) return;
  await firebaseDelete("comments", commentId);
}

async function saveClubFirebase(club) {
  if (!useFirebase) return;
  await firebaseSet("clubs", club.id, club);
}

async function saveVerificationFirebase() {
  if (!useFirebase) return;
  await firebaseSet("verification", username, verification);
}

async function saveFollowFirebase(userId, following) {
  if (!useFirebase) return;
  const docId = `${username}_${userId}`;
  if (following) {
    await firebaseSet("follows", docId, { follower_id: username, followed_id: userId, created_at: new Date().toISOString() });
  } else {
    await firebaseDelete("follows", docId);
  }
}

async function saveLikeFirebase(postId, liked) {
  if (!useFirebase) return;
  const docId = `${username}_${postId}`;
  if (liked) {
    await firebaseSet("likes", docId, { user_id: username, post_id: postId, created_at: new Date().toISOString() });
  } else {
    await firebaseDelete("likes", docId);
  }
}

async function saveSaveFirebase(postId, saved) {
  if (!useFirebase) return;
  const docId = `${username}_${postId}`;
  if (saved) {
    await firebaseSet("saves", docId, { user_id: username, post_id: post_id, created_at: new Date().toISOString() });
  } else {
    await firebaseDelete("saves", docId);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function icon(name, className = "icon") {
  return `<svg class="${className}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function formatText(value) {
  return escapeHtml(value).replace(/(^|\s)(#[a-zA-Z0-9_]+)/g, '$1<span class="post-tag">$2</span>').replace(/\n/g, "<br>");
}

function relativeTime(timestamp) {
  if (!timestamp) return "now";
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "now";
  const minutes = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function requestHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Schoolpost-Username": username,
    "X-Schoolpost-Session-Id": sessionId,
  };
}

function currentPerson() {
  const initials = username.slice(0, 2).toUpperCase();
  return { name: username, handle: `@${username}`, initials, avatar: "avatar-anon", detail: "Schoolpost community" };
}

function personFor(post) {
  if (post.author === username) return currentPerson();
  if (people[post.author]) {
    return {
      ...people[post.author],
      name: post.name || people[post.author].name,
      handle: post.handle || people[post.author].handle,
      detail: post.detail || people[post.author].detail,
      initials: post.initials || people[post.author].initials,
      avatar: post.avatar || people[post.author].avatar,
    };
  }
  return {
    name: post.name || post.author,
    handle: post.handle || `@${post.author}`,
    initials: post.initials || String(post.author || "?").slice(0, 2).toUpperCase(),
    avatar: "avatar-anon",
    detail: post.detail || "Schoolpost community",
  };
}

function renderPost(post) {
  const person = personFor(post);
  const postId = String(post.id);
  const likedByMe = liked.has(postId) || Boolean(post.liked);
  const savedByMe = saved.has(postId);
  const postComments = comments.get(postId) || [];
  const repo = post.repo ? `<div class="repo-card"><div class="repo-head">${icon("code")}<span>${escapeHtml(post.repo.name)}</span><span class="repo-visibility">PUBLIC</span></div><p class="repo-description">${escapeHtml(post.repo.description)}</p><div class="repo-stats"><span>${icon("user")} <b>${escapeHtml(post.repo.language)}</b></span><span>${icon("star")} <b>${Number(post.repo.stars)} stars</b></span><span>${icon("branch")} <b>3 forks</b></span></div></div>` : "";
  const fileHtml = post.file_name ? `<div class="post-file"><span>${icon("user")}</span><span>${escapeHtml(post.file_name)}</span> (${Math.round((post.file_size || 0) / 1024)}KB)</div>` : "";
  const verifiedBadge = post.verified ? `<span class="verified-badge">${icon("star")}</span>` : "";
  const deleteButton = post.can_delete || (post.session_id && post.session_id === sessionId)
    ? `<button class="post-action delete-action" data-action="delete" aria-label="Delete your post">${icon("trash", "icon action-icon")}<span>Delete</span></button>`
    : "";
  return `<article class="post-card" data-post-id="${escapeHtml(postId)}">
    <div class="post-head"><span class="avatar ${escapeHtml(person.avatar)}">${escapeHtml(person.initials)}</span><div><div class="post-author"><strong>${escapeHtml(person.name)}</strong>${verifiedBadge}<span>${escapeHtml(person.handle)}</span></div><div class="post-meta">${escapeHtml(person.detail)} · ${escapeHtml(post.time || "now")}</div></div><button class="post-menu" aria-label="More post options">${icon("more")}</button></div>
    <p class="post-copy">${formatText(post.text)}</p>${fileHtml}${repo}
    <div class="post-actions"><button class="post-action ${likedByMe ? "liked" : ""}" data-action="like">${icon("heart", "icon action-icon")}<span>${Number(post.likes || 0)} likes</span></button><button class="post-action" data-action="comment">${icon("message", "icon action-icon")}<span>${postComments.length} replies</span></button><button class="post-action ${savedByMe ? "saved" : ""}" data-action="save">${icon("bookmark", "icon action-icon")}<span>${savedByMe ? "Saved" : "Save"}</span></button><button class="post-action" data-action="share">${icon("arrow", "icon action-icon")}<span>Share</span></button>${deleteButton}</div>
    <div class="post-comments-wrapper" id="comments-wrapper-${escapeHtml(postId)}"></div>
  </article>`;
}

function visiblePosts() {
  let result = [...posts];
  if (currentTab === "following") result = result.filter((post) => followed.has(post.author) || post.author === username);
  if (currentTab === "repositories") result = result.filter((post) => post.repo);
  if (currentTab === "bookmarks") result = result.filter((post) => saved.has(String(post.id)));
  if (currentTab === "profile") result = result.filter((post) => post.author === username);
  if (currentTab === "explore") result.sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0));
  if (activeSearch) {
    const term = activeSearch.toLowerCase().replace(/^#/, "");
    result = result.filter((post) => {
      const person = personFor(post);
      return `${post.text} ${person.name} ${person.handle} ${post.repo?.name || ""}`.toLowerCase().includes(term);
    });
  }
  return result;
}

function renderPeople() {
  const suggestions = [];
  for (const id of ["jules", "amir", "nina", "leo"]) {
    if (id !== username && !followed.has(id)) suggestions.push({ id, ...people[id] });
  }
  for (const post of posts) {
    if (post.author === username || suggestions.some((person) => person.id === post.author) || followed.has(post.author)) continue;
    suggestions.push({ id: post.author, ...personFor(post) });
  }
  document.querySelector("#peopleList").innerHTML = suggestions.slice(0, 4).map((person) =>
    `<div class="person-row"><span class="avatar ${escapeHtml(person.avatar)}">${escapeHtml(person.initials)}</span><span class="person-info"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.detail)}</small></span><button class="follow-button" data-user="${escapeHtml(person.id)}">Follow</button></div>`,
  ).join("") || `<p class="people-empty">You're following everyone here.</p>`;
}

function renderFeed() {
  const result = visiblePosts();
  document.querySelector("#feed").innerHTML = result.length
    ? result.map(renderPost).join("")
    : `<div class="empty-state"><strong>${currentTab === "bookmarks" ? "Your saved ideas live here." : "Nothing here just yet."}</strong>${activeSearch ? "Try another search, or explore what's happening at Northstar." : "Be the first to share something with your school."}</div>`;
  document.querySelector(".end-of-feed").style.display = result.length ? "flex" : "none";
  renderPeople();
  renderVerification();
}

const tabCopy = {
  home: ["YOUR SCHOOL, YOUR PEOPLE", () => `Good morning, ${username}`],
  explore: ["A LITTLE CURIOSITY GOES A LONG WAY", () => "Explore Northstar"],
  following: ["GOOD THINGS FROM YOUR PEOPLE", () => "Following"],
  repositories: ["MADE BY PEOPLE AT YOUR SCHOOL", () => "Student projects"],
  bookmarks: ["THE THINGS YOU WANT TO REMEMBER", () => "Saved for later"],
  profile: ["YOUR CORNER OF NORTHSTAR", () => username],
};

function setTab(tab) {
  currentTab = tab;
  activeSearch = "";
  const searchInput = document.querySelector("#searchInput");
  if (searchInput) searchInput.value = "";
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  const [eyebrow, title] = tabCopy[tab] || tabCopy.home;
  document.querySelector("#feedEyebrow").textContent = eyebrow;
  document.querySelector("#feedTitle").textContent = title();
  renderFeed();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyIdentity(value) {
  username = value.toLowerCase();
  writeStored("schoolpost-username", username);
  saveCookie("schoolpost-username", username, 60 * 60 * 24 * 365);
  saveCookie("schoolpost-session-id", sessionId);
  document.querySelectorAll("[data-current-avatar]").forEach((avatar) => {
    avatar.textContent = username.slice(0, 2).toUpperCase();
    avatar.className = "avatar avatar-anon";
  });
  document.querySelector(".profile-name").innerHTML = `${escapeHtml(username)}<small>@${escapeHtml(username)}</small>`;
  const [eyebrow, title] = tabCopy[currentTab] || tabCopy.home;
  document.querySelector("#feedEyebrow").textContent = eyebrow;
  document.querySelector("#feedTitle").textContent = title();
  loadUserState();
  loadFromFirebase().then(() => renderFeed());
}

function openOnboarding() {
  document.querySelector("#usernameDialog").showModal();
  document.querySelector("#usernameInput").focus();
}

function initializeTheme() {
  const savedTheme = readStored("schoolpost-theme");
  const theme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  setTheme(theme);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === "dark";
  const button = document.querySelector("#themeToggle");
  button.setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
  button.innerHTML = icon(dark ? "sun" : "moon");
  document.querySelector('meta[name="theme-color"]').content = dark ? "#18201c" : "#f8f8f5";
  writeStored("schoolpost-theme", theme);
}

function renderVerification() {
  const section = document.querySelector("#verificationSection");
  const status = document.querySelector("#verificationStatus");
  const button = document.querySelector("#verificationButton");
  if (!section || !status || !button) return;
  section.style.display = "block";
  if (verification.verified) {
    status.className = "verification-status verified";
    status.innerHTML = `<span class="verified-badge">${icon("star")} Verified</span> ${verification.reason || ""} ${verification.verified_at ? `· ${relativeTime(verification.verified_at)}` : ""}`;
    button.style.display = "none";
  } else {
    status.className = "verification-status";
    status.textContent = "Not verified yet. Top 3 weekly posts + 5 fans, or own a club with 10+ members.";
    button.style.display = "block";
  }
}

function addComment(postId, text) {
  if (!comments.has(postId)) comments.set(postId, []);
  const comment = {
    id: `c-${Date.now()}`,
    postId,
    author: username,
    text,
    created_at: new Date().toISOString(),
    session_id: sessionId,
  };
  comments.get(postId).push(comment);
  const post = posts.find(p => String(p.id) === postId);
  if (post) post.comments = (post.comments || 0) + 1;
  saveCommentFirebase(comment);
  persistAllLocal();
  return comment;
}

function deleteComment(commentId) {
  for (const [postId, arr] of comments) {
    const idx = arr.findIndex(c => c.id === commentId);
    if (idx !== -1) {
      arr.splice(idx, 1);
      const post = posts.find(p => String(p.id) === postId);
      if (post) post.comments = Math.max(0, (post.comments || 0) - 1);
      deleteCommentFirebase(commentId);
      persistAllLocal();
      return true;
    }
  }
  return false;
}

function createClub(name, description) {
  const id = `club-${Date.now()}`;
  const club = { id, name, description, owner_id: username, member_count: 1, members: [username], created_at: new Date().toISOString() };
  clubs.set(id, club);
  saveClubFirebase(club);
  persistAllLocal();
  return club;
}

function joinClub(clubId) {
  const club = clubs.get(clubId);
  if (!club) return false;
  if (club.members.includes(username)) return false;
  club.members.push(username);
  club.member_count = club.members.length;
  saveClubFirebase(club);
  persistAllLocal();
  return true;
}

function checkVerification() {
  const fanCount = followed.size;
  let actualFollowers = 0;
  for (const club of clubs.values()) {
    if (club.owner_id === username && club.member_count >= 10) {
      verification = { verified: true, reason: "Owns a club with 10+ members", verified_at: new Date().toISOString() };
      saveVerificationFirebase();
      persistAllLocal();
      return true;
    }
  }
  const topAuthors = {};
  for (const post of posts) {
    if (!post.id.startsWith("starter-")) {
      topAuthors[post.author] = (topAuthors[post.author] || 0) + 1;
    }
  }
  const sorted = Object.entries(topAuthors).sort((a, b) => b[1] - a[1]);
  if (sorted.length >= 3 && sorted[0][0] === username && followed.size >= 5) {
    verification = { verified: true, reason: "Top poster this week with 5+ fans", verified_at: new Date().toISOString() };
    saveVerificationFirebase();
    persistAllLocal();
    return true;
  }
  verification = { verified: false, reason: "", verified_at: null };
  saveVerificationFirebase();
  persistAllLocal();
  return false;
}

document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
document.querySelectorAll("[data-feed]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-feed]").forEach((tab) => tab.classList.toggle("selected", tab === button));
}));

document.querySelector("#postInput").addEventListener("input", (event) => {
  const length = event.currentTarget.value.length;
  document.querySelector("#characterCount").textContent = `${length} / 500`;
  document.querySelector("#postButton").disabled = !event.currentTarget.value.trim() || length > 500;
});

document.querySelector("#postButton").addEventListener("click", async () => {
  const input = document.querySelector("#postInput");
  const fileInput = document.querySelector("#postFile");
  const button = document.querySelector("#postButton");
  const text = input.value.trim();
  if (!text || text.length > 500) return;
  button.disabled = true;
  let fileInfo = null;
  const file = fileInput ? fileInput.files[0] : null;
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(",")[1];
      fileInfo = { name: file.name, type: file.type, size: file.size, data: base64 };
      createPost(text, fileInfo, input, button);
    };
    reader.readAsDataURL(file);
  } else {
    createPost(text, null, input, button);
  }
});

function createPost(text, fileInfo, input, button) {
  const person = currentPerson();
  const now = new Date().toISOString();
  const post = {
    id: `local-${Date.now()}`,
    author: username,
    ...person,
    session_id: sessionId,
    can_delete: true,
    time: "now",
    text,
    likes: 0,
    comments: 0,
    verified: verification.verified,
    created_at: now,
    file_name: fileInfo ? fileInfo.name : null,
    file_type: fileInfo ? fileInfo.type : null,
    file_size: fileInfo ? fileInfo.size : null,
    file_data: fileInfo ? fileInfo.data : null,
  };
  posts.unshift(post);
  saveToFirebase(post);
  input.value = "";
  if (fileInput) fileInput.value = "";
  document.querySelector("#characterCount").textContent = "0 / 500";
  document.querySelector("#feedNotice").textContent = "";
  setTab("home");
  showToast("Your post is out in the world ✳");
  persistAllLocal();
  checkVerification();
  button.disabled = !input.value.trim();
}

document.querySelector("#feed").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const card = button.closest("[data-post-id]");
  const id = card.dataset.postId;
  const post = posts.find((item) => String(item.id) === id);
  if (button.dataset.action === "like") {
    const wasLiked = liked.has(id) || Boolean(post?.liked);
    if (wasLiked) liked.delete(id); else liked.add(id);
    if (post) {
      post.liked = !wasLiked;
      post.likes = Math.max(0, Number(post.likes || 0) + (post.liked ? 1 : -1));
    }
    persistUserState("liked", liked);
    renderFeed();
    saveLikeFirebase(id, liked.has(id));
    persistAllLocal();
  } else if (button.dataset.action === "save") {
    if (saved.has(id)) saved.delete(id); else saved.add(id);
    persistUserState("saved", saved);
    renderFeed();
    showToast(saved.has(id) ? "Saved for later." : "Removed from saved posts.");
    saveSaveFirebase(id, saved.has(id));
    persistAllLocal();
  } else if (button.dataset.action === "comment") {
    if (!post) return;
    const wrapper = card.querySelector(".post-comments-wrapper");
    const existing = card.querySelector(".post-comments");
    if (existing) {
      existing.remove();
      return;
    }
    const postComments = comments.get(id) || [];
    const commentsHtml = postComments.length
      ? postComments.map(c => {
          const person = personFor(c);
          const isMine = c.author === username;
          return `<div class="comment" data-comment-id="${escapeHtml(c.id)}"><span class="avatar ${escapeHtml(person.avatar)}">${escapeHtml(person.initials)}</span><div><div class="comment-author"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.handle)}</span><span>${relativeTime(c.created_at)}</span></div><p class="comment-text">${formatText(c.text)}</p>${isMine ? `<button class="comment-delete" data-action="delete-comment" data-comment-id="${escapeHtml(c.id)}">${icon("trash", "icon")}</button>` : ""}</div></div>`;
        }).join("")
      : '<p class="comments-empty">No comments yet. Be the first!</p>';
    const html = `<div class="post-comments"><div class="comments-list">${commentsHtml}</div><div class="comment-composer"><span class="avatar avatar-anon">${username.slice(0, 2).toUpperCase()}</span><div class="comment-input-wrap"><input type="text" class="comment-input" placeholder="Write a comment..." maxlength="500"><button class="comment-submit" data-post-id="${escapeHtml(id)}">Post</button></div></div></div>`;
    wrapper.innerHTML = html;
    wrapper.querySelector(".comment-submit").addEventListener("click", async (e) => {
      const input = e.currentTarget.parentElement.querySelector(".comment-input");
      const text = input.value.trim();
      if (!text) return;
      e.currentTarget.disabled = true;
      addComment(id, text);
      input.value = "";
      const newWrapper = card.querySelector(".post-comments-wrapper");
      if (newWrapper) newWrapper.innerHTML = "";
      const postComments2 = comments.get(id) || [];
      const commentsHtml2 = postComments2.map(c => {
        const person = personFor(c);
        const isMine = c.author === username;
        return `<div class="comment" data-comment-id="${escapeHtml(c.id)}"><span class="avatar ${escapeHtml(person.avatar)}">${escapeHtml(person.initials)}</span><div><div class="comment-author"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.handle)}</span><span>${relativeTime(c.created_at)}</span></div><p class="comment-text">${formatText(c.text)}</p>${isMine ? `<button class="comment-delete" data-action="delete-comment" data-comment-id="${escapeHtml(c.id)}">${icon("trash", "icon")}</button>` : ""}</div></div>`;
      }).join("");
      newWrapper.innerHTML = `<div class="post-comments"><div class="comments-list">${commentsHtml2}</div><div class="comment-composer"><span class="avatar avatar-anon">${username.slice(0, 2).toUpperCase()}</span><div class="comment-input-wrap"><input type="text" class="comment-input" placeholder="Write a comment..." maxlength="500"><button class="comment-submit" data-post-id="${escapeHtml(id)}">Post</button></div></div></div>`;
      const newSubmit = newWrapper.querySelector(".comment-submit");
      newSubmit.addEventListener("click", arguments.callee);
      renderFeed();
      showToast("Comment posted.");
      persistAllLocal();
      e.currentTarget.disabled = false;
    });
    wrapper.querySelectorAll("[data-action='delete-comment']").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const commentId = e.currentTarget.dataset.commentId;
        e.currentTarget.disabled = true;
        deleteComment(commentId);
        renderFeed();
        showToast("Comment deleted.");
        e.currentTarget.disabled = false;
      });
    });
  } else if (button.dataset.action === "share") {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/#post-${id}`);
      showToast("Post link copied.");
    } catch {
      showToast("Sharing is unavailable in this browser.");
    }
  } else if (button.dataset.action === "delete") {
    if (!post || (!post.can_delete && post.session_id !== sessionId)) return;
    button.disabled = true;
    posts = posts.filter((item) => String(item.id) !== id);
    comments.delete(id);
    if (useFirebase) {
      await firebaseDelete("posts", id);
    }
    showToast("Your post has been deleted.");
    renderFeed();
    persistAllLocal();
    button.disabled = false;
  }
});

document.querySelector("#peopleList").addEventListener("click", async (event) => {
  const button = event.target.closest(".follow-button");
  if (!button) return;
  const user = button.dataset.user;
  const wasFollowing = followed.has(user);
  if (wasFollowing) followed.delete(user); else followed.add(user);
  persistUserState("followed", followed);
  renderFeed();
  showToast(wasFollowing ? `You unfollowed ${user}.` : `You're now following ${user}.`);
  saveFollowFirebase(user, followed.has(user));
  persistAllLocal();
  checkVerification();
});

document.querySelector("#searchInput")?.addEventListener("input", (event) => {
  activeSearch = event.currentTarget.value.trim();
  renderFeed();
});
document.querySelectorAll("[data-search]").forEach((button) => button.addEventListener("click", () => {
  document.querySelector("#searchInput").value = button.dataset.search;
  activeSearch = button.dataset.search;
  renderFeed();
}));
document.querySelector("#startPostButton").addEventListener("click", () => {
  document.querySelector("#postInput").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
document.querySelector("#inviteButton").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.origin);
    showToast("Schoolpost link copied — send it to a friend!");
  } catch {
    showToast("Share your Schoolpost link with a friend!");
  }
});
document.querySelector("#themeToggle").addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
document.querySelector("#verificationButton").addEventListener("click", async () => {
  const wasVerified = checkVerification();
  renderVerification();
  showToast(wasVerified ? "You are now verified! ✳" : "Not yet eligible. Keep posting and gain fans.");
});
document.querySelector("#usernameForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = document.querySelector("#usernameInput").value.trim();
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(value)) {
    document.querySelector("#usernameError").textContent = "Use 3–20 letters, numbers, underscores, or hyphens.";
    return;
  }
  applyIdentity(value);
  document.querySelector("#usernameDialog").close();
  renderFeed();
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.querySelector("#searchInput")?.focus();
  }
});

loadUserState();
initializeTheme();
if (username && /^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
  applyIdentity(username);
} else {
  openOnboarding();
}
