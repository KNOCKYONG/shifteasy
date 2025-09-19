import DashboardClient from './DashboardClient';

export default function DashboardPage() {
  // Render a client component that shows content only after mount,
  // avoiding SSR/CSR mismatches in production.
  return <DashboardClient />;
}
