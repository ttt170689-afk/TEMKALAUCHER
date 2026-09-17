/* Процедурные аватары: 8 вариантов × 6 цветов */
export const AVATAR_VARIANTS = ["cube", "knight", "mage", "demon", "bot", "ghost", "cat", "crown"] as const;

export function AvatarSvg({
  variant,
  color,
  size = 40,
}: {
  variant: string;
  color: string;
  size?: number;
}) {
  const dark = "rgba(6,8,12,0.9)";
  const body = (
    <>
      {variant === "cube" && (
        <>
          <rect x="7" y="7" width="18" height="18" rx="4" fill={color} />
          <rect x="7" y="7" width="18" height="8" rx="4" fill="#ffffff" opacity="0.25" />
          <circle cx="13" cy="16" r="1.8" fill={dark} />
          <circle cx="19" cy="16" r="1.8" fill={dark} />
          <path d="M13 21q3 2.4 6 0" stroke={dark} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </>
      )}
      {variant === "knight" && (
        <>
          <path d="M8 10a8 8 0 0 1 16 0v12H8Z" fill={color} />
          <rect x="8" y="14" width="16" height="4.5" fill={dark} />
          <rect x="10" y="15.2" width="4" height="2" rx="1" fill={color} opacity="0.9" />
          <rect x="18" y="15.2" width="4" height="2" rx="1" fill={color} opacity="0.9" />
          <rect x="14.8" y="22" width="2.4" height="6" rx="1" fill={dark} />
        </>
      )}
      {variant === "mage" && (
        <>
          <path d="M16 3 23 14H9Z" fill={color} />
          <circle cx="16" cy="19" r="7" fill={color} opacity="0.85" />
          <circle cx="13.5" cy="18.5" r="1.6" fill={dark} />
          <circle cx="18.5" cy="18.5" r="1.6" fill={dark} />
          <circle cx="16" cy="8" r="1.4" fill="#ffffff" opacity="0.8" />
        </>
      )}
      {variant === "demon" && (
        <>
          <path d="M9 11 6 3l6 5Z" fill={color} />
          <path d="M23 11l3-8-6 5Z" fill={color} />
          <circle cx="16" cy="18" r="8" fill={color} />
          <circle cx="12.8" cy="17" r="1.9" fill={dark} />
          <circle cx="19.2" cy="17" r="1.9" fill={dark} />
          <path d="M12 23l1.6-1.8 1.6 1.8 1.6-1.8L18.4 23" stroke={dark} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {variant === "bot" && (
        <>
          <rect x="8" y="10" width="16" height="13" rx="3.5" fill={color} />
          <rect x="10.5" y="14" width="11" height="4" rx="2" fill={dark} />
          <circle cx="13" cy="16" r="1.2" fill={color} />
          <circle cx="19" cy="16" r="1.2" fill={color} />
          <line x1="16" y1="10" x2="16" y2="5.5" stroke={color} strokeWidth="1.8" />
          <circle cx="16" cy="4.5" r="1.8" fill={color} />
        </>
      )}
      {variant === "ghost" && (
        <>
          <path d="M8 15a8 8 0 0 1 16 0v10l-2.6-2.2L18.8 25l-2.8-2.2L13.2 25l-2.6-2.2L8 25Z" fill={color} />
          <circle cx="13" cy="15" r="1.8" fill={dark} />
          <circle cx="19" cy="15" r="1.8" fill={dark} />
          <ellipse cx="16" cy="19.5" rx="2" ry="1.4" fill={dark} opacity="0.7" />
        </>
      )}
      {variant === "cat" && (
        <>
          <path d="M8 11 7 4l5 3.4Z" fill={color} />
          <path d="M24 11l1-7-5 3.4Z" fill={color} />
          <circle cx="16" cy="17" r="8.4" fill={color} />
          <circle cx="12.8" cy="16" r="1.7" fill={dark} />
          <circle cx="19.2" cy="16" r="1.7" fill={dark} />
          <path d="M14.6 20.5h2.8L16 22Z" fill={dark} />
          <path d="M9 18.5h4M9.5 21h3.5M23 18.5h-4M22.5 21h-3.5" stroke={dark} strokeWidth="1" strokeLinecap="round" />
        </>
      )}
      {variant === "crown" && (
        <>
          <path d="M7 13l3.4 3L16 8l5.6 8 3.4-3v9H7Z" fill={color} />
          <rect x="7" y="22" width="18" height="3.4" rx="1.4" fill={color} opacity="0.8" />
          <circle cx="16" cy="8" r="1.6" fill="#ffffff" opacity="0.85" />
          <circle cx="12.8" cy="17" r="1.4" fill={dark} />
          <circle cx="19.2" cy="17" r="1.4" fill={dark} />
        </>
      )}
    </>
  );

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="flex-none">
      <circle cx="16" cy="16" r="15.2" fill={`color-mix(in srgb, ${color} 16%, rgba(6,8,12,0.85))`} />
      <circle cx="16" cy="16" r="15.2" fill="none" stroke={`color-mix(in srgb, ${color} 55%, transparent)`} strokeWidth="1.4" />
      {body}
    </svg>
  );
}
