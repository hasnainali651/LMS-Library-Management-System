'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Bell,
  BookOpen,
  XCircle,
  Info,
  Lock,
  RefreshCw,
  Sparkles,
  LucideIcon,
} from 'lucide-react';

export type LordIconType =
  | 'check'
  | 'alert'
  | 'bell'
  | 'book'
  | 'cross'
  | 'info'
  | 'lock'
  | 'refresh'
  | 'sparkle';

export interface LordIconProps {
  icon: LordIconType;
  size?: number;
  trigger?: 'hover' | 'click' | 'loop' | 'morph' | 'in';
  className?: string;
  fallbackIcon?: LucideIcon;
  colors?: {
    primary?: string;
    secondary?: string;
  };
}

const fallbackIconMap: Record<LordIconType, LucideIcon> = {
  check: CheckCircle2,
  alert: AlertTriangle,
  bell: Bell,
  book: BookOpen,
  cross: XCircle,
  info: Info,
  lock: Lock,
  refresh: RefreshCw,
  sparkle: Sparkles,
};

// CDN hosted Lordicon JSON sources (optimized & official Lordicon free icons)
const iconSourceMap: Record<LordIconType, string> = {
  check: 'https://cdn.lordicon.com/oqdmuxru.json', // Animated checkmark
  alert: 'https://cdn.lordicon.com/inrunzby.json', // Animated warning
  bell: 'https://cdn.lordicon.com/msetysan.json', // Animated bell
  book: 'https://cdn.lordicon.com/wxnxiano.json', // Animated book
  cross: 'https://cdn.lordicon.com/nhfyvmlk.json', // Animated X / cross
  info: 'https://cdn.lordicon.com/kthelypq.json', // Animated info
  lock: 'https://cdn.lordicon.com/huwchgfz.json', // Animated lock
  refresh: 'https://cdn.lordicon.com/rsbokaso.json', // Animated refresh
  sparkle: 'https://cdn.lordicon.com/pithnlch.json', // Animated star / sparkle
};

let elementDefined = false;

export const LordIcon: React.FC<LordIconProps> = ({
  icon,
  size = 24,
  trigger = 'hover',
  className = '',
  fallbackIcon,
  colors = { primary: 'currentColor', secondary: 'currentColor' },
}) => {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;

    async function initLordIcon() {
      if (typeof window === 'undefined') return;
      try {
        if (!elementDefined) {
          const { defineElement } = await import('@lordicon/react');
          defineElement();
          elementDefined = true;
        }
        if (active) setReady(true);
      } catch (err) {
        if (active) setLoadError(true);
      }
    }

    initLordIcon();

    return () => {
      active = false;
    };
  }, []);

  const Fallback = fallbackIcon || fallbackIconMap[icon] || Sparkles;

  if (loadError || !ready) {
    return (
      <Fallback
        style={{ width: size, height: size }}
        className={`inline-block transition-transform duration-300 ease-out ${className}`}
        aria-hidden="true"
      />
    );
  }

  const primaryColor = colors.primary || 'currentColor';
  const secondaryColor = colors.secondary || primaryColor;
  const colorsAttr = `primary:${primaryColor},secondary:${secondaryColor}`;

  // lord-icon custom web component registered via @lordicon/react
  return React.createElement('lord-icon', {
    ref: elementRef,
    src: iconSourceMap[icon],
    trigger,
    colors: colorsAttr,
    style: { width: `${size}px`, height: `${size}px` },
    class: `inline-block align-middle ${className}`,
    'aria-hidden': 'true',
  });
};

export default LordIcon;
