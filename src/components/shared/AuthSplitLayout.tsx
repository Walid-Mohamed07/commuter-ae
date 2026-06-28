"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

interface AuthSplitLayoutProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  role: "driver" | "user";
}

function Logo() {
  return (
    <a
      href="/"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        textDecoration: "none",
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
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: "#0B1E3D",
            fontWeight: 900,
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          C
        </span>
      </div>
      <span
        style={{
          color: "#ffffff",
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: "0.02em",
        }}
      >
        commuter
      </span>
    </a>
  );
}

function BackLink() {
  const t = useTranslations("common");
  return (
    <a
      href="/"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        color: "rgba(255,255,255,0.45)",
        fontSize: 13,
        textDecoration: "none",
        marginTop: 10,
      }}
    >
      <ArrowLeft size={13} />
      {t("back_to_home")}
    </a>
  );
}

export default function AuthSplitLayout({
  leftContent,
  rightContent,
  role,
}: AuthSplitLayoutProps) {
  return (
    <div
      className="auth-layout"
      style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
    >
      {/* ── LEFT PANEL (desktop only via CSS class) ── */}
      <div
        className="auth-left-panel"
        style={{
          width: "42%",
          height: "100vh",
          position: "sticky",
          top: 0,
          background: "#0B1E3D",
          padding: "40px 52px",
          flexDirection: "column",
          flexShrink: 0,
          overflowY: "hidden",
        }}
      >
        <Logo />
        <BackLink />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {leftContent}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="auth-right-panel">
        {/* Mobile-only top bar */}
        <div
          className="auth-mobile-bar"
          style={{
            background: "#0B1E3D",
            padding: "20px 24px",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <Logo />
          <BackLink />
        </div>

        <div className="auth-form-scroll">
          <div
            style={{
              width: "100%",
              maxWidth: role === "driver" ? 560 : 480,
              margin: "0 auto",
            }}
          >
            {rightContent}
          </div>
        </div>
      </div>
    </div>
  );
}
