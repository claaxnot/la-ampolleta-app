import React from "react";
import { motion } from "framer-motion";

/**
 * Button – reusable component with primary and secondary variants.
 * Props:
 *   - onClick: handler
 *   - children: button label/content
 *   - variant: "primary" | "secondary"
 *   - className: additional Tailwind classes
 */
export default function Button({ onClick, children, variant = "primary", className = "" }) {
  const base = "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none";
  const primary = "bg-gradient-to-br from-primary to-red-600 hover:from-primary/80 hover:to-red-600/80 text-white px-5 py-2.5 shadow-lg hover:shadow-xl hover:scale-105";
  const secondary = "bg-transparent border border-white/20 text-white hover:bg-white/10 px-4 py-2";
  const variantClass = variant === "primary" ? primary : secondary;
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      className={`${base} ${variantClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
