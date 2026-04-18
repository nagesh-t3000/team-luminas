import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "@/pages/AuthPage";
import { MainLayout } from "@/layouts/MainLayout";
import {
  getStoredAuthUser,
  isProfileSetupRequired,
  type AuthUser,
} from "@/lib/appAuth";
import { ExplorePage } from "@/pages/ExplorePage";
import { HomePage } from "@/pages/HomePage";
import { MessagesPage } from "@/pages/MessagesPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ProfileSetupPage } from "@/pages/ProfileSetupPage";
import { ReelsPage } from "@/pages/ReelsPage";

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const needsProfileSetup = authUser ? isProfileSetupRequired(authUser) : false;

  useEffect(() => {
    setAuthUser(getStoredAuthUser());
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ig-bg px-6 text-sm text-ig-muted">
        Loading Luminas...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={
            authUser ? (
              <Navigate to={needsProfileSetup ? "/complete-profile" : "/"} replace />
            ) : (
              <AuthPage onAuthenticated={setAuthUser} />
            )
          }
        />
        <Route
          path="/complete-profile"
          element={
            authUser ? (
              needsProfileSetup ? (
                <ProfileSetupPage
                  authUser={authUser}
                  onProfileCompleted={setAuthUser}
                />
              ) : (
                <Navigate to="/" replace />
              )
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route
          element={
            authUser ? (
              needsProfileSetup ? (
                <Navigate to="/complete-profile" replace />
              ) : (
                <MainLayout />
              )
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        >
          <Route index element={<HomePage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="reels" element={<ReelsPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="profile/:username" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
