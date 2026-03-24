import { cn } from "@/lib/utils";

interface LabelBadgeProps {
  colour: string;
  text?: string;
  onRemove?: () => void;
  className?: string;
}

/**
 * A small coloured badge used to display card labels.
 * When `onRemove` is provided a remove button is shown.
 */
export default function LabelBadge({
  colour,
  text,
  onRemove,
  className,
}: LabelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white",
        className
      )}
      style={{ backgroundColor: colour }}
    >
      {text && <span>{text}</span>}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full hover:bg-black/20 focus:outline-none focus:ring-1 focus:ring-white"
          aria-label={`Remove label${text ? ` "${text}"` : ""}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3 w-3"
            aria-hidden="true"
          >
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}
    </span>
  );
}
