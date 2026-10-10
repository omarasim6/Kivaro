const P: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  passport: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4",
  plus: "M12 5v14M5 12h14",
  ledger: "M5 20c0-9 5-15 15-15 0 9-5 15-15 15zM5 20c3-5 6-8 10-10",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  gift: "M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7C9 7 8 4 10 3s3 2 2 4zm0 0c3 0 4-3 2-4s-3 2-2 4z",
  doc: "M7 3h8l4 4v14H7zM14 3v5h5M10 13h6M10 17h6",
  gear: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 1-2-1-1-2H9L8 7 6 8 4 7 2 11l2 1v2l-2 1 2 4 2-1 2 1 1 2h6l1-2 2-1 2 1 2-4-2-1z",
  battery: "M3 8h15v8H3zM21 11v2M6 11v2M9 11v2M12 11v2",
  alert: "M12 3l10 18H2L12 3zM12 10v5M12 18v.5",
  route: "M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM8 17h6a3 3 0 000-6h-4a3 3 0 010-6h6",
  check: "M5 13l4 4L19 7",
  back: "M15 5l-7 7 7 7",
};
export const Icon = ({ n, className = "h-5 w-5" }: { n: keyof typeof P | string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d={P[n] ?? P.bolt} />
  </svg>
);

export const CarArt = () => (
  <svg viewBox="0 0 400 130" className="mx-auto w-full max-w-sm" aria-hidden>
    <defs>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#3df07a" stopOpacity=".45" /><stop offset="1" stopColor="#3df07a" stopOpacity="0" /></radialGradient>
      <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d8dde0" /><stop offset="1" stopColor="#7d868c" /></linearGradient>
    </defs>
    <ellipse cx="200" cy="112" rx="170" ry="16" fill="url(#glow)" />
    <path d="M30 92c0-12 8-18 24-21l52-9c18-14 42-24 76-24h30c28 0 50 12 68 28l36 8c18 4 28 10 28 22v8c0 4-4 8-8 8H40c-6 0-10-4-10-8z" fill="url(#body)" />
    <path d="M128 64c14-10 32-18 58-18h24c22 0 40 9 54 22z" fill="#1b2023" opacity=".85" />
    <circle cx="105" cy="100" r="19" fill="#14181a" /><circle cx="105" cy="100" r="9" fill="#9aa4aa" />
    <circle cx="305" cy="100" r="19" fill="#14181a" /><circle cx="305" cy="100" r="9" fill="#9aa4aa" />
    <rect x="352" y="80" width="16" height="4" rx="2" fill="#3df07a" />
  </svg>
);
