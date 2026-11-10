import { Cloud } from 'lucide-react';

type Props = { label?: string };

export function CloudFillLoader({ label = 'Loading' }: Props) {
  return <span className="cloud-fill-loader" role="status" aria-label={label} aria-live="polite">
    <Cloud className="cloud-fill-loader__outline" aria-hidden="true" />
    <span className="cloud-fill-loader__fill" aria-hidden="true"><Cloud /></span>
  </span>;
}
