import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Base styles for toolbar buttons — sized for e-ink touch targets. */
export const BTN =
  "rounded-md px-3 py-2 text-sm font-medium border border-transparent";
export const BTN_ACTIVE = "bg-black text-white border-black";
export const BTN_INACTIVE = "text-gray-800 border-gray-300 bg-white";
export const BTN_DISABLED = "opacity-25";

export function Divider() {
  return <div className="h-6 w-px bg-gray-400" />;
}

export function ToolbarRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 shrink-0 text-xs font-medium text-gray-500">{label}</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function ToolbarButton({
  active = false,
  disabled,
  className = "",
  ...rest
}: ToolbarButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`${BTN} ${active ? BTN_ACTIVE : BTN_INACTIVE} ${disabled ? BTN_DISABLED : ""} ${className}`}
      {...rest}
    />
  );
}
