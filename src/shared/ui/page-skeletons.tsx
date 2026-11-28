import { Card } from "./card";
import { Skeleton, SkeletonCard, SkeletonKpiRow, SkeletonList, SkeletonPageHeader, SkeletonRegion, SkeletonText } from "./skeleton";

/**
 * Page-shaped loading bodies. Route `loading.tsx` files and the client screens share these, so the skeleton that
 * shows on navigation is the same one that shows while data loads (no flash between the two). Headers that a
 * layout already owns (Earnings, Settings, Product tabs) are not repeated here.
 */

function ProductSectionSkeleton({ tests = 2 }: { tests?: number }) {
  return (
    <Card aria-hidden>
      <div className="flex items-center gap-3 p-4">
        <Skeleton className="size-11 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-56 max-w-full" />
        </div>
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
      <SkeletonList rows={tests} avatar="none" className="border-t border-border px-4" />
    </Card>
  );
}

export function OverviewSkeleton() {
  return (
    <SkeletonRegion label="your overview" className="space-y-6">
      <SkeletonCard className="border-l-2 border-l-border" bodyClassName="px-4 py-0" title={false}>
        <Skeleton className="mt-4 h-6 w-44" />
        <SkeletonList rows={1} avatar="none" trailing={false} />
      </SkeletonCard>
      <SkeletonKpiRow count={4} />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2 md:col-span-2">
          <Skeleton className="h-7 w-32" />
          <Card aria-hidden className="px-4"><SkeletonList rows={3} avatar="none" /></Card>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Card aria-hidden className="px-4"><SkeletonList rows={3} avatar="round" trailing={false} /></Card>
        </div>
      </div>
    </SkeletonRegion>
  );
}

export function OverviewPageSkeleton() {
  return (
    <div>
      <SkeletonPageHeader actions={1} />
      <OverviewSkeleton />
    </div>
  );
}

/** Filter chips + product sections with their test rows + the "New product" row. */
export function ProductsListSkeleton({ withChips = true }: { withChips?: boolean }) {
  return (
    <SkeletonRegion label="your tests" className="space-y-4">
      {withChips ? (
        <div aria-hidden className="flex gap-2 py-1">
          {[16, 14, 20, 20].map((w, i) => <Skeleton key={i} className="h-11 rounded-lg" style={{ width: `${w * 4}px` }} />)}
        </div>
      ) : null}
      <ProductSectionSkeleton tests={2} />
      <ProductSectionSkeleton tests={1} />
    </SkeletonRegion>
  );
}

export function ProductsPageSkeleton() {
  return (
    <div>
      <SkeletonPageHeader actions={1} />
      <ProductsListSkeleton />
    </div>
  );
}

/** Product > Tests tab: count line + test rows. */
export function ProductTestsSkeleton() {
  return (
    <SkeletonRegion label="tests" className="space-y-4">
      <div aria-hidden className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <Card aria-hidden className="px-4"><SkeletonList rows={3} avatar="none" /></Card>
    </SkeletonRegion>
  );
}

/** Product > Overview tab. */
export function ProductOverviewSkeleton() {
  return (
    <SkeletonRegion label="the product" className="space-y-6">
      <SkeletonKpiRow count={4} />
      <div className="grid gap-6 md:grid-cols-3">
        <SkeletonCard className="md:col-span-2" bodyClassName="py-0 px-4"><SkeletonList rows={3} avatar="none" /></SkeletonCard>
        <SkeletonCard><SkeletonText lines={4} /></SkeletonCard>
      </div>
    </SkeletonRegion>
  );
}

/** Product > Website tab: steps card beside the status card. */
export function ProductSiteSkeleton() {
  return (
    <SkeletonRegion label="your website settings" className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <SkeletonCard>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <SkeletonText lines={2} className="flex-1" />
            </div>
          ))}
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </SkeletonCard>
      <SkeletonCard><SkeletonText lines={5} /></SkeletonCard>
    </SkeletonRegion>
  );
}

function FieldSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div aria-hidden className={wide ? "space-y-2 md:col-span-2" : "space-y-2"}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  );
}

/** Product settings form (identity + details) with the side preview card. */
export function ProductFormSkeleton() {
  return (
    <SkeletonRegion label="product settings" className="grid gap-6 md:grid-cols-[minmax(0,1fr)_24rem] md:items-start">
      <div className="space-y-6">
        <SkeletonCard>
          <div className="grid gap-5 md:grid-cols-2"><FieldSkeleton wide /><FieldSkeleton /><FieldSkeleton /></div>
        </SkeletonCard>
        <SkeletonCard>
          <div className="grid gap-5 md:grid-cols-2"><FieldSkeleton /><FieldSkeleton /><FieldSkeleton wide /></div>
        </SkeletonCard>
      </div>
      <Card aria-hidden className="p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-2xl" />
          <div className="flex-1 space-y-2"><Skeleton className="h-5 w-2/5" /><Skeleton className="h-3.5 w-3/5" /></div>
        </div>
        <SkeletonText lines={3} className="mt-5" />
      </Card>
    </SkeletonRegion>
  );
}

/** New test wizard: header already above; progress line, question and a form card. */
export function WizardSkeleton() {
  return (
    <SkeletonRegion label="the test wizard" className="space-y-6">
      <div aria-hidden className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <SkeletonCard title={false}>
        <div className="space-y-5">
          <Skeleton className="h-8 w-1/2 rounded-lg" />
          <Skeleton className="h-36 w-full rounded-lg" />
          <div className="flex justify-end"><Skeleton className="h-11 w-32 rounded-lg" /></div>
        </div>
      </SkeletonCard>
    </SkeletonRegion>
  );
}

export function WizardPageSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader className="mb-0" />
      <WizardSkeleton />
    </div>
  );
}

/** Swipe home: categories card with chips and CTA, stat tiles, "how swiping works". */
export function SwipeHomeSkeleton({ header = true }: { header?: boolean }) {
  return (
    <SkeletonRegion label="swipe" className="space-y-6">
      {header ? <SkeletonPageHeader className="mb-0" /> : null}
      <Card aria-hidden className="p-5">
        <Skeleton className="h-4 w-48" />
        <div className="mt-3 flex flex-wrap gap-2">
          {[24, 20, 28, 22, 18, 26].map((w, i) => <Skeleton key={i} className="h-11 rounded-lg" style={{ width: `${w * 4}px` }} />)}
        </div>
        <Skeleton className="mt-5 h-12 w-full rounded-lg md:w-80" />
      </Card>
      <div aria-hidden className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className={`space-y-2 p-4 ${i === 2 ? "hidden md:block" : ""}`}>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3.5 w-24" />
          </Card>
        ))}
      </div>
      <div aria-hidden className="space-y-3">
        <Skeleton className="h-7 w-44" />
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="flex items-start gap-4 p-4 md:flex-col md:gap-3">
              <Skeleton className="size-5 shrink-0" />
              <SkeletonText lines={2} className="w-full" />
            </Card>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}

/** Wallet: balance card, progress, activity list, note. */
export function WalletSkeleton() {
  return (
    <SkeletonRegion label="your wallet" className="space-y-4">
      <Card aria-hidden className="flex items-center justify-between gap-4 p-5">
        <div className="space-y-2"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-9 w-32" /></div>
        <Skeleton className="h-11 w-32 rounded-lg" />
      </Card>
      <Skeleton className="h-2 w-full rounded-full" />
      <SkeletonCard bodyClassName="py-0 px-4"><SkeletonList rows={4} avatar="round" /></SkeletonCard>
    </SkeletonRegion>
  );
}

/** History: summary row, filter tabs, grouped rows. */
export function HistorySkeleton() {
  return (
    <SkeletonRegion label="your history" className="space-y-4">
      <SkeletonKpiRow count={3} />
      <div aria-hidden className="flex gap-2"><Skeleton className="h-11 w-20 rounded-lg" /><Skeleton className="h-11 w-20 rounded-lg" /><Skeleton className="h-11 w-20 rounded-lg" /></div>
      <div aria-hidden className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Card className="px-4"><SkeletonList rows={3} /></Card>
        <Skeleton className="h-4 w-28" />
        <Card className="px-4"><SkeletonList rows={2} /></Card>
      </div>
    </SkeletonRegion>
  );
}

/** Settings > Profile: status card, then the form and the side card. */
export function ProfileSkeleton() {
  return (
    <SkeletonRegion label="your profile" className="space-y-6">
      <Card aria-hidden className="flex items-center gap-4 p-5">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <SkeletonText lines={2} className="flex-1" />
      </Card>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem]">
        <SkeletonCard><div className="space-y-5"><FieldSkeleton /><FieldSkeleton /><FieldSkeleton /></div></SkeletonCard>
        <SkeletonCard><SkeletonText lines={5} /></SkeletonCard>
      </div>
    </SkeletonRegion>
  );
}

/** Settings > Appearance: a palette card and a mode card. */
export function AppearanceSkeleton() {
  return (
    <SkeletonRegion label="appearance" className="space-y-6">
      <SkeletonCard>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </SkeletonCard>
      <SkeletonCard><SkeletonText lines={2} /></SkeletonCard>
    </SkeletonRegion>
  );
}

/** Settings > Plan: intro line, tests-left card, plan cards. */
export function PlanSkeleton() {
  return (
    <SkeletonRegion label="plans" className="space-y-6">
      <SkeletonText lines={1} className="max-w-md" />
      <Card aria-hidden className="space-y-3 p-4"><Skeleton className="h-9 w-64" /><Skeleton className="h-2 w-full rounded-full" /></Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} title={false}>
            <div className="space-y-4"><Skeleton className="h-5 w-32" /><Skeleton className="h-8 w-24" /><SkeletonText lines={3} /></div>
          </SkeletonCard>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** Ask panel: an assistant bubble, a user bubble and a pending reply. */
export function AskMessagesSkeleton() {
  return (
    <SkeletonRegion label="the chat" className="space-y-4">
      <div aria-hidden className="space-y-4">
        <Skeleton className="h-16 w-[85%] rounded-2xl" />
        <div className="flex justify-end"><Skeleton className="h-10 w-[55%] rounded-2xl" /></div>
        <Skeleton className="h-24 w-[90%] rounded-2xl" />
      </div>
    </SkeletonRegion>
  );
}

/** Practice flow while the cards load: one pitch-card-shaped block. */
export function PracticeCardsSkeleton() {
  return (
    <SkeletonRegion label="your practice cards" className="mt-6">
      <div aria-hidden className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="size-[60px] rounded-2xl md:size-14" />
          <div className="flex-1 space-y-2"><Skeleton className="h-5 w-2/5 rounded-full" /><Skeleton className="h-3.5 w-3/5 rounded-full" /></div>
        </div>
        <div className="mt-5 space-y-2.5"><Skeleton className="h-7 w-11/12 rounded-lg" /><Skeleton className="h-7 w-3/5 rounded-lg" /></div>
        <SkeletonText lines={2} className="mt-4" />
        <Skeleton className="mt-4 h-11 rounded-xl" />
      </div>
    </SkeletonRegion>
  );
}

/** Quality result: score ring beside metric rows. */
export function QualityResultSkeleton() {
  return (
    <SkeletonRegion label="your result" className="space-y-6 py-6">
      <div aria-hidden className="flex flex-col items-center gap-3">
        <Skeleton className="size-40 rounded-full" />
        <Skeleton className="h-6 w-48" />
      </div>
      <SkeletonCard><SkeletonList rows={3} avatar="none" /></SkeletonCard>
    </SkeletonRegion>
  );
}

/** Website shipped view: heading lines and a details card. */
export function WebsiteShippedSkeleton() {
  return (
    <SkeletonRegion label="your website view" className="space-y-6">
      <SkeletonKpiRow count={3} />
      <SkeletonCard><SkeletonList rows={3} avatar="none" /></SkeletonCard>
    </SkeletonRegion>
  );
}
