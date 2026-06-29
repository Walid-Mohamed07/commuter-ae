"use client";

import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  const productLinks: [string, string][] = [
    ["How it works", "#how-it-works"],
    ["Pricing", "#vehicles"],
    ["Book a ride", "/create"],
  ];

  const accountLinks: [string, string][] = [
    ["Log in", "/login"],
    ["My trips", "/my-trips"],
    ["Profile", "/profile"],
  ];

  return (
    <footer
      style={{
        background: "#060f1e",
        color: "rgba(255,255,255,0.5)",
        padding: "56px 24px 32px",
      }}
      aria-label="Site footer"
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        {/* Top row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 32,
          }}
        >
          {/* Brand */}
          <div style={{ maxWidth: 280 }}>
            <Link
              href="/"
              aria-label="Commuter home"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: "#00C2A8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="4" fill="#0B1E3D" />
                  <path
                    d="M10 2v2M10 16v2M2 10h2M16 10h2"
                    stroke="#0B1E3D"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 17,
                  color: "#ffffff",
                  letterSpacing: "-0.025em",
                }}
              >
                Commuter
              </span>
            </Link>
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.65 }}>
              Affordable, reliable rides across Greater Cairo. Private and
              shared options — always on time.
            </p>
          </div>

          {/* Nav columns */}
          <nav
            aria-label="Footer navigation"
            style={{ display: "flex", gap: 48, flexWrap: "wrap" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p
                style={{
                  fontWeight: 700,
                  color: "#ffffff",
                  fontSize: 12,
                  margin: "0 0 4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Product
              </p>
              {productLinks.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.5)",
                    textDecoration: "none",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#00C2A8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p
                style={{
                  fontWeight: 700,
                  color: "#ffffff",
                  fontSize: 12,
                  margin: "0 0 4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Account
              </p>
              {accountLinks.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  style={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.5)",
                    textDecoration: "none",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#00C2A8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        {/* Bottom row */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingTop: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <p style={{ fontSize: 13, margin: 0 }}>
            © {year} Commuter. All rights reserved.
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>Built for Cairo 🇪🇬</p>
        </div>
      </div>
    </footer>
  );
}
