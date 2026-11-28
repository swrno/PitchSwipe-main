import { redirect } from "next/navigation";

/** The website tab lives at /products/[id]/site; old links to /connect land there. */
export default async function ConnectRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/products/${encodeURIComponent(id)}/site`);
}
