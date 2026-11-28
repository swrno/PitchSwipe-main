import { redirect } from "next/navigation";

/** Plans moved under Settings. */
export default function Page() {
  redirect("/settings/plan");
}
