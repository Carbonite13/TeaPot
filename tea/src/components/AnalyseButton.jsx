import { HugeiconsIcon } from '@hugeicons/react';
import { AiBrain01Icon } from '@hugeicons/core-free-icons';

export default function AnalyseButton({
  onCommit,
  onClick,
  disabled = false,
  className = '',
  label = 'Analyse',
}) {
  const handleClick = (e) => {
    if (disabled) return;
    if (onCommit) onCommit(e);
    else if (onClick) onClick(e);
  };

  return (
    <button
      type="button"
      className={`analyse-action-btn ${className}`.trim()}
      disabled={disabled}
      onClick={handleClick}
    >
      <span className="analyse-btn-icon" aria-hidden="true">
        <HugeiconsIcon icon={AiBrain01Icon} size={18} strokeWidth={2.2} />
      </span>
      <span>{label}</span>
    </button>
  );
}
