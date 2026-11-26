import React, { useState } from "react";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SimulationPage from "./pages/SimulationPage";
import ReportPage from "./pages/ReportPage";

export default function App() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login"); // login | dashboard | simulation | report
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [reportAttemptId, setReportAttemptId] = useState(null);

  if (!token || !user || view === "login") {
    return (
      <LoginPage
        onAuthSuccess={(newToken, newUser) => {
          setToken(newToken);
          setUser(newUser);
          setView("dashboard");
        }}
      />
    );
  }

  if (view === "simulation" && activeAttempt) {
    return (
      <SimulationPage
        token={token}
        attempt={activeAttempt}
        onFinishAttempt={(attemptId, updatedUser) => {
          if (updatedUser) setUser(updatedUser);
          setReportAttemptId(attemptId);
          setActiveAttempt(null);
          setView("report");
        }}
        onExit={() => {
          setActiveAttempt(null);
          setView("dashboard");
        }}
      />
    );
  }

  if (view === "report" && reportAttemptId) {
    return (
      <ReportPage
        token={token}
        attemptId={reportAttemptId}
        onBackDashboard={() => setView("dashboard")}
      />
    );
  }

  return (
    <DashboardPage
      token={token}
      user={user}
      onStartAttempt={(attempt) => {
        setActiveAttempt(attempt);
        setView("simulation");
      }}
      onLogout={() => {
        setToken("");
        setUser(null);
        setView("login");
      }}
    />
  );
}
