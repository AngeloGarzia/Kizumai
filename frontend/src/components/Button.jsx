export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  className = '',
  disabled = false,
  ...props
}) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={`${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
