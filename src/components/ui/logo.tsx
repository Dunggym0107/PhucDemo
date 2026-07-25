import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "primary" | "white";
}

export function Logo({ className, variant = "primary" }: LogoProps) {
  const bg = variant === "white" ? "white" : "#1e40af";
  const stroke = variant === "white" ? "#1e40af" : "white";
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="WorkFlow logo"
    >
      <rect width="40" height="40" rx="10" fill={bg} />
      <path
        d="M9 12 L14 28 L20 18 L26 28 L31 12"
        stroke={stroke}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
