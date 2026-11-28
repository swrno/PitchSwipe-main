import { NOT_CONFIGURED_MESSAGE } from "@/shared/lib/config";

/** Shown instead of a page while MongoDB or the Firebase keys are missing. Never replaced by sample data. */
export function NotConfigured() {
  return (
    <section role="alert" className="mx-auto max-w-xl rounded-3xl border border-warning/40 bg-warning-soft p-6 warn-ink md:mt-6">
      <h1 className="text-2xl font-semibold tracking-tight">This server is not set up yet</h1>
      <p className="mt-2 text-base">{NOT_CONFIGURED_MESSAGE}</p>
    </section>
  );
}
