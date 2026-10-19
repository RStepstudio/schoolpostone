const BLOCKED_PATTERNS = [
  /\b(fuck|shit|bitch|asshole|damn|hell)\b/i,
  /\b(kill|die|suicide|hurt|self.harm)\b/i,
  /\b(nigger|faggot|retard|tranny|slur)\b/i,
  /\b(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})\b/,
  /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/,
  /\b(\d{1,5}\s+\w+\s+(st|ave|rd|blvd|dr|ln|ct|pl|way|pkwy|road|street|avenue|drive|lane|court|place|parkway|boulevard))\b/i,
];

function checkContent(text) {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { allowed: false, reason: "Inappropriate content" };
    }
  }
  return { allowed: true };
}

async function checkContentAI(text, env) {
  const keywordResult = checkContent(text);
  if (!keywordResult.allowed) {
    return keywordResult;
  }

  if (!env?.AI) {
    return { allowed: true };
  }

  try {
    const response = await env.AI.run("@cf/meta/llama-guard-3-8b", {
      messages: [{ role: "user", content: text }],
    });

    if (response?.unsafe === true) {
      return { allowed: false, reason: "Content flagged by safety system" };
    }
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export { checkContent, checkContentAI };