import { Badge } from "@/components/ui/badge";

/** Stub for screens built in later work packages. Shows the design it will follow. */
export function PlaceholderScreen({
  title,
  designId,
  workPackage,
}: {
  title: string;
  designId: string;
  workPackage: string;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-4xl">{title}</h1>
      <div className="flex flex-wrap gap-2">
        <Badge variant="muted">Design {designId}</Badge>
        <Badge variant="muted">Built in {workPackage}</Badge>
      </div>
    </div>
  );
}
