import React from "react";
import { motion } from "framer-motion";

/**
 * GlassCard – reusable container with glassmorphism style and subtle entrance animation.
 * Props:
 *   children – React nodes to render inside the card
 *   className – additional Tailwind classes
 */
export default function GlassCard({ children, className = "", ...props }) {
  const hasCustomBorder = className.includes("border-") || className.includes("border ");
  const baseBorder = hasCustomBorder ? "" : "border border-white/10";

  const hasCustomPadding = /\bp-\d/.test(className) || className.includes("px-") || className.includes("py-");
  const basePadding = hasCustomPadding ? "" : "p-6";

  return (
    <motion.div
      className={`bg-white/5 backdrop-blur-md rounded-xl shadow-lg ${basePadding} ${baseBorder} ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
