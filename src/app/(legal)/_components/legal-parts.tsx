import { cn } from "@/shared/lib/utils";
import { SUPPORT_EMAIL_PENDING, supportEmail } from "../_lib/support";

/** The banner at the top of every draft legal text. */
export function DraftBanner() {
  return (
    <div role="note" className="rounded-xl bg-card border border-border neutral-ink px-5 py-4">
      <p className="text-sm font-bold md:text-base">Draft for review. Not legal advice; have it reviewed before launch.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        This text describes what the PitchSwipe code does today. It is not in effect yet.
      </p>
    </div>
  );
}

/** A visible gap the business still has to fill in. Never a made-up value. */
export function ToConfirm({ children }: { children: React.ReactNode }) {
  return (
    <span className="box-decoration-clone rounded-md bg-muted px-1.5 py-0.5 text-[0.95em] font-semibold text-foreground ring-1 ring-border">
      [{children}: to be confirmed before launch]
    </span>
  );
}

/** Page title block for a legal page. */
export function LegalHeader({ kicker, title, intro }: { kicker: string; title: string; intro: React.ReactNode }) {
  return (
    <header className="space-y-3">
      <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{kicker}</span>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl text-[2.1rem] md:text-5xl">{title}</h1>
      <p className="max-w-[60ch] text-base text-muted-foreground md:text-lg">{intro}</p>
    </header>
  );
}

/** Readable prose: spacing, lists and links for plain HTML children. */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "text-[0.975rem] leading-7 md:text-base",
        "[&_h2]:mt-12 [&_h2]:scroll-mt-6 [&_h2]:text-2xl [&_h2]:leading-tight md:[&_h2]:text-3xl",
        "[&_h3]:mt-7 [&_h3]:text-lg [&_h3]:font-bold",
        "[&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5",
        "[&_li]:pl-1 [&_li::marker]:text-muted-foreground [&_strong]:font-bold",
        "[&_a]:font-semibold [&_a]:underline [&_a]:decoration-2 [&_a]:underline-offset-4 [&_a:hover]:text-accent",
        "[&_a]:rounded-sm [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-ring",
        "[&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:break-all",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Table of contents for a long legal page. */
export function Contents({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="rounded-xl bg-card p-5">
      <p className="text-sm font-bold">On this page</p>
      <ol className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {i + 1}. {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The support / grievance address (contract C7), or the "published before launch" line. */
export function SupportContact() {
  const email = supportEmail();
  if (!email) return <>{SUPPORT_EMAIL_PENDING}</>;
  return <a href={`mailto:${email}`}>{email}</a>;
}
