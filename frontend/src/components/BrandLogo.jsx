import { Link } from 'react-router-dom';

const SIZE_CLASS = {
  sm: 'h-9 sm:h-10',
  md: 'h-12 sm:h-14',
  lg: 'h-16 sm:h-20',
  xl: 'h-24 sm:h-28',
};

/**
 * Logo officiel Kizumai (docs/Kizumai.png → /kizumai.png).
 * Contient déjà le wordmark + baseline — pas de texte additionnel.
 */
export default function BrandLogo({
  className = '',
  size = 'md',
  to = '/',
  asLink = true,
}) {
  const img = (
    <img
      src="/kizumai.png"
      alt="Kizumai — Accélérateur de Business"
      className={`w-auto object-contain ${SIZE_CLASS[size] || SIZE_CLASS.md} ${asLink ? '' : className}`}
      decoding="async"
    />
  );

  if (!asLink) {
    return img;
  }

  return (
    <Link
      to={to}
      className={`inline-flex items-center shrink-0 ${className}`}
      aria-label="Accueil Kizumai"
    >
      {img}
    </Link>
  );
}
