'use client';

import { useState } from 'react';

interface CodeConfirmInputProps {
  onConfirm: (code: string) => void;
  /** Pass true from parent when the last submitted code was wrong */
  hasError?: boolean;
}

export default function CodeConfirmInput({ onConfirm, hasError = false }: CodeConfirmInputProps) {
  const [code, setCode] = useState('');

  function handleSubmit() {
    if (code.length !== 4) return;
    onConfirm(code);
    setCode('');
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[#5A6A7A]">
        Ask the passenger for their 4-digit code
      </label>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          inputMode="numeric"
          maxLength={4}
          placeholder="_ _ _ _"
          className={`flex-1 h-11 text-center text-xl font-bold tracking-widest border-2 rounded-xl focus:outline-none transition-colors ${
            hasError
              ? 'border-[#E74C3C] bg-[#FDECEA]'
              : 'border-[#E2E8F0] focus:border-[#00C2A8] bg-white'
          }`}
        />
        <button
          onClick={handleSubmit}
          disabled={code.length !== 4}
          className="px-4 py-2 bg-[#00C2A8] text-[#0B1E3D] font-semibold rounded-xl disabled:opacity-40 transition-opacity"
        >
          Confirm
        </button>
      </div>
      {hasError && (
        <p className="text-xs text-[#E74C3C]">
          Wrong code. Ask the passenger to check their app.
        </p>
      )}
    </div>
  );
}
