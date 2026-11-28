import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ShieldCheck, Trash2 } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";
import { ArrowChip } from "@/shared/ui/mascot";
import { cn } from "@/shared/lib/utils";
import { LegalHeader, ToConfirm } from "../_components/legal-parts";
import { SUPPORT_EMAIL_PENDING, supportEmail } from "../_lib/support";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach PitchSwipe for help, privacy requests and grievances.",
};

const linkClass =
  "rounded-sm font-semibold underline decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function ContactPage() {
  const email = supportEmail();

  const topics = [
    {
      icon: Mail,
      title: "Help with the app",
      body: "Sign-in trouble, a card that looks wrong, or a question about results.",
    },
    {
      icon: ShieldCheck,
      title: "Privacy and grievances",
      body: "Ask what data we hold, correct it, or raise a complaint under India's DPDP Act.",
    },
    {
      icon: Trash2,
      title: "Delete your account",
      body: email ? "Start from your Profile page, or write to us and we will do it for you." : "Start from your Profile page.",
    },
  ];

  return (
    <div className="rise-children space-y-6">
      <LegalHeader kicker="Contact" title="Talk to a human" intro="One address for help, privacy requests and grievances." />

      <section aria-labelledby="contact-email" className="rounded-xl relative overflow-hidden bg-card border border-border neutral-ink p-5 md:p-5">
        <h2 id="contact-email" className="max-w-[14ch] text-[1.6rem] md:text-3xl">
          Email us
        </h2>
        {email ? (
          <>
            <p className="mt-1 max-w-[34ch] pr-16 text-sm text-muted-foreground md:pr-32 md:text-base">Write from the address on your account if it is about your data.</p>
            <a
              href={`mailto:${email}`}
              className={cn(
                buttonVariants({ variant: "ink", size: "lg" }),
                "mt-5 w-full max-w-full justify-between gap-3 pl-6 pr-3 text-base md:w-auto md:min-w-80",
              )}
            >
              <span className="truncate">{email}</span>
              <ArrowChip />
            </a>
          </>
        ) : (
          <p className="mt-2 max-w-[38ch] pr-16 text-base font-semibold text-muted-foreground md:pr-32">{SUPPORT_EMAIL_PENDING}</p>
        )}
      </section>

      <ul className="grid gap-3 md:grid-cols-3 md:gap-4">
        {topics.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-4 rounded-xl border border-border bg-card p-4 md:flex-col md:gap-3">
            <span className="shrink-0 text-muted-foreground">
              <Icon aria-hidden className="size-5" strokeWidth={2.5} />
            </span>
            <div>
              <h3 className="text-base font-bold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-3 rounded-3xl border border-border p-5 text-sm leading-6 md:text-base">
        <p>
          <strong>Grievance officer:</strong> <ToConfirm>name</ToConfirm>
        </p>
        <p>
          <strong>Postal address:</strong> <ToConfirm>registered address</ToConfirm>
        </p>
        <p>
          <strong>Reply time:</strong> <ToConfirm>response time</ToConfirm>
        </p>
        <p className="text-muted-foreground">
          Read the{" "}
          <Link href="/privacy" className={linkClass}>
            Privacy notice
          </Link>{" "}
          and the{" "}
          <Link href="/terms" className={linkClass}>
            Terms
          </Link>
          . Your profile is at{" "}
          <Link href="/profile" className={linkClass}>
            Profile
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
