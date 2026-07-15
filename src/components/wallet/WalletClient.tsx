"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wallet as WalletIcon,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Loader2,
} from "lucide-react";

interface Tx {
  id: string;
  type: "topup" | "payment" | "refund";
  amountEgp: number;
  status: "pending" | "completed" | "failed";
  description: string;
  balanceAfterEgp: number | null;
  createdAt: string;
}

interface WalletData {
  balanceEgp: number;
  status: string;
  transactions: Tx[];
}

const PRESETS = [50, 100, 200, 500];

export default function WalletClient() {
  const router = useRouter();
  const params = useSearchParams();
  const topupId = params.get("topupId");

  const [data, setData] = useState<WalletData | null>(null);
  const [amount, setAmount] = useState<number>(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/wallet", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  // On return from Kashier: verify the pending top-up, then refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (topupId) {
        setNotice("Confirming your top-up…");
        try {
          const res = await fetch("/api/wallet/topup/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topupId }),
          });
          const json = await res.json();
          if (!cancelled) {
            if (json.status === "paid")
              setNotice("Top-up added to your wallet.");
            else if (json.status === "failed")
              setNotice("Top-up failed. No charge was made.");
            else setNotice("Top-up is still processing. Refresh shortly.");
          }
        } catch {
          if (!cancelled)
            setNotice("Could not confirm top-up. Try refreshing.");
        }
        // Clean the URL so a refresh doesn't re-verify.
        router.replace("/wallet");
      }
      // Self-heal: settle any top-ups Kashier confirmed but we missed
      // (redirect + webhook both failed). Then load the fresh balance.
      try {
        await fetch("/api/wallet/reconcile", { method: "POST" });
      } catch {
        /* non-fatal */
      }
      await load();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topupId]);

  async function handleTopup() {
    setError("");
    const amt = Math.round(Number(amount));
    if (!isFinite(amt) || amt < 10 || amt > 5000) {
      setError("Enter an amount between 10 and 5000 EGP.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not start top-up.");
        setBusy(false);
        return;
      }
      window.location.href = json.sessionUrl;
    } catch {
      setError("Network error. Please retry.");
      setBusy(false);
    }
  }
// hi
  return (
    <main
      style={{ maxWidth: 640, margin: "0 auto", padding: "28px 20px 56px" }}
    >
      {/* Balance card */}
      <div
        style={{
          background: "linear-gradient(135deg, #0B1E3D 0%, #14315c 100%)",
          borderRadius: 18,
          padding: "24px 22px",
          color: "#fff",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: 0.8,
            marginBottom: 8,
          }}
        >
          <WalletIcon size={16} aria-hidden="true" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Wallet balance</span>
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {data ? `${data.balanceEgp} EGP` : "—"}
        </div>
      </div>

      {notice && (
        <p
          style={{
            fontSize: 13,
            color: "#0B1E3D",
            background: "#E8F5E9",
            border: "1px solid #c8e6c9",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 16,
          }}
        >
          {notice}
        </p>
      )}

      {/* Top-up */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #eef0f3",
          borderRadius: 14,
          padding: "18px",
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "#0B1E3D",
            margin: "0 0 14px",
          }}
        >
          Add funds
        </h2>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              style={{
                flex: "1 1 0",
                minWidth: 64,
                height: 42,
                borderRadius: 10,
                border:
                  amount === p ? "1.5px solid #00C2A8" : "1.5px solid #eef0f3",
                background: amount === p ? "rgba(0,194,168,0.08)" : "#fff",
                color: "#0B1E3D",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {p}
            </button>
          ))}
        </div>

        <input
          type="number"
          min={10}
          max={5000}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          aria-label="Top-up amount in EGP"
          style={{
            width: "100%",
            height: 48,
            borderRadius: 10,
            border: "1.5px solid #eef0f3",
            padding: "0 14px",
            fontSize: 15,
            fontFamily: "inherit",
            color: "#0B1E3D",
            marginBottom: 12,
            boxSizing: "border-box",
          }}
        />

        {error && (
          <p style={{ fontSize: 13, color: "#e74c3c", margin: "0 0 12px" }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleTopup}
          disabled={busy}
          style={{
            width: "100%",
            height: 50,
            borderRadius: 12,
            border: "none",
            background: busy ? "#5A6A7A" : "#0B1E3D",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {busy ? (
            <Loader2 size={18} className="spin" aria-hidden="true" />
          ) : (
            <Plus size={18} aria-hidden="true" />
          )}
          {busy ? "Redirecting…" : `Top up ${amount} EGP`}
        </button>
      </section>

      {/* Ledger */}
      <h2
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: "#0B1E3D",
          margin: "0 0 12px",
        }}
      >
        History
      </h2>

      {!data ? (
        <p style={{ fontSize: 14, color: "#5A6A7A" }}>Loading…</p>
      ) : data.transactions.length === 0 ? (
        <p style={{ fontSize: 14, color: "#5A6A7A" }}>No transactions yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.transactions.map((t) => {
            const isCredit = t.type === "topup" || t.type === "refund";
            const Icon =
              t.type === "topup"
                ? ArrowDownLeft
                : t.type === "refund"
                  ? RotateCcw
                  : ArrowUpRight;
            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "#fff",
                  border: "1px solid #eef0f3",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isCredit ? "#E8F5E9" : "#FFF3E0",
                    color: isCredit ? "#27AE60" : "#E65100",
                  }}
                >
                  <Icon size={16} aria-hidden="true" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: "#0B1E3D",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t.description}
                  </div>
                  <div style={{ fontSize: 12, color: "#5A6A7A" }}>
                    {new Date(t.createdAt).toLocaleString("en-EG", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {t.status !== "completed" ? ` · ${t.status}` : ""}
                  </div>
                </div>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 14,
                    fontVariantNumeric: "tabular-nums",
                    color: isCredit ? "#27AE60" : "#0B1E3D",
                  }}
                >
                  {isCredit ? "+" : "−"}
                  {t.amountEgp}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <style>{`.spin { animation: spin 0.7s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
