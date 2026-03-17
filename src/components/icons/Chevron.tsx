interface ChevronProps {
  expanded: boolean;
  className?: string;
}

// Extracted Chevron component to a single file so it can be reused across the project.
export default function Chevron({ expanded, className = '' }: ChevronProps) {
  // Right arrow rotates to point down when expanded
  return (
    <svg
      className={`w-3 h-3 text-gray-500 dark:text-gray-400 transform transition-transform duration-150 ${
        expanded ? 'rotate-90' : 'rotate-0'
      } ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
