import { PageHeader } from "@/shared/shell/page-header";

const TABS = [
  { icon: "profile", label: "Profile", href: "/profile" },
  { icon: "appearance", label: "Appearance", href: "/appearance" },
  { icon: "plan", label: "Plan", href: "/settings/plan" },
] as const;

/** Settings: Profile, Appearance and Plan share one header with tabs. */
export default function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div>
      <PageHeader icon="settings" title="Settings" description="Manage your profile, colours and test plan." tabs={TABS} tabsLabel="Settings sections" />
      {children}
    </div>
  );
}
