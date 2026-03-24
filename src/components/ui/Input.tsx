import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={[
            "w-full rounded border px-3 py-2 text-sm",
            "border-gray-300 bg-white",
            "focus:border-trello-blue focus:outline-none focus:ring-2 focus:ring-trello-blue/30",
            "disabled:bg-gray-100 disabled:cursor-not-allowed",
            error ? "border-red-500" : "",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
