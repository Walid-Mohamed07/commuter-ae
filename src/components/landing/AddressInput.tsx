"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { searchAddress, getPlaceDetails, formatDisplayName } from "@/lib/nominatim";
import type { TripPoint } from "@/lib/store/useTripStore";

interface Props {
  placeholder: string;
  value: TripPoint | null;
  onChange: (p: TripPoint | null) => void;
  icon?: React.ReactNode;
  iconColor?: string;
  id?: string;
}

interface Suggestion {
  place_id: string;
  display_name: string;
}

export default function AddressInput({ placeholder, value, onChange, icon, iconColor = "#00C2A8", id }: Props) {
  const [query, setQuery] = useState(value ? formatDisplayName(value.address) : "");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `${id ?? "addr"}-list`;

  useEffect(() => {
    setQuery(value ? formatDisplayName(value.address) : "");
  }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.length < 3) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const r = await searchAddress(q);
      setResults(r);
      setOpen(r.length > 0);
      setLoading(false);
    }, 320);
  }, []);

  async function select(item: Suggestion) {
    setOpen(false);
    setResults([]);
    setQuery(formatDisplayName(item.display_name));
    setLoading(true);
    try {
      const { lat, lng } = await getPlaceDetails(item.place_id);
      onChange({ address: item.display_name, lat, lng });
    } catch {
      onChange(null);
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setQuery("");
    setResults([]);
    setOpen(false);
    onChange(null);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setOpen(false); }
  }

  const isFilled = !!(query || value);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <label htmlFor={id} style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
        {placeholder}
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 12px",
          height: 52,
          background: "#f8f9fa",
          borderRadius: 10,
          border: "1.5px solid #e8edf0",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
        onFocusCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#00C2A8";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(0,194,168,0.12)";
        }}
        onBlurCapture={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget as Node)) {
            (e.currentTarget as HTMLDivElement).style.borderColor = "#e8edf0";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          }
        }}
      >
        <span style={{ color: iconColor, flexShrink: 0, display: "flex", alignItems: "center" }} aria-hidden="true">
          {loading ? <Loader2 size={18} className="spin" /> : (icon ?? <MapPin size={18} />)}
        </span>
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); if (!e.target.value) onChange(null); }}
          onFocus={() => { if (results.length) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            fontSize: 15,
            fontFamily: "inherit",
            color: "#0B1E3D",
            minWidth: 0,
          }}
        />
        {isFilled && (
          <button
            type="button"
            onClick={clear}
            aria-label={`Clear ${placeholder}`}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#5A6A7A",
              padding: 4,
              flexShrink: 0,
              minWidth: 28,
              minHeight: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${placeholder} suggestions`}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#ffffff",
            border: "1.5px solid #e8edf0",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(11,30,61,0.13)",
            listStyle: "none",
            margin: 0,
            padding: "4px 0",
            maxHeight: 220,
            overflowY: "auto",
            zIndex: 300,
          }}
        >
          {results.map((r) => (
            <li
              key={r.place_id}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); select(r); }}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 14px",
                cursor: "pointer",
                fontSize: 14,
                color: "#0B1E3D",
                lineHeight: 1.4,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.background = "#eff7f6"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.background = "transparent"; }}
            >
              <MapPin size={14} style={{ color: "#00C2A8", marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
              <span>{formatDisplayName(r.display_name)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
