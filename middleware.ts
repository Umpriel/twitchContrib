import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const requiredEnvVars = [
    'TWITCH_CHANNEL',
    'TWITCH_BOT_USERNAME'
  ];

  const missingVars = requiredEnvVars.filter(
    varName => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    return NextResponse.error();
  }

  return NextResponse.next();
} 