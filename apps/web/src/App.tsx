import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { AssetWorkspace } from '@/pages/AssetWorkspace';
import clsx from 'clsx';

// Lazy load heavy pages
const PlantSchematic = lazy(() => import('./pages/PlantSchematic').then(m => ({ default: m.PlantSchematic })));
const BuildingView = lazy(() => import('./pages/BuildingView').then(m => ({ default: m.BuildingView })));
const Alarms = lazy(() => import('./pages/Alarms').then(m => ({ default: m.Alarms })));
const Setpoints = lazy(() => import('./pages/LiveSetpoints').then(m => ({ default: m.LiveSetpoints })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Audit = lazy(() => import('./pages/Audit').then(m => ({ default: m.Audit })));
const Users = lazy(() => import('./pages/Users').then(m => ({ default: m.Users })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const ControllerHealth = lazy(() => import('./pages/ControllerHealth').then(m => ({ default: m.ControllerHealth })));
const Live = lazy(() => import('./pages/Live').then(m => ({ default: m.Live })));

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="flex flex-col items-center gap-4 text-content-tertiary">
          <svg className="animate-spin" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <div className="app min-h-screen bg-surface-base">
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-surface-base">
            <div className="text-content-tertiary">Loading...</div>
          </div>
        }>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/assets" element={<AssetWorkspace />} />
            <Route path="/plant" element={<PlantSchematic />} />
            <Route path="/building" element={<BuildingView />} />
            <Route path="/alarms" element={<Alarms />} />
            <Route path="/setpoints" element={<Setpoints />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/controllers" element={<ControllerHealth />} />
            <Route path="/live" element={<Live />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
