import { useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { webpForShippedDestination } from './destinations';
import type { DestinationItem } from './destinations';

type Props = {
  destinations: DestinationItem[];
  onExplore: (destination: DestinationItem) => void;
};

export function ExpandableDestinations({ destinations, onExplore }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  if (!destinations.length) return null;

  const active = Math.min(activeIndex, destinations.length - 1);
  const pinned = pinnedIndex !== null && pinnedIndex < destinations.length ? pinnedIndex : null;

  return <div
    className="destination-showcase"
    role="list"
    aria-label="Featured destinations"
    style={{ '--active-grow': Math.max(1, (destinations.length - 1) * .9) } as CSSProperties}
    onPointerLeave={event => { if (!event.currentTarget.contains(document.activeElement)) setActiveIndex(pinned ?? 0); }}
  >
    {destinations.map((destination, index) => {
      const isActive = index === active;
      const isPinned = index === pinned;
      const webp = webpForShippedDestination(destination.image);
      return <article
        className={`destination-showcase__card${isActive ? ' is-active' : ''}${isPinned ? ' is-pinned' : ''}`}
        role="listitem"
        key={destination.code}
        onPointerEnter={event => {
          if (event.pointerType !== 'touch') setActiveIndex(index);
        }}
      >
        <button
          className="destination-showcase__select"
          type="button"
          aria-label={`${isActive ? 'Selected' : 'Expand'} ${destination.name} destination`}
          aria-expanded={isActive}
          aria-pressed={isPinned}
          onFocus={() => setActiveIndex(index)}
          onClick={() => {
            setActiveIndex(index);
            setPinnedIndex(current => current === index ? null : index);
          }}
        >
          <picture className="destination-showcase__picture">
            {webp && <source type="image/webp" srcSet={webp} />}
            <img
              src={destination.image}
              alt={`${destination.name}, ${destination.country}`}
              loading="lazy"
              decoding="async"
              style={{ objectPosition: destination.imagePosition || 'center' }}
            />
          </picture>
          <span className="destination-showcase__shade" aria-hidden="true" />
          <span className="destination-showcase__eyebrow">{destination.code} <i>·</i> {destination.country}</span>
          <span className="destination-showcase__vertical-title" aria-hidden="true">{destination.name}</span>
          <span className="destination-showcase__copy">
            <strong>{destination.name}</strong>
            <span>{destination.tag}</span>
          </span>
        </button>
        <button
          className="destination-showcase__cta"
          type="button"
          tabIndex={isActive ? 0 : -1}
          aria-hidden={!isActive}
          onClick={() => onExplore(destination)}
        >
          Search flights to {destination.name} <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </article>;
    })}
  </div>;
}
