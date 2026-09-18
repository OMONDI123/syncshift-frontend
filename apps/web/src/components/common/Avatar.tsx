interface AvatarProps {
  name: string;
  color: string;
  size?: "sm" | "md";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({ name, color, size = "md" }: AvatarProps) {
  const dimension = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  return (
    <span
      className={`inline-flex ${dimension} shrink-0 items-center justify-center rounded-full font-heading font-semibold text-white`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
