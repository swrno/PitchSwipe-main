import { ConnectWebsite } from "@/components/sites";

export const dynamic = "force-dynamic";

/**
 * F2b Connect website (web 05). docs/designs/README.md names /products/[id]/site; this folder is
 * connect/, so link here (or add a one-line redirect at .../site/page.tsx).
 */
export default async function ConnectWebsitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConnectWebsite productId={id} />;
}
