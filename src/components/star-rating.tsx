"use client";

import { useId, useState } from "react";

/** Read-only star display with fractional fill. */
export function StarRating({
  value,
  size = "sm",
  className = "",
}: {
  value: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span
      className={`relative inline-block leading-none ${size === "md" ? "text-lg" : "text-sm"} ${className}`}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      <span className="text-muted-foreground/30">★★★★★</span>
      <span
        className="absolute inset-0 overflow-hidden whitespace-nowrap text-amber-500"
        style={{ width: `${pct}%` }}
        aria-hidden
      >
        ★★★★★
      </span>
    </span>
  );
}

/** Interactive 1–5 rating input backed by a radio group (keyboard-accessible). */
export function StarRatingInput({ name = "rating" }: { name?: string }) {
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);
  const groupId = useId();
  const shown = hover || value;

  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <label
          key={n}
          className="cursor-pointer text-2xl leading-none"
          onMouseEnter={() => setHover(n)}
        >
          <input
            type="radio"
            name={name}
            value={n}
            checked={value === n}
            onChange={() => setValue(n)}
            className="sr-only"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            id={`${groupId}-${n}`}
          />
          <span className={n <= shown ? "text-amber-500" : "text-muted-foreground/30"}>★</span>
        </label>
      ))}
    </div>
  );
}
