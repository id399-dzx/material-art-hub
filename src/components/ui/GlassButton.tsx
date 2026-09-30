"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import "./GlassButton.css";

export type GlassButtonVariant = "primary" | "secondary" | "danger";
export type GlassButtonSize = "sm" | "md" | "lg";

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      data-variant={variant}
      data-size={size}
      className={["glass-button", className].filter(Boolean).join(" ")}
      {...props}
    >
      <span className="glass-button__content">{children}</span>
    </button>
  ),
);

GlassButton.displayName = "GlassButton";
