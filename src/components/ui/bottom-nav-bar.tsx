"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Home, Search, MapPin, Ticket, Tag, Compass, MessageCircle, Mail } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type BottomNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type BottomNavBarProps = {
  className?: string;
  defaultIndex?: number;
  stickyBottom?: boolean;
  items?: BottomNavItem[];
  brand?: ReactNode;
  onNavigate?: (item: BottomNavItem, index: number) => void;
};

const defaultItems: BottomNavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'destinations', label: 'Places', icon: MapPin },
  { id: 'groups', label: 'Groups', icon: Ticket },
  { id: 'offers', label: 'Offers', icon: Tag },
  { id: 'how-it-works', label: 'How it works', icon: Compass },
  { id: 'stories', label: 'Stories', icon: MessageCircle },
  { id: 'contact', label: 'Contact', icon: Mail },
];

export function BottomNavBar({
  className = '',
  defaultIndex = 0,
  stickyBottom = false,
  items = defaultItems,
  brand,
  onNavigate,
}: BottomNavBarProps) {
  const [activeIndex, setActiveIndex] = useState(defaultIndex);

  return (
    <nav
      role="navigation"
      aria-label="Primary navigation"
      className={`bottom-nav-bar${stickyBottom ? ' is-sticky' : ''}${className ? ` ${className}` : ''}`}
    >
      {brand && <div className="bottom-nav-bar__brand">{brand}</div>}
      {items.map((item, index) => {
        const Icon = item.icon;
        const active = activeIndex === index;

        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={active}
            title={item.label}
            className={`bottom-nav-bar__item${active ? ' is-active' : ''}`}
            onClick={() => {
              setActiveIndex(index);
              onNavigate?.(item, index);
            }}
          >
            {active && (
              <motion.span
                layoutId="desktop-nav-glass-pill"
                initial={false}
                className="bottom-nav-bar__glass-pill"
                transition={{ type: 'spring', stiffness: 245, damping: 28, mass: 0.85 }}
                aria-hidden="true"
              />
            )}
            <Icon size={21} strokeWidth={1.9} aria-hidden="true" />
            <span
              className={`bottom-nav-bar__label-wrap${active ? ' is-visible' : ''}`}
              aria-hidden="true"
            >
              <span className="bottom-nav-bar__label">{item.label}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default BottomNavBar;
