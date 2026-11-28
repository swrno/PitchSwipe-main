import { PageHeader } from "@/shared/shell/page-header";

const TABS = [
  { label: "Profile", href: "/profile" },
  { label: "Appearance", href: "/appearance" },
  { label: "Plan", href: "/settings/plan" },
] as const;

/** Settings: Profile, Appearance and Plan share one header with tabs. */
export default function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div>
      <PageHeader title="Settings" description="Your profile, how the app looks, and your plan." tabs={TABS} tabsLabel="Settings sections" />
      {children}
    </div>
  );
}
