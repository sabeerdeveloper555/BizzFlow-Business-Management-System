import { useNavigate } from "react-router-dom";
import { ShieldAlert, ArrowLeft, LayoutDashboard } from "lucide-react";
import { Button } from "../components/ui/index.js";

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-12 text-zinc-900 sm:px-6">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>

        <p className="mt-4 text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Error 403
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
          Access Denied
        </h1>
        <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
          You do not have permission to view or access this page. If you require elevated access, contact your system administrator.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button icon={LayoutDashboard} onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    </main>
  );
}
