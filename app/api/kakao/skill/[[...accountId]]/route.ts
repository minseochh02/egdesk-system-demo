/**
 * BYO Kakao skill webhook — example handler for your own AI chatbot.
 *
 * Point Kakao skill URL to: https://your-app.com/api/kakao/skill/{channelSearchId}
 * Headers (set in Kakao admin via EGDesk create/repair bot):
 *   X-Api-Key: same as EGDesk kakaoCallbackApiKey
 *   X-Kakao-Channel-Name: channel search ID (without @)
 *
 * Identity:
 *   channel → URL path segment or X-Kakao-Channel-Name header
 *   user    → body.userRequest.user.properties.botUserKey (etc.)
 *   message → body.userRequest.utterance
 */

import { NextResponse } from 'next/server';

function pickUserKey(body: Record<string, unknown>): string {
  const userRequest = body.userRequest as Record<string, unknown> | undefined;
  const user = userRequest?.user as Record<string, unknown> | undefined;
  const props = user?.properties as Record<string, unknown> | undefined;
  return String(
    props?.botUserKey ||
      props?.plusfriendUserKey ||
      props?.appUserId ||
      user?.id ||
      'unknown',
  );
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ accountId?: string[] }> },
) {
  const { accountId: segments } = await context.params;
  const accountId = segments?.[0] ?? '(generic)';
  return NextResponse.json({
    success: true,
    service: 'kakao-skill',
    status: 'online',
    accountId,
    hint: 'POST Kakao skill JSON body to this URL',
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ accountId?: string[] }> },
) {
  const expectedKey = process.env.KAKAO_WEBHOOK_API_KEY || process.env.NEXT_PUBLIC_EGDESK_API_KEY;
  const incomingKey = request.headers.get('x-api-key');
  if (expectedKey && incomingKey !== undefined && incomingKey !== expectedKey) {
    return unauthorized();
  }

  const { accountId: segments } = await context.params;
  const accountId = segments?.[0]?.replace(/^@/, '') || 'default';
  const channelName =
    request.headers.get('x-kakao-channel-name')?.replace(/^@/, '') || accountId;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const userRequest = body.userRequest as Record<string, unknown> | undefined;
  const utterance = String(userRequest?.utterance ?? '').trim();
  const userKey = pickUserKey(body);
  const userType = String(
    (userRequest?.user as Record<string, unknown> | undefined)?.type ?? 'unknown',
  );
  const callbackUrl = userRequest?.callbackUrl as string | undefined;

  // Replace with your LLM / agent call. sessionKey isolates conversations per channel + user.
  const sessionKey = `${accountId}:${userType}:${userKey}`;
  const reply = `[demo] (${channelName}) You said: ${utterance}`;

  // Async callback mode — return immediately, POST full response to callbackUrl when AI is ready
  if (callbackUrl) {
    void fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: '2.0',
        template: { outputs: [{ simpleText: { text: reply } }] },
      }),
    }).catch((err) => console.error('[kakao/skill] callback failed:', err));

    return NextResponse.json({
      version: '2.0',
      useCallback: true,
      data: { text: '잠시만 기다려주세요...' },
    });
  }

  // Sync mode
  return NextResponse.json({
    version: '2.0',
    template: { outputs: [{ simpleText: { text: reply } }] },
    _demo: { sessionKey, channelName, accountId },
  });
}
