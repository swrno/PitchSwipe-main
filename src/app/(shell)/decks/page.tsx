import { redirect } from "next/navigation";

/** The deck list is now the Products page. */
export default function Page() {
  redirect("/products");
}
