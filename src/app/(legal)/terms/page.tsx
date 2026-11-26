import type { Metadata } from "next";
import Link from "next/link";
import { MAX_COMMENT_CHARS } from "@/lib/claims/rules";
import { INTERACTION_FLOOR_MS, MIN_READ_MS, PAID_RATE_RS } from "@/lib/swipe/validity";
import { formatRs } from "@/lib/utils";
import { Contents, DraftBanner, LegalHeader, Prose, SupportContact, ToConfirm } from "../_components/legal-parts";
import { supportEmail } from "../_lib/support";

export const metadata: Metadata = {
  title: "Terms",
  description: "Draft terms of use for PitchSwipe: accounts, swiping, demo earnings and founder content.",
};

const SECTIONS = [
  { id: "about", label: "What PitchSwipe is" },
  { id: "account", label: "Your account" },
  { id: "swipers", label: "Swiping" },
  { id: "earnings", label: "Demo earnings" },
  { id: "founders", label: "Founders" },
  { id: "content", label: "Content and comments" },
  { id: "not-allowed", label: "Not allowed" },
  { id: "pricing", label: "Pricing" },
  { id: "ending", label: "Ending your account" },
  { id: "liability", label: "No guarantees" },
  { id: "law", label: "Law and disputes" },
  { id: "contact", label: "Changes and contact" },
];

export default function TermsPage() {
  const email = supportEmail();
  return (
    <div className="rise-children space-y-8">
      <DraftBanner />
      <LegalHeader
        kicker="Terms of use"
        title="The rules for using PitchSwipe"
        intro="Short and plain. By creating an account or answering cards you agree to these terms and to our Privacy notice."
      />
      <Contents items={SECTIONS} />

      <Prose>
        <h2 id="about">1. What PitchSwipe is</h2>
        <p>
          Founders put up a pitch card in two or more versions that differ in one thing (a headline, a price, a picture).
          Swipers read a card and answer one question. The results tell the founder which version people preferred. The
          service is provided by <ToConfirm>legal entity name and registered address</ToConfirm> (&quot;we&quot;).
        </p>

        <h2 id="account">2. Your account</h2>
        <ul>
          <li>Give a real email address and keep it verified. Some features need a verified email.</li>
          <li>Keep your sign-in details to yourself. You are responsible for what happens under your account.</li>
          <li>Use one account per person, and keep your profile (name, role, state) truthful.</li>
          <li>
            You must be at least <ToConfirm>minimum age</ToConfirm> to use PitchSwipe.
          </li>
        </ul>

        <h2 id="swipers">3. Swiping</h2>
        <ul>
          <li>Answer honestly. There is no right answer, and yes and no are treated the same.</li>
          <li>
            Before the answers from your account count, you complete a short quality check with practice cards. We may stop
            counting your answers if later checks show careless or automated swiping. Answers given without an account
            through a founder&apos;s shared link count for that founder without the check, are marked as not verified,
            and never earn anything.
          </li>
          <li>
            An answer is valid when the card was on screen for at least {MIN_READ_MS / 1000} seconds. Answers faster than{" "}
            {INTERACTION_FLOOR_MS} ms are ignored. You can answer each idea once.
          </li>
          <li>
            &quot;Claim reward&quot; is always your choice. Claiming shares your verified email with that idea&apos;s founder
            (see the <Link href="/privacy">Privacy notice</Link>). Any reward is offered by the founder, not by us.
          </li>
        </ul>

        <h2 id="earnings">4. Demo earnings</h2>
        <p>
          Paid cards show {formatRs(PAID_RATE_RS)} per valid, counted answer. <strong>These are demo earnings for now.</strong>{" "}
          No real money moves. The wallet balance is not money we owe you, it cannot be withdrawn or exchanged, and it may be
          reset. If we start real payouts, they will come with new terms that you will need to accept first.
        </p>

        <h2 id="founders">5. Founders</h2>
        <ul>
          <li>
            You are responsible for your cards. Claims, prices and pictures must be honest and yours to use, and must follow
            the law, including consumer protection and advertising rules.
          </li>
          <li>
            Results are statistics from real people&apos;s answers. The winner is decided by the numbers, not by AI, and
            nothing is changed on your website unless you approve it.
          </li>
          <li>
            AI tools (drafts, the results assistant, insights) make suggestions. Check them before you rely on them.
          </li>
          <li>
            Swiper emails you receive through claims may be used only to follow up about that idea, and you must handle
            them lawfully, including honouring requests to stop.
          </li>
          <li>Do not try to identify individual swipers from their answers.</li>
        </ul>

        <h2 id="content">6. Content and comments</h2>
        <ul>
          <li>
            Founders keep ownership of their cards. You let us store them and show them to swipers so the test can run.
          </li>
          <li>
            Swipers keep ownership of their comments (up to {MAX_COMMENT_CHARS} characters) and voice notes. You let us store
            them and share them with the founder of that idea, as set out in the Privacy notice.
          </li>
          <li>We may remove content that breaks these terms.</li>
        </ul>

        <h2 id="not-allowed">7. Not allowed</h2>
        <ul>
          <li>Bots, scripts, or several accounts used to swipe or to inflate results.</li>
          <li>Abusive, hateful, sexual, illegal or misleading content, in cards or in comments.</li>
          <li>Collecting other people&apos;s data, or using PitchSwipe to send spam.</li>
          <li>Probing, overloading or getting around our security limits.</li>
        </ul>

        <h2 id="pricing">8. Pricing</h2>
        <p>
          Nothing in the app charges you today. Any paid plans are <strong>planned pricing, not available yet</strong>; we
          will publish prices and terms before anything is charged. <ToConfirm>pricing and billing terms</ToConfirm>
        </p>

        <h2 id="ending">9. Ending your account</h2>
        <p>
          You can stop using PitchSwipe at any time. Delete your account under &quot;Delete account&quot; on your{" "}
          <Link href="/profile">Profile</Link> page{email ? ", or ask us to" : ""}. Deleting cannot be undone; the{" "}
          <Link href="/privacy#retention">Privacy notice</Link> lists what is erased. We may suspend or close accounts that break these
          terms. <ToConfirm>notice and appeal process</ToConfirm>
        </p>

        <h2 id="liability">10. No guarantees</h2>
        <p>
          PitchSwipe is provided as it is. Answers come from real people and can be noisy; results help you decide but do
          not promise how a product will sell. <ToConfirm>limitation of liability wording</ToConfirm>
        </p>

        <h2 id="law">11. Law and disputes</h2>
        <p>
          <ToConfirm>governing law, courts with jurisdiction and dispute process</ToConfirm>
        </p>

        <h2 id="contact">12. Changes and contact</h2>
        <p>
          We will post changes here and tell you in the app about important ones before they apply. Questions:{" "}
          <SupportContact />
        </p>
      </Prose>
    </div>
  );
}
