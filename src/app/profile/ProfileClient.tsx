"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Phone,
  Mail,
  Check,
  Loader2,
  Bookmark,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import AppHeader from "@/components/layout/AppHeader";
import AddressInput from "@/components/landing/AddressInput";
import type { SavedAddress } from "@/types/shared";
import type { TripPoint } from "@/lib/store/useTripStore";

interface Props {
  initialName: string;
  email: string;
  initialPhone: string;
  initialSavedAddresses: SavedAddress[];
}

export default function ProfileClient({
  initialName,
  email,
  initialPhone,
  initialSavedAddresses,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // ── Saved addresses state ────────────────────────────────────────────────
  const [addresses, setAddresses] = useState<SavedAddress[]>(
    initialSavedAddresses,
  );
  const [addrForm, setAddrForm] = useState<{
    open: boolean;
    editId: string | null;
    label: string;
    point: TripPoint | null;
    saving: boolean;
    error: string;
  }>({
    open: false,
    editId: null,
    label: "",
    point: null,
    saving: false,
    error: "",
  });

  function openAddForm() {
    setAddrForm({
      open: true,
      editId: null,
      label: "",
      point: null,
      saving: false,
      error: "",
    });
  }

  function openEditForm(a: SavedAddress) {
    setAddrForm({
      open: true,
      editId: a._id,
      label: a.label,
      point: { address: a.address, lat: a.lat, lng: a.lng },
      saving: false,
      error: "",
    });
  }

  function closeAddrForm() {
    setAddrForm((prev) => ({ ...prev, open: false, error: "" }));
  }

  async function saveAddress() {
    if (!addrForm.label.trim()) {
      setAddrForm((prev) => ({ ...prev, error: "Label required." }));
      return;
    }
    if (!addrForm.point) {
      setAddrForm((prev) => ({ ...prev, error: "Select an address." }));
      return;
    }
    setAddrForm((prev) => ({ ...prev, saving: true, error: "" }));
    try {
      const body = {
        label: addrForm.label.trim(),
        address: addrForm.point.address,
        lat: addrForm.point.lat,
        lng: addrForm.point.lng,
      };
      let res: Response;
      if (addrForm.editId) {
        res = await fetch(`/api/auth/addresses/${addrForm.editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/auth/addresses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        setAddrForm((prev) => ({
          ...prev,
          saving: false,
          error: data.error ?? "Failed.",
        }));
        return;
      }
      if (addrForm.editId) {
        setAddresses((prev) =>
          prev.map((a) => (a._id === addrForm.editId ? data.savedAddress : a)),
        );
      } else {
        setAddresses((prev) => [...prev, data.savedAddress]);
      }
      setAddrForm({
        open: false,
        editId: null,
        label: "",
        point: null,
        saving: false,
        error: "",
      });
    } catch {
      setAddrForm((prev) => ({
        ...prev,
        saving: false,
        error: "Network error.",
      }));
    }
  }

  async function deleteAddress(id: string) {
    setAddresses((prev) => prev.filter((a) => a._id !== id));
    try {
      await fetch(`/api/auth/addresses/${id}`, { method: "DELETE" });
    } catch {
      /* non-fatal — optimistic delete */
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save.");
        return;
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa" }}>
      <AppHeader authed email={email} variant="app" backHref="/" />

      <main
        style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px 48px" }}
      >
        {/* Avatar + name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#00C2A8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <User size={26} color="#fff" aria-hidden="true" />
          </div>
          <div>
            <p
              style={{
                margin: "0 0 2px",
                fontSize: 20,
                fontWeight: 800,
                color: "#0B1E3D",
                letterSpacing: "-0.02em",
              }}
            >
              {initialName}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "#5A6A7A" }}>{email}</p>
          </div>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSave}
          noValidate
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #eef0f3",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <h1
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#0B1E3D",
              margin: 0,
            }}
          >
            Edit profile
          </h1>

          {/* Name */}
          <div>
            <label
              htmlFor="p-name"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0B1E3D",
                display: "block",
                marginBottom: 6,
              }}
            >
              Full name{" "}
              <span aria-hidden="true" style={{ color: "#e74c3c" }}>
                *
              </span>
            </label>
            <div style={{ position: "relative" }}>
              <User
                size={15}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9aa8b5",
                  pointerEvents: "none",
                }}
              />
              <input
                id="p-name"
                type="text"
                value={name}
                required
                autoComplete="name"
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  height: 48,
                  paddingLeft: 38,
                  paddingRight: 14,
                  border: "1.5px solid #d0d8e0",
                  borderRadius: 10,
                  fontSize: 15,
                  color: "#0B1E3D",
                  fontFamily: "inherit",
                  background: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#00C2A8")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#d0d8e0")}
              />
            </div>
          </div>

          {/* Email — read only */}
          <div>
            <label
              htmlFor="p-email"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0B1E3D",
                display: "block",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <div style={{ position: "relative" }}>
              <Mail
                size={15}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9aa8b5",
                  pointerEvents: "none",
                }}
              />
              <input
                id="p-email"
                type="email"
                value={email}
                readOnly
                aria-readonly="true"
                style={{
                  width: "100%",
                  height: 48,
                  paddingLeft: 38,
                  paddingRight: 14,
                  border: "1.5px solid #eef0f3",
                  borderRadius: 10,
                  fontSize: 15,
                  color: "#9aa8b5",
                  fontFamily: "inherit",
                  background: "#f8f9fa",
                  outline: "none",
                  boxSizing: "border-box",
                  cursor: "not-allowed",
                }}
              />
            </div>
            <p
              style={{ fontSize: 12, color: "#9aa8b5", margin: "5px 0 0 2px" }}
            >
              Email cannot be changed.
            </p>
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="p-phone"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0B1E3D",
                display: "block",
                marginBottom: 6,
              }}
            >
              Phone number
            </label>
            <div style={{ position: "relative" }}>
              <Phone
                size={15}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9aa8b5",
                  pointerEvents: "none",
                }}
              />
              <input
                id="p-phone"
                type="tel"
                value={phone}
                autoComplete="tel"
                placeholder="+20 10X XXX XXXX"
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: "100%",
                  height: 48,
                  paddingLeft: 38,
                  paddingRight: 14,
                  border: "1.5px solid #d0d8e0",
                  borderRadius: 10,
                  fontSize: 15,
                  color: "#0B1E3D",
                  fontFamily: "inherit",
                  background: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#00C2A8")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#d0d8e0")}
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              aria-live="assertive"
              style={{
                fontSize: 13,
                color: "#e74c3c",
                background: "rgba(231,76,60,0.07)",
                border: "1px solid rgba(231,76,60,0.2)",
                borderRadius: 8,
                padding: "10px 14px",
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          {success && (
            <p
              role="status"
              aria-live="polite"
              style={{
                fontSize: 13,
                color: "#27AE60",
                background: "rgba(39,174,96,0.07)",
                border: "1px solid rgba(39,174,96,0.25)",
                borderRadius: 8,
                padding: "10px 14px",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Check size={14} aria-hidden="true" />
              Profile updated.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              height: 52,
              background: saving ? "#9aa8b5" : "#0B1E3D",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              borderRadius: 12,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.background = "#00C2A8";
            }}
            onMouseLeave={(e) => {
              if (!saving) e.currentTarget.style.background = "#0B1E3D";
            }}
          >
            {saving ? (
              <>
                <Loader2
                  size={16}
                  aria-hidden="true"
                  style={{ animation: "spin 0.7s linear infinite" }}
                />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </form>

        {/* Nav links */}
        <div
          style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}
        >
          <Link
            href="/my-requests"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#0B1E3D",
              textDecoration: "none",
              padding: "10px 18px",
              background: "#fff",
              border: "1.5px solid #eef0f3",
              borderRadius: 10,
            }}
          >
            My requests →
          </Link>
          <Link
            href="/create"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#00C2A8",
              textDecoration: "none",
              padding: "10px 18px",
              background: "#eff7f6",
              border: "1.5px solid #c8e8e4",
              borderRadius: 10,
            }}
          >
            Book a ride →
          </Link>
        </div>

        {/* ── Saved addresses ── */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #eef0f3",
            padding: "24px",
            marginTop: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#0B1E3D",
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Bookmark
                size={16}
                style={{ color: "#00C2A8" }}
                aria-hidden="true"
              />
              Saved places
            </h2>
            <button
              type="button"
              onClick={openAddForm}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                background: "#0B1E3D",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#00C2A8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#0B1E3D";
              }}
            >
              <Plus size={14} aria-hidden="true" />
              Add place
            </button>
          </div>

          {/* Add / Edit form */}
          {addrForm.open && (
            <div
              style={{
                background: "#f8f9fa",
                borderRadius: 12,
                border: "1.5px solid #e8edf0",
                padding: "16px",
                marginBottom: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{ fontSize: 14, fontWeight: 700, color: "#0B1E3D" }}
                >
                  {addrForm.editId ? "Edit place" : "Add new place"}
                </span>
                <button
                  type="button"
                  onClick={closeAddrForm}
                  aria-label="Close"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#5A6A7A",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Label input */}
              <div>
                <label
                  htmlFor="addr-label"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0B1E3D",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Label (e.g. Home, Work, Gym)
                </label>
                <input
                  id="addr-label"
                  type="text"
                  value={addrForm.label}
                  onChange={(e) =>
                    setAddrForm((prev) => ({ ...prev, label: e.target.value }))
                  }
                  placeholder="Home"
                  style={{
                    width: "100%",
                    height: 44,
                    padding: "0 14px",
                    borderRadius: 10,
                    border: "1.5px solid #d0d8e0",
                    fontSize: 15,
                    fontFamily: "inherit",
                    color: "#0B1E3D",
                    background: "#fff",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "#00C2A8")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "#d0d8e0")
                  }
                />
              </div>

              {/* Address search */}
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0B1E3D",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Address
                </label>
                <AddressInput
                  id={`addr-point-${addrForm.editId ?? "new"}`}
                  placeholder="Search for address"
                  value={addrForm.point}
                  onChange={(p) =>
                    setAddrForm((prev) => ({ ...prev, point: p }))
                  }
                />
              </div>

              {addrForm.error && (
                <p
                  role="alert"
                  style={{
                    fontSize: 13,
                    color: "#e74c3c",
                    margin: 0,
                    padding: "8px 12px",
                    background: "rgba(231,76,60,0.07)",
                    borderRadius: 8,
                  }}
                >
                  {addrForm.error}
                </p>
              )}

              <button
                type="button"
                onClick={saveAddress}
                disabled={addrForm.saving}
                style={{
                  height: 44,
                  background: addrForm.saving ? "#9aa8b5" : "#0B1E3D",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  border: "none",
                  borderRadius: 10,
                  cursor: addrForm.saving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!addrForm.saving)
                    e.currentTarget.style.background = "#00C2A8";
                }}
                onMouseLeave={(e) => {
                  if (!addrForm.saving)
                    e.currentTarget.style.background = "#0B1E3D";
                }}
              >
                {addrForm.saving ? (
                  <>
                    <Loader2
                      size={14}
                      style={{ animation: "spin 0.7s linear infinite" }}
                    />
                    Saving…
                  </>
                ) : addrForm.editId ? (
                  "Update place"
                ) : (
                  "Save place"
                )}
              </button>
            </div>
          )}

          {/* Address list */}
          {addresses.length === 0 && !addrForm.open && (
            <p style={{ fontSize: 14, color: "#9aa5b4", margin: 0 }}>
              No saved places yet. Add one to reuse it when booking.
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {addresses.map((a) => (
              <div
                key={a._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  background: "#f8f9fa",
                  borderRadius: 10,
                  border: "1.5px solid #eef0f3",
                }}
              >
                <Bookmark
                  size={16}
                  style={{ color: "#00C2A8", flexShrink: 0 }}
                  aria-hidden="true"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#0B1E3D",
                    }}
                  >
                    {a.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "#5A6A7A",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.address}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openEditForm(a)}
                  aria-label={`Edit ${a.label}`}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#5A6A7A",
                    padding: 6,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#0B1E3D";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#5A6A7A";
                  }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteAddress(a._id)}
                  aria-label={`Delete ${a.label}`}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#e74c3c",
                    padding: 6,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(231,76,60,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
