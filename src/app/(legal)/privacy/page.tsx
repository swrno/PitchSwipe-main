import type { Metadata } from "next";
import Link from "next/link";
import { VOICE_LANGUAGE_STORAGE_KEY } from "@/features/claims/languages";
import { AUDIO_RETENTION_DAYS, MAX_COMMENT_CHARS, MAX_VOICE_SECONDS } from "@/features/claims/rules";
import { THEME_STORAGE_KEY } from "@/shared/lib/feel/theme";
import { INTERACTION_FLOOR_MS, PAID_RATE_RS } from "@/features/swipe/validity";
import { formatRs } from "@/shared/lib/utils";
import { Contents, DraftBanner, LegalHeader, Prose, SupportContact, ToConfirm } from "../_components/legal-parts";
import { supportEmail } from "../_lib/support";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Draft privacy notice: what PitchSwipe collects, why, who sees it and how to delete it.",
};

// Browser keys that are not exported as constants (src/shared/lib/feel/haptics.ts, src/features/swipe/ui/client.ts).
const HAPTICS_KEY = "ps:haptics";
const SWIPER_GUID_KEY = "pitchswipe.swiper";
// src/features/quality/ui/storage.ts
const QUALITY_RESULT_KEY = "pitchswipe.quality.result";
// src/features/auth/ui/verify-panel.tsx (SENT_AT_KEY, not exported)
const VERIFY_SENT_AT_KEY = "ps:verify-sent-at";

const SECTIONS = [
  { id: "who", label: "Who we are" },
  { id: "collect", label: "What we collect" },
  { id: "founders-see", label: "What founders see" },
  { id: "why", label: "Why we use it" },
  { id: "providers", label: "Services that process it" },
  { id: "browser", label: "Cookies and browser storage" },
  { id: "money", label: "Earnings" },
  { id: "retention", label: "How long we keep it" },
  { id: "rights", label: "Your rights" },
  { id: "grievance", label: "Grievances and contact" },
  { id: "changes", label: "Changes" },
];

export default function PrivacyPage() {
  const email = supportEmail();
  return (
    <div className="rise-children space-y-6">
      <DraftBanner />
      <LegalHeader
        kicker="Privacy notice"
        title="Your data on PitchSwipe"
        intro="Plain English: what we collect, why, who sees it, and how to get it deleted. Written from what the app actually does."
      />
      <Contents items={SECTIONS} />

      <Prose>
        <h2 id="who">1. Who we are</h2>
        <p>
          PitchSwipe lets founders test one change at a time on a pitch card, and lets swipers answer those cards. The
          service is run by <ToConfirm>legal entity name and registered address</ToConfirm>. Under India&apos;s Digital
          Personal Data Protection Act, 2023 (DPDP Act) that entity is the &quot;data fiduciary&quot; for your personal data.
        </p>

        <h2 id="collect">2. What we collect</h2>
        <h3>Your account</h3>
        <ul>
          <li>
            <strong>Email address</strong> and the password or other sign-in method you use. Sign-in is handled by
            Firebase Authentication (Google). We never see or store your password.
          </li>
          <li>
            <strong>Whether your email is verified</strong>, copied from Firebase each time you sign in.
          </li>
        </ul>
        <h3>Your profile</h3>
        <ul>
          <li>
            <strong>Name, role and state</strong> (needed to create a profile), chosen from our lists.
          </li>
          <li>
            <strong>Interests</strong> (optional), chosen from a list of industries. They decide which ideas you are shown
            and are shared with founders as described below.
          </li>
          <li>
            <strong>Account type</strong>: swiper, founder or both.
          </li>
        </ul>
        <h3>The quality check</h3>
        <p>
          Before the swipes from your account count, you answer a few practice cards. We store the resulting score (0 to 100), whether your
          swipes count yet, and the reasons if they do not.
        </p>
        <h3>Your answers (swipes)</h3>
        <ul>
          <li>Which card you saw and your answer (yes or no).</li>
          <li>
            How long the card was on screen, measured by our server. Answers faster than {INTERACTION_FLOOR_MS} ms are
            ignored and not stored at all.
          </li>
          <li>Whether you came from the feed or a shared link, and the time.</li>
          <li>Your role at the time, and whether you match the founder&apos;s target users.</li>
          <li>
            <strong>An estimated state</strong>, when our hosting provider supplies one from your network address. We do
            not store or show your IP address with your answers. Outside India, or when no estimate is available, this is left
            empty.
          </li>
          <li>Whether the answer was valid and whether it counted.</li>
        </ul>
        <h3>Comments and voice notes (optional)</h3>
        <ul>
          <li>A typed comment of up to {MAX_COMMENT_CHARS} characters.</li>
          <li>
            A voice note of up to {MAX_VOICE_SECONDS} seconds, in the language you pick, if you are signed in with a
            verified email. On the website, your browser&apos;s own speech service turns your speech into text (for
            example Google in Chrome, or Apple in Safari), under that company&apos;s terms. In our apps, your
            phone&apos;s own speech service does it instead: usually Google&apos;s on Android, Apple&apos;s on iPhone (the
            iPhone app does not offer voice notes yet). We do not receive the recording to do this.
          </li>
          <li>
            For a language other than English, only the text is sent to our AI provider (Groq) to translate it into English.
            You review and can edit both before you send. We store the text, the English, the language and the length.
          </li>
          <li>
            <strong>The audio itself is uploaded and kept only if you tick &quot;Let the founder play my voice note&quot;</strong>{" "}
            (off by default). Kept audio is deleted automatically {AUDIO_RETENTION_DAYS} days after it was recorded; the
            text and translation stay with your answer. You can delete a voice note before you send it.{" "}
            <strong>In the apps no audio is kept at all</strong>: the phone&apos;s speech service listens, so there is
            no recording to keep, and the founder cannot play it.
          </li>
        </ul>
        <h3>Reward claims</h3>
        <p>
          If you tap &quot;Claim reward&quot; after answering, we store your <strong>verified profile email</strong> against
          that idea and pass it to its founder, so they can contact you about it (for example a waitlist). We never take
          an email typed into the request, and nothing is claimed unless you tap.
        </p>
        <h3>If you swipe without an account</h3>
        <p>
          Your browser gets a random id (see section 6). It is used to pick which version of a card you see and to keep
          track of the ideas you have already answered. It does not contain your name or email.
        </p>
        <ul>
          <li>
            <strong>Through a founder&apos;s shared link:</strong> your answers count toward that founder&apos;s results
            without the quality check. They are marked as coming from &quot;Your link (not verified)&quot;, and they never
            earn anything.
          </li>
          <li>
            <strong>On the feed:</strong> answers given without an account do not count toward results or earnings.
          </li>
        </ul>
        <h3>If you are a founder</h3>
        <ul>
          <li>Your products, tests and cards, audience settings, and whether your name is shown on cards.</li>
          <li>
            If you connect your website: its domain and the text of the elements you test. The snippet on your site sends
            us those elements; the caller&apos;s address is reduced to a one-way hash and used only for rate limiting.
          </li>
          <li>
            Your account email, used to send you an export when you ask for one, and an automatic email when one of your
            tests is decided.
          </li>
        </ul>
        <h3>Technical data</h3>
        <p>
          To stop abuse, our servers count requests per network address for a short window. The address is first turned
          into a one-way hash, and the counters live only in server memory; they are not written to the database.
        </p>

        <h2 id="founders-see">3. What founders see</h2>
        <ul>
          <li>
            <strong>Totals and charts</strong>: how many people answered each version, the share who said yes, and splits
            by role, estimated state and interests.
          </li>
          <li>
            <strong>Individual answers without your identity</strong>: the card, yes or no, the time, the estimated state,
            your role and interests, and your comment text or voice-note translation. Founders never get your name, your
            email or your user id from an answer.
          </li>
          <li>
            <strong>Your voice</strong>: only if you ticked the box, and only until the audio is deleted after{" "}
            {AUDIO_RETENTION_DAYS} days.
          </li>
          <li>
            <strong>Your email</strong>: only if you tapped &quot;Claim reward&quot; on that founder&apos;s idea.
          </li>
        </ul>
        <p>Founders can download these results as files or have them emailed to their own verified address.</p>

        <h2 id="why">4. Why we use it</h2>
        <ul>
          <li>To run your account and keep it secure (sign-in, email verification, abuse limits).</li>
          <li>To show you ideas that match your interests, once each, in random order.</li>
          <li>To give founders honest results: which version of their pitch did better, and why people said so.</li>
          <li>To check answer quality, so careless or automated swipes do not count.</li>
          <li>To show your wallet (section 7).</li>
        </ul>
        <p>
          We rely on the consent you give when you create an account and when you choose optional extras (interests,
          comments, voice notes, keeping audio, claiming rewards). You can withdraw it at any time (section 9).{" "}
          <ToConfirm>legal basis wording reviewed against the DPDP Act and its rules</ToConfirm>
        </p>
        <p>We do not sell your data and we do not show ads.</p>

        <h2 id="providers">5. Services that process it</h2>
        <p>We use these providers to run PitchSwipe. Each receives only what its job needs.</p>
        <ul>
          <li>
            <strong>Firebase Authentication (Google)</strong>: sign-in, passwords and email verification.
          </li>
          <li>
            <strong>MongoDB</strong>: our database for profiles, answers, comments and claims.{" "}
            <ToConfirm>database host and region</ToConfirm>
          </li>
          <li>
            <strong>Flagsmith</strong>: decides which version of a card you see and measures the results. It receives your
            user id (or the random browser id) and, for valid counted answers only, whether you said yes and whether you
            claimed the reward.
          </li>
          <li>
            <strong>Your browser&apos;s or phone&apos;s speech service</strong> (not one we choose): when you record a
            voice note, your browser may send your speech to its maker (for example Google for Chrome, Apple for Safari,
            Microsoft for Edge) to turn it into text. In our apps the phone&apos;s own speech service does this (usually Google on
            Android, Apple on iPhone), and may send your speech to that company. That company&apos;s privacy terms apply
            to it.
          </li>
          <li>
            <strong>Groq</strong> (running OpenAI&apos;s open-weight gpt-oss models): powers founder tools such as drafting
            cards, the results assistant and insights, and translates voice notes into English. It may receive a founder&apos;s product and test content,
            results, and swipers&apos; comment and voice-note text (never the audio). We do not attach swipers&apos; names or
            emails, but comments are sent as written, so avoid putting personal details in them.
          </li>
          <li>
            <strong>Resend</strong>: sends export emails and &quot;test decided&quot; alerts to founders. It receives the
            founder&apos;s email address and the email content.
          </li>
          <li>
            <strong>Microsoft Azure</strong>: hosts the app. <ToConfirm>hosting region</ToConfirm>
          </li>
          <li>
            <strong>Google Fonts</strong>: your browser loads our fonts from Google, which sees your network address.
          </li>
        </ul>
        <p>
          Some of these providers may process data outside India. <ToConfirm>list of countries and transfer terms</ToConfirm>
        </p>

        <h2 id="browser">6. Cookies and browser storage</h2>
        <p>We use no advertising or analytics cookies. This is what PitchSwipe keeps in your browser:</p>
        <ul>
          <li>
            <code>{THEME_STORAGE_KEY}</code> (local storage): dark or light mode.
          </li>
          <li>
            <code>{HAPTICS_KEY}</code> (local storage): whether vibration feedback is on.
          </li>
          <li>
            <code>{SWIPER_GUID_KEY}</code> (local storage): the random browser id described in section 2.
          </li>
          <li>
            <code>{VOICE_LANGUAGE_STORAGE_KEY}</code> (local storage): the language you last picked for voice notes, so
            the picker remembers it.
          </li>
          <li>
            <code>{QUALITY_RESULT_KEY}</code> (session storage, cleared when you close the tab): your latest quality-check
            result, for the result screen.
          </li>
          <li>Firebase sign-in session (browser storage set by Firebase), so you stay signed in.</li>
          <li>
            <code>{VERIFY_SENT_AT_KEY}</code> (session storage, cleared when you close the tab): when we last sent you a
            verification email, so the resend button can wait.
          </li>
          <li>An offline copy of the app shell, kept by our service worker so the app opens without a connection.</li>
        </ul>
        <p>Clearing your browser&apos;s site data removes all of these. You will need to sign in again.</p>

        <h2 id="money">7. Earnings</h2>
        <p>
          Paid cards show {formatRs(PAID_RATE_RS)} per valid, counted answer. <strong>Payouts are not live yet.</strong> No real
          money moves: there are no payouts, withdrawing is switched off, and we do not ask for bank or UPI details. If real
          payouts are added, we will update this notice first and tell you what extra data they need.
        </p>

        <h2 id="retention">8. How long we keep it</h2>
        <ul>
          <li>Account, profile and answers: while your account exists.</li>
          <li>
            Voice-note audio (only if you allowed it): deleted automatically after {AUDIO_RETENTION_DAYS} days. The text
            stays with your answer.
          </li>
          <li>Rate-limit counters: up to about ten minutes, in server memory only.</li>
          <li>
            When you delete your account (section 9): your profile, your sign-in, your wallet and your reward claims
            are erased. If you are a founder, your products, tests, connected sites, and every answer and claim collected on
            them are erased too.
          </li>
          <li>
            Answers you gave on other founders&apos; tests stay in their results, but are cut off from you: the link to your
            account is replaced by a random id, and your comments and voice notes are removed. The answer, the card, your
            role and estimated state at the time, and timing stay, so the founder&apos;s totals do not change.
          </li>
          <li>
            Events already sent to Flagsmith (section 5) are not removed by account deletion.{" "}
            <ToConfirm>Flagsmith retention and deletion</ToConfirm>
          </li>
          <li>
            Backups and logs: <ToConfirm>backup and log retention</ToConfirm>
          </li>
        </ul>

        <h2 id="rights">9. Your rights</h2>
        <p>Under the DPDP Act you can:</p>
        <ul>
          <li>Ask what personal data we hold about you and how we use it.</li>
          <li>
            Correct or update it. Your name, role, state and interests can be changed on your{" "}
            <Link href="/profile">Profile</Link> page.
          </li>
          <li>
            Have it erased. Delete your account yourself under &quot;Delete account&quot; on your{" "}
            <Link href="/profile">Profile</Link> page (it needs a verified email and cannot be undone)
            {email ? ", or ask us (section 10)" : ""}. Section 8 lists what is erased.
          </li>
          <li>Withdraw consent. This stops future use; it does not undo what was done before.</li>
          <li>Nominate someone to exercise these rights if you die or cannot act.</li>
          <li>Complain to us, and if you are not satisfied, to the Data Protection Board of India.</li>
        </ul>
        <p>
          PitchSwipe is not meant for children. <ToConfirm>minimum age and how it is checked</ToConfirm>
        </p>

        <h2 id="grievance">10. Grievances and contact</h2>
        <p>
          Grievance officer: <ToConfirm>name</ToConfirm>. Write to: <SupportContact />
        </p>
        <p>
          We will reply within <ToConfirm>response time</ToConfirm>.
        </p>

        <h2 id="changes">11. Changes</h2>
        <p>
          If we change how we use your data, we will update this page and, for important changes, tell you in the app
          before they apply. See also our <Link href="/terms">Terms</Link>.
        </p>
      </Prose>
    </div>
  );
}
