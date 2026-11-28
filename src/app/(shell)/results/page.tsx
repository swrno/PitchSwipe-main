import { redirect } from "next/navigation";

/** Folded into Products: each product has Insights and each deck its Results. */
export default function Page() {
  redirect("/products");
}
