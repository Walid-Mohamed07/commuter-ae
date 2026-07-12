"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import PasswordInput from "@/components/shared/PasswordInput";
import PasswordStrengthMeter from "@/components/shared/PasswordStrengthMeter";

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#0B1E3D",
  display: "block",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  padding: "0 14px",
  background: "#f8f9fa",
  border: "1.5px solid #e8edf0",
  borderRadius: 12,
  fontSize: 15,
  fontFamily: "inherit",
  color: "#0B1E3D",
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer" };

interface Props {
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  gender: "male" | "female" | "";
  setGender: (v: "male" | "female" | "") => void;
  onSuccess: () => void;
}

// Driver register = Personal Info only. Vehicle details + documents are
// completed later in /profile once the account exists.
export default function DriverRegisterForm({
  name,
  setName,
  phone,
  setPhone,
  password,
  setPassword,
  email,
  setEmail,
  gender,
  setGender,
  onSuccess,
}: Props) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate(): string {
    if (!name.trim() || !phone.trim() || !password)
      return "Name, phone and password are required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "Invalid email address.";
    if (!gender) return "Please select your gender.";
    return "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signUpDriver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, password, email, gender }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        setLoading(false);
        return;
      }
      onSuccess();
    } catch {
      setError("Network error. Please check your connection.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label htmlFor="d-name" style={labelStyle}>
            Full name{" "}
            <span aria-hidden="true" style={{ color: "#e74c3c" }}>
              *
            </span>
          </label>
          <input
            id="d-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor="d-phone" style={labelStyle}>
            Phone{" "}
            <span aria-hidden="true" style={{ color: "#e74c3c" }}>
              *
            </span>
          </label>
          <div
            style={{
              display: "flex",
              alignItems: "stretch",
              height: 52,
              background: "#f8f9fa",
              border: "1.5px solid #e8edf0",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                fontWeight: 600,
                color: "#0B1E3D",
                background: "#eef1f3",
                borderRight: "1.5px solid #e8edf0",
              }}
            >
              +20
            </span>
            <input
              id="d-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="1XXXXXXXXX"
              required
              maxLength={10}
              value={phone.replace(/^\+?20/, "")}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                setPhone(digits ? `+20${digits}` : "");
              }}
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                padding: "0 14px",
                border: "none",
                outline: "none",
                background: "transparent",
                fontSize: 15,
                fontFamily: "inherit",
                color: "#0B1E3D",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
        <PasswordInput
          label="Password *"
          id="d-password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrengthMeter password={password} />
        <div>
          <label htmlFor="d-gender" style={labelStyle}>
            Gender{" "}
            <span aria-hidden="true" style={{ color: "#e74c3c" }}>
              *
            </span>
          </label>
          <select
            id="d-gender"
            required
            value={gender}
            onChange={(e) => setGender(e.target.value as "male" | "female")}
            style={selectStyle}
          >
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label htmlFor="d-email" style={labelStyle}>
            Email address{" "}
            <span style={{ fontWeight: 400, color: "#5A6A7A" }}>
              (optional)
            </span>
          </label>
          <input
            id="d-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
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
            marginTop: 16,
            marginBottom: 0,
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: 20,
          width: "100%",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: loading ? "#5A6A7A" : "#0B1E3D",
          color: "#ffffff",
          fontWeight: 700,
          fontSize: 15,
          border: "none",
          borderRadius: 12,
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {loading && <Loader2 size={18} className="spin" aria-hidden="true" />}
        {loading ? "Please wait…" : "Create driver account"}
      </button>
    </form>
  );
}
