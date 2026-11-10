export interface DestinationItem {
  code: string;
  name: string;
  country: string;
  tag: string;
  image: string;
  imagePosition: string;
}

export const DESTINATIONS_STORAGE_KEY = 'aerora-destinations-v1';
export const DEFAULT_DESTINATIONS: DestinationItem[] = [
  { code: 'SIN', name: 'Singapore', tag: 'Island days, city nights', country: 'Singapore', image: '/destination-singapore.jpg', imagePosition: 'center' },
  { code: 'DXB', name: 'Dubai', tag: 'A different kind of horizon', country: 'United Arab Emirates', image: '/destination-dubai.jpg', imagePosition: '35% center' },
  { code: 'BKK', name: 'Bangkok', tag: 'A little more wonder', country: 'Thailand', image: '/destination-bangkok.jpg', imagePosition: '72% center' },
  { code: 'CMB', name: 'Colombo', tag: 'Close by, worlds away', country: 'Sri Lanka', image: '/destination-colombo.jpg', imagePosition: 'left center' },
  { code: 'LHR', name: 'London', tag: 'Make the long weekend count', country: 'United Kingdom', image: '/destination-london.jpg', imagePosition: 'right center' },
  { code: 'NRT', name: 'Tokyo', tag: 'Find your own rhythm', country: 'Japan', image: '/destination-tokyo.jpg', imagePosition: '52% 25%' },
];

export function webpForShippedDestination(image: string): string | null {
  if (!DEFAULT_DESTINATIONS.some(destination => destination.image === image)) return null;
  return image.replace(/\.(?:jpe?g|png)$/i, '.webp');
}

export function readDestinations(): DestinationItem[] {
  if (typeof window === 'undefined') return DEFAULT_DESTINATIONS;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DESTINATIONS_STORAGE_KEY) || 'null');
    if (Array.isArray(parsed) && parsed.every(isDestination)) return parsed;
  } catch {
    // Ignore invalid browser-local demo data and fall back to the shipped destinations.
  }
  return DEFAULT_DESTINATIONS;
}

export function saveDestinations(items: DestinationItem[]): void {
  window.localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(items));
}

function isDestination(value: unknown): value is DestinationItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DestinationItem>;
  return ['code', 'name', 'country', 'tag', 'image', 'imagePosition'].every(key => typeof item[key as keyof DestinationItem] === 'string');
}
