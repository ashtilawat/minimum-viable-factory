"use client";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  colors?: string[];
}

const DEFAULT_COLORS = [
  "#0079BF", "#D29034", "#519839", "#B04632", "#89609E",
  "#CD5A91", "#4BBF6B", "#00AECC", "#838C91", "#5E4DB2",
  "#E6C60D", "#CF513D", "#43A047", "#7B68EE", "#F06292",
];

export function ColorPicker({ value, onChange, colors = DEFAULT_COLORS }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className="h-8 w-10 rounded transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{
            backgroundColor: color,
            outline: value === color ? "3px solid #000" : "2px solid transparent",
            outlineOffset: "1px",
          }}
          onClick={() => onChange(color)}
          aria-label={`Select color ${color}`}
        />
      ))}
    </div>
  );
}
