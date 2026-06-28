'use client';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface LanguageToggleProps {
  inverted?: boolean; // true = white text/border (for dark backgrounds)
}

export default function LanguageToggle({ inverted = false }: LanguageToggleProps) {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = locale === 'en' ? 'ar' : 'en';
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
    startTransition(() => router.refresh());
  }

  const baseColor = inverted ? 'rgba(255,255,255,0.8)' : '#0B1E3D';
  const baseBorder = inverted ? 'rgba(255,255,255,0.3)' : '#E2E8F0';

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      style={{
        padding: '6px 12px',
        borderRadius: 8,
        border: `1px solid ${baseBorder}`,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        background: 'transparent',
        color: baseColor,
        transition: 'border-color 0.15s, color 0.15s',
        opacity: isPending ? 0.5 : 1,
        fontFamily: 'inherit',
        letterSpacing: '0.03em',
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLButtonElement).style.borderColor = '#00C2A8';
        (e.target as HTMLButtonElement).style.color = '#00C2A8';
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLButtonElement).style.borderColor = baseBorder;
        (e.target as HTMLButtonElement).style.color = baseColor;
      }}
      aria-label={locale === 'en' ? 'Switch to Arabic' : 'Switch to English'}
    >
      {locale === 'en' ? 'AR' : 'EN'}
    </button>
  );
}
