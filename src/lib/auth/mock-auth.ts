/**
 * Clerk 인증을 임시로 비활성화하고 mock 데이터를 제공하는 모듈
 * UI 개발 완료 후 삭제 예정
 */

export const mockUser = {
  id: 'test-admin-user',
  email: 'admin@shifteasy.com',
  name: 'Admin User',
  role: 'admin' as const,
  tenantId: 'test-tenant',
  departmentId: 'dept-1',
  clerkUserId: 'mock-clerk-id',
};

export const mockTenant = {
  id: 'test-tenant',
  name: 'Test Hospital',
  slug: 'test-hospital',
  secretCode: 'TEST-1234',
  plan: 'free' as const,
  settings: {
    timezone: 'Asia/Seoul',
    locale: 'ko',
    maxUsers: 100,
    maxDepartments: 10,
    features: ['schedule', 'swap', 'reports'],
  },
};

// Clerk의 auth() 함수를 대체하는 mock 함수
export async function mockAuth() {
  return {
    userId: mockUser.clerkUserId,
    sessionId: 'mock-session',
    orgId: mockTenant.id,
    orgRole: 'org:admin',
    user: mockUser,
  };
}

// currentUser를 대체하는 mock 함수
export async function mockCurrentUser() {
  return {
    id: mockUser.clerkUserId,
    emailAddresses: [{ emailAddress: mockUser.email }],
    firstName: mockUser.name.split(' ')[0],
    lastName: mockUser.name.split(' ')[1] || '',
    username: 'admin',
    imageUrl: null,
  };
}