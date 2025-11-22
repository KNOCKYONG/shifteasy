import { createTRPCRouter } from '../trpc';

/**
 * 커뮤니티 기능은 현재 네비게이션에서
 * "서비스 준비중" 모달로만 노출되고,
 * 실제 백엔드 API는 사용하지 않습니다.
 *
 * 나중에 정식 커뮤니티 기능을 붙일 때
 * 이 라우터에 세부 로직을 다시 구현하면 됩니다.
 */
export const communityRouter = createTRPCRouter({});

