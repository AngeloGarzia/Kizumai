export default function Input({ id, label, hint, className = '', ...props }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="label-field">
          {label}
        </label>
      )}
      <input id={id} className={`input-field ${className}`} {...props} />
      {hint && <p className="text-xs text-prune-500 mt-1.5">{hint}</p>}
    </div>
  );
}
