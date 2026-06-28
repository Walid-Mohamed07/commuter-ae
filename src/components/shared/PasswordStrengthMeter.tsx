'use client';

interface Props {
  password: string;
}

function getStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['', 'Weak', 'Fair', 'Strong', 'Very strong'];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}

const SEGMENT_COLORS: Record<number, string> = {
  1: '#E74C3C',
  2: '#F39C12',
  3: '#00C2A8',
  4: '#27AE60',
};

export default function PasswordStrengthMeter({ password }: Props) {
  const { score, label } = getStrength(password);
  if (!password) return null;

  const color = SEGMENT_COLORS[score] ?? '#D1D5DB';

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4 }} role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={4} aria-label="Password strength">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 4, flex: 1, borderRadius: 99,
              background: i <= score ? color : '#E5E7EB',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>
      {label && (
        <p style={{ marginTop: 6, fontSize: 12, color }}>
          {label}
          {score < 4 && score > 0 && (
            <span style={{ color: '#9CA3AF', marginLeft: 4 }}>
              {score === 1 && '— Add uppercase, numbers & symbols'}
              {score === 2 && '— Add numbers & special characters'}
              {score === 3 && '— Add a special character'}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
