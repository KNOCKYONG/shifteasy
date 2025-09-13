import { redirect } from 'next/navigation';

export default function Home() {
  // 메인 페이지 접속 시 dashboard 페이지로 자동 리다이렉트
  redirect('/dashboard');
}