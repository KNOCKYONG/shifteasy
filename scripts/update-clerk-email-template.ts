import 'dotenv/config';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const CLERK_BASE_URL = process.env.CLERK_API_URL || 'https://api.clerk.com/v1';
const TEMPLATE_ID = 'email_address_verification_code';

const emailSubject = '[ShiftEasy] 이메일 인증 코드 안내';

const emailBody = `
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>ShiftEasy 이메일 인증</title>
    <style>
      body { font-family: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f4f6fb; margin: 0; padding: 32px; }
      .container { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08); }
      .brand { text-align: center; margin-bottom: 32px; }
      .brand h1 { color: #111827; margin: 0; font-size: 24px; }
      .brand p { color: #6b7280; margin-top: 8px; font-size: 14px; }
      .code-box { text-align: center; background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 24px; margin: 24px 0; }
      .code { font-size: 32px; font-weight: 700; letter-spacing: 0.5rem; color: #1d4ed8; margin: 0; }
      .cta { text-align: center; margin: 32px 0 16px; }
      .cta a { display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; }
      .help { color: #6b7280; font-size: 13px; line-height: 1.7; text-align: center; }
      .footer { margin-top: 40px; font-size: 12px; color: #9ca3af; text-align: center; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="brand">
        <h1>ShiftEasy</h1>
        <p>스마트한 근무 스케줄 관리 시스템</p>
      </div>
      <p style="font-size:16px; color:#111827; margin-bottom:16px;">
        안녕하세요, <strong>{{application_name}}</strong> 입니다.
      </p>
      <p style="font-size:15px; color:#374151; line-height:1.7;">
        아래 인증 코드를 입력하여 이메일 인증을 완료해주세요.<br/>
        보안을 위해 인증 코드는 <strong>10분 후 만료</strong>됩니다.
      </p>
      <div class="code-box">
        <p class="code">{{code}}</p>
      </div>
      <div class="cta">
        <a href="{{action_url}}" target="_blank" rel="noreferrer">인증 완료하기</a>
      </div>
      <p class="help">
        인증을 요청한 적이 없다면 이 메일을 무시하셔도 됩니다.<br/>
        도움이 필요하시면 <a href="mailto:support@shifteasy.app">support@shifteasy.app</a>로 연락주세요.
      </p>
      <div class="footer">
        © {{year}} ShiftEasy. All rights reserved.
      </div>
    </div>
  </body>
</html>
`.trim();

async function updateEmailTemplate() {
  if (!CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is not defined in environment variables.');
  }

  const response = await fetch(`${CLERK_BASE_URL}/email_templates/${TEMPLATE_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: emailSubject,
      body: emailBody,
      from_email_name: 'ShiftEasy',
      name: 'ShiftEasy Email Verification',
      auto_advance: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to update template: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  console.log('✅ Clerk email template updated:', data.id);
}

updateEmailTemplate().catch((error) => {
  console.error('Failed to update Clerk email template:', error);
  process.exit(1);
});
