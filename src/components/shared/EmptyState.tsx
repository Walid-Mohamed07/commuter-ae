interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 8 }}>{icon}</div>
      <h3
        style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: '#0B1E3D',
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: '#5A6A7A',
            maxWidth: 320,
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
