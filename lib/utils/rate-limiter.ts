// Simple in-memory rate limiter
interface UserRate {
  lastSubmission: number;
  count: number;
}

const userRates: Record<string, UserRate> = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_SUBMISSIONS = 5; // Max 5 submissions per minute

export function isRateLimited(username: string): boolean {
  const now = Date.now();
  const userRate = userRates[username];
  
  // For debugging
  console.log(`Rate check for ${username}: ${userRate ? userRate.count : 0} submissions in window`);
  
  if (!userRate) {
    // First submission from this user
    userRates[username] = {
      lastSubmission: now,
      count: 1
    };
    return false;
  }
  
  // Check if we're still in the rate limit window
  if (now - userRate.lastSubmission < RATE_LIMIT_WINDOW) {
    // Increment the count BEFORE checking the limit
    userRate.count++;
    
    // Now check if we've exceeded the limit
    if (userRate.count > MAX_SUBMISSIONS) {
      console.log(`Rate limited ${username}: ${userRate.count} submissions`);
      return true; // Rate limited
    }
    
    userRate.lastSubmission = now;
    return false;
  }
  
  // Reset the rate limit window
  userRates[username] = {
    lastSubmission: now,
    count: 1
  };
  
  return false;
} 