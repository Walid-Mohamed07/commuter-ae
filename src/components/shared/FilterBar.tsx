"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface Props {
  filters: FilterDef[];
}

const selectStyle: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  background:
    "#fff url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235A6A7A' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\") no-repeat right 12px center",
  border: "1px solid #e2e8ec",
  borderRadius: 10,
  padding: "9px 34px 9px 14px",
  fontSize: 13,
  fontWeight: 600,
  color: "#0B1E3D",
  fontFamily: "inherit",
  cursor: "pointer",
  outline: "none",
  minHeight: 38,
};

export default function FilterBar({ filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page"); // reset to first page on any filter change
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll() {
    router.push(pathname);
  }

  const hasActive = filters.some((f) => sp.get(f.key));

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 10,
        marginBottom: 22,
      }}
    >
      {filters.map((f) => (
        <select
          key={f.key}
          aria-label={f.label}
          value={sp.get(f.key) ?? ""}
          onChange={(e) => update(f.key, e.target.value)}
          style={selectStyle}
        >
          <option value="">{f.label}: All</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {hasActive && (
        <button
          type="button"
          onClick={clearAll}
          style={{
            background: "none",
            border: "none",
            color: "#00C2A8",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
            padding: "9px 6px",
            minHeight: 38,
          }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
