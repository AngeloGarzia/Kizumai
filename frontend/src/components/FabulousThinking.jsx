import { assistantPhrases } from '../constants/assistant.js';
import { publicAssetUrl } from '../config/appBase.js';

const SIZE_CLASS = {
  sm: 'h-9 w-9',
  md: 'h-16 w-16',
  lg: 'h-24 w-24',
};

/**
 * Indicateur d’attente Fabulous : avatar qui tourne comme un sablier.
 */
export default function FabulousThinking({
  message = assistantPhrases.thinking,
  size = 'md',
  className = '',
  compact = false,
}) {
  return (
    <div
      className={
        compact
          ? `inline-flex items-center gap-2 ${className}`
          : `flex flex-col items-center justify-center gap-3 py-12 ${className}`
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <img
        src={publicAssetUrl('fabulous.svg')}
        alt=""
        width={size === 'lg' ? 96 : size === 'sm' ? 36 : 64}
        height={size === 'lg' ? 96 : size === 'sm' ? 36 : 64}
        className={`${SIZE_CLASS[size] || SIZE_CLASS.md} animate-fabulous-spin select-none`}
        decoding="async"
      />
      {message ? (
        <p className={`text-sm text-prune-500 ${compact ? 'm-0' : 'text-center'}`}>{message}</p>
      ) : null}
    </div>
  );
}
