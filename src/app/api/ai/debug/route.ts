import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.KAMO_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.KAMO_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  
  return NextResponse.json({
    hasKey: !!apiKey,
    keyPrefix: apiKey ? apiKey.substring(0, 6) + '...' : 'none',
    baseUrl: baseUrl,
    isGenspark: baseUrl.includes('genspark'),
  });
}
