import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Newrepositories from "./components/Newrepositories";
import My_repositories from "./components/My_repositories";
import My_deployments from "./components/My_deployments";
import Activity from "./components/Activity";
import Profile from "./components/Profile";
import User_settings from "./components/User_settings";
import Settings from "./components/Settings";
import AppLayout from "./layouts/AppLayout";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/newrepo" element={<Newrepositories />} />
          <Route path="/repositories" element={<My_repositories />} />
          <Route path="/deployments" element={<My_deployments />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/user_settings" element={<User_settings />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
