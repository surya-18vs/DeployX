import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Settings, LogOut, User } from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5002";

/* =========================================================
   OUTSIDE CLICK HOOK
========================================================= */

function useOutsideClick(onOutside) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        onOutside();
      }
    }

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onOutside]);

  return ref;
}

/* =========================================================
   NERO LOGO
========================================================= */


/* =========================================================
   HEADER
========================================================= */

function Header() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useOutsideClick(() => {
    setMenuOpen(false);
  });

  /* =======================================================
     FETCH GITHUB USER
  ======================================================= */

  useEffect(() => {
    fetch(`${API_URL}/user`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) {
          return null;
        }

        return res.json();
      })
      .then((data) => {
        if (data?.success) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  /* =======================================================
     USER INITIALS
  ======================================================= */

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user?.username
      ? user.username.slice(0, 2).toUpperCase()
      : "";

  /* =======================================================
     HEADER
  ======================================================= */

  return (
    <header
      style={{
        height: "100px",
        width: "100%",
        backgroundColor: "#000000",
        borderBottom: "1px solid #1f1f1f",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        boxSizing: "border-box",
        position: "relative",
        zIndex: 50,
      }}
    >
      {/* =================================================
          LEFT — NERO BRAND
      ================================================= */}

      <h1 className="text-[25px] tracking-tighter ml-3 font-bold text-white ">Deploy<span className="text-emerald-400">X</span><span className="text-sm font-extralight ml-3 text-gray-600"></span></h1>

      {/* =================================================
          RIGHT — USER SECTION
      ================================================= */}

      <div
        ref={menuRef}
        className="relative"
      >
        {/* USER BUTTON */}

        <button
          type="button"
          onClick={() => {
            setMenuOpen((previous) => !previous);
          }}
          className="
            h-13
            flex
            items-center
            gap-4
            
            pl-1.5
            pr-3
            rounded-full
            border
            border-gray-700
            bg-gray-950
            hover:border-gray-500
            transition-all
            duration-200
          "
        >
          {/* ================= AVATAR ================= */}

          <span
            id="user_github_profile"
            className="
              w-9
              h-9
              rounded-full
              overflow-hidden
              flex
              items-center
              justify-center
              bg-gray-800
              text-gray-300
              text-[10px]
              font-bold
              shrink-0
            "
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.username || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              initials || <User size={13} />
            )}
          </span>

          {/* ================= USER DETAILS ================= */}

          <div className="text-left leading-tight">
            <p className="text-sm text-gray-200 font-semibold">
              {user?.displayName || "..."}
            </p>

            <p className="text-xs text-gray-500">
              {user ? `@${user.username}` : ""}
            </p>
          </div>
        </button>

        {/* =================================================
            DROPDOWN MENU
        ================================================= */}

        {menuOpen && (
          <div
            className="
              absolute
              right-0
              top-full
              mt-2
              w-52
              bg-gray-950
              border
              border-gray-700
              rounded-lg
              shadow-2xl
              overflow-hidden
              z-50
            "
          >
            {/* ================= PROFILE ================= */}

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                navigate("/profile");
              }}
              className="
                w-full
                flex
                items-center
                gap-2
                px-4
                py-2.5
                text-sm
                text-gray-200
                hover:bg-gray-800
                transition-colors
                duration-150
              "
            >
              <User
                size={15}
                className="text-gray-400"
              />

              <span>Profile</span>
            </button>

            {/* ================= SETTINGS ================= */}

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                navigate("/settings");
              }}
              className="
                w-full
                flex
                items-center
                gap-2
                px-4
                py-2.5
                text-sm
                text-gray-200
                hover:bg-gray-800
                transition-colors
                duration-150
              "
            >
              <Settings
                size={15}
                className="text-gray-400"
              />

              <span>Settings</span>
            </button>

            {/* ================= LOGOUT ================= */}

            <a
              href={`${API_URL}/logout`}
              className="
                w-full
                flex
                items-center
                gap-2
                px-4
                py-2.5
                text-sm
                text-red-400
                hover:bg-red-950/30
                transition-colors
                duration-150
                border-t
                border-gray-800
              "
            >
              <LogOut size={15} />

              <span>Logout</span>
            </a>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;