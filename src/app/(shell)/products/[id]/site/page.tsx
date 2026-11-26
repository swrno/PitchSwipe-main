import { redirect } from "next/navigation";

/** The designs name the connect screen /products/[id]/site; the route lives at /products/[id]/connect. */
export default async function SiteRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/products/${encodeURIComponent(id)}/connect`);
}
