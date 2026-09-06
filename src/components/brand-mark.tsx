import { cn } from "@/lib/utils";

/** Crisp 24px mark: shield + ring nodes + annotation brackets. Matches the generated icon. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-primary", className)}
      aria-hidden
    >
      <path
        d="M16 3.4 27 8.2v8.4c0 6.1-4.6 10.9-11 12.6C9.6 27.5 5 22.7 5 16.6V8.2L16 3.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="11.2" r="1.35" fill="currentColor" />
      <circle cx="11.2" cy="19.6" r="1.35" fill="currentColor" />
      <circle cx="20.8" cy="19.6" r="1.35" fill="currentColor" />
      <path
        d="M16 11.2 11.2 19.6M16 11.2 20.8 19.6M11.2 19.6h9.6"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <path
        d="M13.1 13.6h1.15M13.1 13.6v1.15M17.75 13.6H18.9M18.9 13.6v1.15M13.1 18.4v-1.15M13.1 18.4h1.15M18.9 18.4v-1.15M17.75 18.4H18.9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M14.05 16.15 15.35 17.4 18 14.7"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
