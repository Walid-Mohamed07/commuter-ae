"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import authApi from "@/lib/api/auth";
import LanguageToggle from "./LanguageToggle";
import { useTranslations } from "next-intl";

export default function DriverNavbar() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();

  const LINKS = [
    { label: t("my_cycles"), href: "/driver/my-cycles" },
    { label: t("availability"), href: "/driver/availability" },
    { label: t("profile"), href: "/driver/profile" },
  ];
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [driverName, setDriverName] = useState(t("default_driver"));
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { name: authName, logout, profilePhoto } = useAuth();

  useEffect(() => {
    if (authName) setDriverName(authName);
  }, [authName]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // ignore — clear client session regardless
    }
    logout();
    router.replace("/");
  }

  const initials = driverName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <style>{`
        .cnav-link { text-decoration: none; transition: color 0.15s; }
        .cnav-link:hover { color: #fff !important; }
        .cnav-drop-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-size: 14px; font-weight: 500; text-decoration: none; width: 100%; background: none; border: none; cursor: pointer; font-family: inherit; }
        .cnav-drop-item:hover { background: #EFF7F6; }
        .cnav-drop-danger:hover { background: #FEF2F2; }
        .mobile-link { display: flex; align-items: center; height: 48px; padding: 0 20px; font-size: 15px; font-weight: 500; text-decoration: none; transition: color 0.15s; }
        @media (max-width: 767px) {
          .cnav-bar { padding: 0 16px !important; }
        }
      `}</style>

      <nav
        dir="ltr"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: 64,
          background: "#0B1E3D",
          alignItems: "center",
          padding: "0 32px",
          gap: 0,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
        className="cnav-bar hidden md:flex"
      >
        {/* Logo — left */}
        <Link
          href="/driver/my-cycles"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            flexShrink: 0,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#00C2A8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                color: "#0B1E3D",
                fontWeight: 900,
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              C
            </span>
          </div>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 18 }}>
            {tCommon("app_name")}
          </span>
        </Link>

        {/* Center nav links — true center of full navbar width */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            alignItems: "center",
            gap: 32,
          }}
          className="hidden md:flex"
        >
          {LINKS.map(({ label, href }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className="cnav-link"
                style={{
                  color: active ? "#fff" : "rgba(255,255,255,0.65)",
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  borderBottom: active
                    ? "2px solid #00C2A8"
                    : "2px solid transparent",
                  paddingBottom: 2,
                }}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right slot — language toggle + user dropdown (desktop) */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            position: "relative",
            zIndex: 1,
          }}
          className="hidden md:flex"
        >
          <LanguageToggle inverted />
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#fff",
                fontFamily: "inherit",
                padding: 0,
              }}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "#00C2A8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0B1E3D",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profilePhoto}
                    alt={driverName}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  initials
                )}
              </div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  maxWidth: 130,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {driverName}
              </span>
              <ChevronDown
                size={14}
                style={{
                  opacity: 0.7,
                  transition: "transform 0.15s",
                  transform: dropdownOpen ? "rotate(180deg)" : "none",
                }}
              />
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 10px)",
                  background: "#fff",
                  borderRadius: 10,
                  border: "1px solid #E2E8F0",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  minWidth: 168,
                  overflow: "hidden",
                  zIndex: 100,
                }}
              >
                <Link
                  href="/driver/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="cnav-drop-item"
                  style={{ color: "#0B1E3D" }}
                >
                  <User size={15} /> {t("profile")}
                </Link>
                <button
                  onClick={handleLogout}
                  className="cnav-drop-item cnav-drop-danger"
                  style={{ color: "#E74C3C", textAlign: "left" }}
                >
                  <LogOut size={15} /> {tCommon("sign_out")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile hamburger — hidden; bottom nav handles mobile navigation */}
      </nav>

      {/* Mobile bottom nav handles mobile navigation — no drawer needed */}
    </>
  );
}
