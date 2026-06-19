import { Link } from 'react-router-dom';
import { IconStar } from './icons.jsx';

export default function BrandLogo({ className = '', size = 'md' }) {
  const sizes = {
    sm: 'text-lg',
    md: 'text-xl sm:text-2xl',
    lg: 'text-2xl sm:text-3xl',
  };

  return (
    <Link to="/" className={`inline-flex items-center gap-1.5 font-bold tracking-tight ${sizes[size]} ${className}`}>
      <span className="text-prune-900">Myrokay</span>
      <IconStar className="w-4 h-4 sm:w-5 sm:h-5 text-wasabi-400" />
    </Link>
  );
}
