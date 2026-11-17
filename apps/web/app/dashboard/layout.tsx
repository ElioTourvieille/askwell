import { UserButton } from "@clerk/nextjs";
import { APP_NAME } from "@askwell/shared";
import { DashboardShell } from "../../components/dashboard/DashboardShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="light" className="min-h-screen bg-bg text-fg">
      <DashboardShell appName={APP_NAME} userMenu={<UserButton />}>
        {children}
      </DashboardShell>
    </div>
  );
}
