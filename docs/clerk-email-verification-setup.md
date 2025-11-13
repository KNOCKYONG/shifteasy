# Clerk 이메일 인증 설정 가이드

## 문제 상황
현재 이메일 인증 없이 로그인이 되고 있습니다.

## 해결 방법

### 1. Clerk Dashboard 접속
1. https://dashboard.clerk.com 접속
2. ShiftEasy 프로젝트 선택

### 2. Email 설정 확인
**경로**: `User & Authentication` > `Email, Phone, Username`

#### 필수 설정사항:
1. **Email address 섹션**
   - ✅ `Required` 체크
   - ✅ `Verify at sign-up` 체크
   - ✅ Verification method: `Email verification code` 선택

2. **Sign-up 설정**
   - `Sign-up` 탭으로 이동
   - ❌ `Progressive sign-up` 비활성화 (중요!)

   Progressive sign-up이 활성화되어 있으면 사용자가 인증 없이 로그인할 수 있습니다.

### 3. Email 템플릿 확인
**경로**: `Customization` > `Emails`

1. `Email address verification code` 템플릿 선택
2. 커스텀 한국어 템플릿이 적용되어 있는지 확인
3. Preview 버튼으로 테스트

### 4. Session 설정 확인
**경로**: `Sessions`

- `Multi-session handling`: Single session per user (권장)
- `Session lifetime`: 7 days (기본값)

### 5. 테스트

#### 테스트 절차:
1. 새로운 이메일 주소로 회원가입 시도
2. 이메일 인증 코드 입력 화면이 나타나는지 확인
3. 인증 코드 입력 전에는 로그인이 안 되는지 확인
4. 이메일로 한국어 인증 코드가 도착하는지 확인
5. 인증 코드 입력 후 로그인 성공 확인

#### 예상 동작:
```
1. Sign up 페이지에서 이메일/비밀번호 입력
   ↓
2. "이메일 인증 코드를 확인하세요" 화면 표시
   ↓
3. 이메일로 6자리 코드 수신 (한국어 템플릿)
   ↓
4. 코드 입력
   ↓
5. 인증 완료 후 dashboard로 리다이렉트
```

## 현재 상태 확인 스크립트

```bash
# Clerk 설정 확인
npm run clerk:check

# 이메일 템플릿 확인
npm run clerk:update-email-template
```

## 주의사항

### ⚠️ Progressive Sign-up
Progressive sign-up을 활성화하면:
- 사용자가 최소 정보만으로 가입 가능
- 이메일 인증을 나중에 할 수 있음
- **보안상 비활성화 권장**

### ✅ 올바른 설정
```
Email address:
  - Required: YES
  - Verify at sign-up: YES
  - Verification method: Email verification code

Sign-up:
  - Progressive sign-up: NO
```

### 📧 이메일 전송 확인
테스트 환경에서 이메일이 안 온다면:
1. 스팸 폴더 확인
2. Clerk Dashboard > `Emails` > `Delivery logs` 확인
3. 이메일 주소가 차단 목록에 없는지 확인

## 문제 해결

### 문제: 여전히 인증 없이 로그인됨
**해결책**:
1. Clerk Dashboard에서 모든 활성 세션 종료
2. 브라우저 쿠키 삭제
3. 새로운 시크릿 창에서 테스트

### 문제: 이메일이 안 옴
**해결책**:
1. Clerk Dashboard > Emails > Delivery logs 확인
2. 이메일 템플릿 설정 확인 (`delivered_by_clerk: true`)
3. 스팸 폴더 확인

### 문제: 인증 코드가 틀렸다고 나옴
**해결책**:
1. 코드 유효 시간 확인 (10분)
2. 최신 코드 사용 확인
3. 이메일 템플릿의 `{{otp_code}}` 변수 확인

## API를 통한 설정 (대안)

Clerk Dashboard 접근이 어려운 경우, API를 사용할 수 있습니다:

```bash
# 현재 설정 확인
curl -X GET https://api.clerk.com/v1/instance \
  -H "Authorization: Bearer $CLERK_SECRET_KEY"

# 이메일 인증 활성화 (실험적)
curl -X PATCH https://api.clerk.com/v1/instance/restrictions \
  -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email_address": {
      "verification_required": true
    }
  }'
```

**주의**: API 설정은 Clerk 버전에 따라 다를 수 있으므로 Dashboard 사용을 권장합니다.

## 참고 자료
- [Clerk Email Verification Documentation](https://clerk.com/docs/authentication/configuration/email-sms-templates)
- [Clerk Dashboard](https://dashboard.clerk.com)
