/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import { LoginPage } from "./components/LoginPage";
import { ERPLayout } from "./components/ERPLayout";
import { ShieldAlert, RefreshCw, LogOut } from "lucide-react";

const AppContent: React.FC = () => {
  const { user, userProfile, loading, error, logout } = useAuth();

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center font-sans gap-4">
        <div className="flex items-center gap-1.5 animate-pulse bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 shadow-xl">
          <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
          <span className="text-sm font-bold tracking-tight text-white">
            Syncing Authorization Channels...
          </span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State
  if (!user) {
    return <LoginPage />;
  }

  // 3. User Role Based Authorization Router (Protected Routes)
  const role = userProfile?.role;

  if (role === "owner" || role === "manager" || role === "worker") {
    return <ERPLayout />;
  }

  // 4. Fallback Sign-up Pending / Unauthorized Screen
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center font-sans px-4">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
        <h1 className="text-xl font-extrabold text-white">Awaiting Access Allocation</h1>
        <p className="text-slate-400 text-xs leading-relaxed">
          Your profile has been created successfully for email <strong>{user.email}</strong>, but a database administrator (Owner or Manager) has not assigned an active corporate access role to this account yet.
        </p>
        <div className="border border-slate-800 p-3 rounded-xl bg-slate-950/50 text-[11px] text-slate-500 leading-normal">
          If you are testing the app, try clicking the <strong>"Instant Demo Provisioner"</strong> options on the login screen to seed and auto-route.
        </div>
        <div className="pt-2 flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Check Status
          </button>
          <button
            onClick={logout}
            className="flex-1 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 hover:border-red-600 font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
          >
            Return to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
