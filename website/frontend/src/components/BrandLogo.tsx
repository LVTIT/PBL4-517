export function KeviloSymbol({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#111827" />
      <rect x="7" y="6" width="4" height="20" rx="1.5" fill="#FFFFFF" />
      <path d="M12.5 15.5 L22.5 6 H26.5 L15.5 17 Z" fill="#FFFFFF" />
      <path d="M14 14.5 L25 26 H20.5 L11.5 17 Z" fill="#FFFFFF" />
      <circle cx="24" cy="8" r="1.5" fill="#1D4ED8" />
    </svg>
  );
}

export function KeviloWordmark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`brand-wordmark ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 105 28"
      width="105"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <text x="0" y="21" fill="currentColor">KEVILO</text>
    </svg>
  );
}

export function BrandLogo({ size = 32 }: { size?: number }) {
  return (
    <div className="brand-lockup">
      <KeviloSymbol size={size} />
      <KeviloWordmark />
    </div>
  );
}
