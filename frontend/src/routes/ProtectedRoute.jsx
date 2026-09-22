import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { LoadingState } from "../components/common/PageState.jsx";

export default function ProtectedRoute() {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading)
    return (
      <main className="p-8">
        <LoadingState />
      </main>
    );
  if (!isAuthenticated)
    return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
