import { Outlet } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

function AppLayout() {
  return (
    <div className="h-screen w-full font-mono text-white bg-[rgb(7,8,16)] flex flex-col overflow-hidden">
      <Header />

      <hr className="w-[98%] mx-auto border-0 h-px bg-gray-800 shrink-0" />

      <div className="flex flex-1 min-h-0">
        <Sidebar />

        <div className="w-px my-auto bg-gray-800 h-[97%] shrink-0" />

        <main className="flex-1 overflow-y-auto min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;