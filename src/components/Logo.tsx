import React from 'react';
import { motion } from 'motion/react';

export const Logo = ({ className = "w-6 h-6", glow = true, animate = false }: { className?: string, glow?: boolean, animate?: boolean }) => {
  const bars = [
    "M 14 85 L 14 78 L 22 72 L 22 85 Z",
    "M 26 85 L 26 69 L 34 63 L 34 85 Z",
    "M 38 85 L 38 60 L 46 54 L 46 85 Z",
    "M 50 85 L 50 51 L 58 45 L 58 85 Z",
    "M 62 85 L 62 42 L 70 36 L 70 85 Z",
    "M 74 85 L 74 33 L 82 27 L 82 85 Z"
  ];

  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#A67B00" />
          <stop offset="40%" stopColor="#DFAD00" />
          <stop offset="70%" stopColor="#FFF280" />
          <stop offset="100%" stopColor="#FFDE00" />
        </linearGradient>

        {/* Glow Filter */}
        <filter id="starGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="starGlowIntense" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background */}
      <rect width="100" height="100" fill="#000000" />

      {/* Bars */}
      {bars.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="url(#goldGrad)"
          initial={animate ? { opacity: 0, y: 15 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={animate ? { duration: 0.5, delay: i * 0.25, ease: "easeOut" } : { duration: 0 }}
        />
      ))}

      {/* Star */}
      <motion.path 
        d="M 78 5 Q 78 15 88 15 Q 78 15 78 25 Q 78 15 68 15 Q 78 15 78 5 Z" 
        fill="url(#goldGrad)" 
        filter={glow ? (animate ? "url(#starGlowIntense)" : "url(#starGlow)") : ""}
        initial={animate ? { opacity: 0, scale: 0 } : { opacity: 1, scale: 1 }}
        animate={animate ? { 
          opacity: 1, 
          scale: [0, 1.4, 1],
          filter: glow ? ["url(#starGlow)", "url(#starGlowIntense)", "url(#starGlow)"] : ""
        } : { opacity: 1, scale: 1 }}
        transition={animate ? { 
          duration: 1.25, 
          delay: 1.75,
          times: [0, 0.5, 1],
          ease: "easeInOut"
        } : { duration: 0 }}
        style={{ transformOrigin: "78px 15px" }}
      />
    </svg>
  );
};

