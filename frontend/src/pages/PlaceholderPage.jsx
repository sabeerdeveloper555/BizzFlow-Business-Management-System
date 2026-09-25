import { Card, PageHeader } from "../components/ui/index.js";

export default function PlaceholderPage({ title }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="This workspace is ready for the next implementation phase."
      />
      <Card className="flex items-center justify-center py-16 text-center">
        <p className="text-sm text-zinc-500">
          Nothing to show here yet. Check back soon.
        </p>
      </Card>
    </div>
  );
}
