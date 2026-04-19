import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthPage } from "@/pages/AuthPage";
import { MainLayout } from "@/layouts/MainLayout";
import {
  getStoredAuthUser,
  isProfileSetupRequired,
  persistAuthUserWithSettings,
  type AuthUser,
} from "@/lib/appAuth";
import { ExplorePage } from "@/pages/ExplorePage";
import { CreateEventPage } from "@/pages/CreateEventPage";
import { CreateExperiencePage } from "@/pages/CreateExperiencePage";
import { CreateJobPage } from "@/pages/CreateJobPage";
import { CreateAdPage } from "@/pages/CreateAdPage";
import { CreatePage } from "@/pages/CreatePage";
import { CreateSkillPostPage } from "@/pages/CreateSkillPostPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { HomePage } from "@/pages/HomePage";
import { HumanVerificationPage } from "@/pages/HumanVerificationPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ProfileSetupPage } from "@/pages/ProfileSetupPage";
import { ReelsPage } from "@/pages/ReelsPage";
import { SettingsPage } from "@/pages/SettingsPage";

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const needsProfileSetup = authUser ? isProfileSetupRequired(authUser) : false;

  useEffect(() => {
    const storedUser = getStoredAuthUser();
    setAuthUser(storedUser);

    if (!storedUser) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    persistAuthUserWithSettings(storedUser)
      .then((nextUser) => {
        if (!isCancelled) {
          setAuthUser(nextUser);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
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
              <Navigate
                to={
                  needsProfileSetup
                    ? "/complete-profile"
                    : "/"
                }
                replace
              />
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
          <Route path="create" element={<CreatePage authUser={authUser!} />} />
          <Route path="create/ad" element={<CreateAdPage authUser={authUser!} />} />
          <Route path="create/event" element={<CreateEventPage authUser={authUser!} />} />
          <Route path="create/job" element={<CreateJobPage authUser={authUser!} />} />
          <Route path="create/post" element={<CreateSkillPostPage authUser={authUser!} />} />
          <Route path="create/experience" element={<CreateExperiencePage authUser={authUser!} />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="reels" element={<ReelsPage authUser={authUser!} />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="profile/:username" element={<ProfilePage />} />
          <Route
            path="verification"
            element={<HumanVerificationPage authUser={authUser!} onVerificationCompleted={setAuthUser} />}
          />
          <Route path="settings" element={<SettingsPage authUser={authUser!} onSettingsUpdated={setAuthUser} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
