import {
  LayoutDashboard,
  Rocket,
  FolderKanban,
  Server,
  Settings,
  User,
  LogOut,
  Activity,
  FolderGit2,
  
} from "lucide-react";
import { NavLink } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-3 p-3 rounded-md border transition-all ${
    isActive
      ? "bg-emerald-400 font-bold text-white border-emerald-400"
      : "bg-transparent  text-[rgb(181,181,181)] border-black hover:border-emerald-400"
  }`;

function Sidebar() {
  return (
    <div className="w-60 shrink-0 text-sm flex gap-4 flex-col pt-4 px-3 overflow-y-auto">
      <NavLink to="/dashboard" className={navLinkClass}>
        <LayoutDashboard size={18} />
        Dashboard
      </NavLink>
      <NavLink to="/activity" className={navLinkClass}>
        <Activity size={18} />
        Activities
      </NavLink>


     
      <NavLink to="/newrepo" className={navLinkClass}>
        <FolderGit2 size={18} />
        New Project
      </NavLink>


      <NavLink to="/repositories" className={navLinkClass}>
        <FolderKanban size={18} />
        My Repositories
      </NavLink>

       {/* <NavLink to="/newdeploy" className={navLinkClass}>
        <Rocket size={18} />
        New Deployment
      </NavLink> */}

      <NavLink to="/deployments" className={navLinkClass}>
        <Server size={18} />
        My Deployments
      </NavLink>
      
      <hr className="w-[99%]  mx-auto border-0 h-px bg-gray-800" />

      
<NavLink to="/profile" className={navLinkClass}>
        <User size={18} />
        Profile
      </NavLink>
      <div className="">

        <NavLink to="/settings" className={navLinkClass}>
          <Settings size={18} />
          Settings
        </NavLink>
      </div>

      {/* <hr className="w-[99%]  mx-auto border-0 h-[0.5px] bg-gray-600" /> */}

      

     

    
      <a
        href={`${API_URL}/logout`}
        className="flex items-center justify-center gap-2 bg-[rgba(162,81,81,0.4)] mx-0 hover:cursor-pointer mt-auto mb-5 text-[rgb(255,26,26)] h-12 rounded-md"
      >
        <LogOut size={18} />
        Logout
      </a>
    </div>
  );
}

export default Sidebar;