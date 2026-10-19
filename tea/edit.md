## Integrate the <FuseButton /> component from React Bits

You are helping integrate an open-source React component into an existing application.

### Component: FuseButton
### Variant: JavaScript + CSS
### Dependencies: @hugeicons/react @hugeicons/core-free-icons

---

### Usage Example
```jsx
import FuseButton from './FuseButton';

<FuseButton
  label="Archive"
  doneLabel="Archived"
  undoLabel="Undo"
  color="#f5f5f5"
  background="#27272a"
  fuseColor="#f5a524"
  size="md"
  radius={22}
  undoWindow={4000}
  fuse="outline"
  fuseThickness={1.5}
  crossfadeMs={200}
  commitOn="press"
  pauseOnHover
  settle="reset"
  onCommit={() => archive(item)}
  onUndo={() => restore(item)}
  onFuseEnd={() => purge(item)}
/>
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| label | string | "Archive" | The idle action. |
| undoLabel | string | "Undo" | The label while the fuse burns; the whole pill is the Undo button. |
| doneLabel | string | "Archived" | Shown with a check once the fuse burns out and settle is stay; announced to screen readers on arm. |
| icon | ReactNode | undefined | The idle glyph; an archive icon when omitted. |
| color | string | "#f5f5f5" | Ink for labels and icons; the seam and tints derive from it. |
| background | string | "#27272a" | The pill surface. |
| fuseColor | string | "#f5a524" | The lit line or ring. |
| size | "sm" | "md" | "lg" | "md" | Height 36, 44 or 52 pixels with matching type and icons. |
| radius | number | 22 | Corner radius in pixels; 22 is a full pill at the medium size. |
| undoWindow | number | 4000 | How long the fuse burns and Undo stays on offer, in milliseconds. |
| fuse | "outline" | "bottom" | "top" | "outline" | The pill rim burning down clockwise, or a line along the bottom or top edge. |
| fuseThickness | number | 1.5 | Line height or rim stroke in pixels. |
| crossfadeMs | number | 200 | Blur crossfade between faces after a pointer press. Keyboard commits swap instantly. |
| commitOn | "press" | "fuseEnd" | "press" | When onCommit fires: at the press, with Undo as the revert, or only once the fuse burns out. |
| pauseOnHover | boolean | true | Leaving and coming back with a mouse freezes the fuse until the pointer leaves again. |
| settle | "reset" | "stay" | "reset" | After the fuse ends: return to the idle face, or stay on a terminal done face until remounted. |
| disabled | boolean | false | Dims the idle face and ignores presses. Undo stays available while armed. |
| onCommit | (reason: "press" | "fuseEnd") => void | - | The action. |
| onUndo | () => void | - | Called when Undo or Escape runs the action back. |
| onFuseEnd | () => void | - | Called when the window closes without an undo. |
| onPhaseChange | (phase: "idle" | "armed" | "settled") => void | - | Called on every phase change. |
| type | "button" | "submit" | "reset" | "button" | Type of the idle button. |
| className | string | "" | Extra classes for the pill. |

### Full Component Source
```jsx
'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Archive02Icon, Tick02Icon, Undo02Icon } from '@hugeicons/core-free-icons';

import './FuseButton.css';

const LINE = [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }];
const OUTLINE = [{ strokeDashoffset: 0 }, { strokeDashoffset: -1 }];
const SIZES = {
  sm: { height: 36, font: 13, icon: 14, px: 16 },
  md: { height: 44, font: 14, icon: 15, px: 20 },
  lg: { height: 52, font: 15, icon: 17, px: 24 }
};

export default function FuseButton({
  label = 'Archive',
  undoLabel = 'Undo',
  doneLabel = 'Archived',
  icon,
  color = '#f5f5f5',
  background = '#27272a',
  fuseColor = '#f5a524',
  size = 'md',
  radius = 22,
  undoWindow = 4000,
  fuse = 'outline',
  fuseThickness = 1.5,
  crossfadeMs = 200,
  commitOn = 'press',
  pauseOnHover = true,
  settle = 'reset',
  disabled = false,
  onCommit,
  onUndo,
  onFuseEnd,
  onPhaseChange,
  className = '',
  type = 'button'
}) {
  const [phase, setPhase] = useState('idle');
  const [instant, setInstant] = useState(false);
  const rootRef = useRef(null);
  const idleRef = useRef(null);
  const undoRef = useRef(null);
  const lineRef = useRef(null);
  const rimRef = useRef(null);
  const anim = useRef(null);
  const pause = useRef({ hover: false, hidden: false, canHoverPause: false });
  const lastInput = useRef('pointer');
  const windowRef = useRef(undoWindow);
  const latest = useRef({ commitOn, settle });
  latest.current = { onCommit, onUndo, onFuseEnd, onPhaseChange, commitOn, settle };
  const statusId = useId();
  const preset = SIZES[size] || SIZES.md;

  const go = next => {
    setInstant(lastInput.current === 'keyboard');
    setPhase(next);
    latest.current.onPhaseChange?.(next);
  };

  const syncPlayState = () => {
    const a = anim.current;
    if (!a) return;
    const { hover, hidden } = pause.current;
    if (hover || hidden) {
      if (a.playState === 'running') a.pause();
    } else if (a.playState === 'paused') {
      a.play();
    }
  };

  const light = (from = 0) => {
    const el = fuse === 'outline' ? rimRef.current : lineRef.current;
    if (!el) return;
    anim.current?.cancel();
    const a = el.animate(fuse === 'outline' ? OUTLINE : LINE, {
      duration: windowRef.current,
      easing: 'linear',
      fill: 'forwards'
    });
    if (from) a.currentTime = from;
    a.onfinish = () => {
      const l = latest.current;
      l.onFuseEnd?.();
      if (l.commitOn === 'fuseEnd') l.onCommit?.('fuseEnd');
      lastInput.current = 'pointer';
      go(l.settle === 'stay' ? 'settled' : 'idle');
    };
    anim.current = a;
    syncPlayState();
  };

  const arm = () => {
    if (disabled || phase !== 'idle') return;
    windowRef.current = undoWindow;
    light();
    pause.current.canHoverPause = false;
    pause.current.hover = false;
    if (commitOn === 'press') onCommit?.('press');
    go('armed');
  };

  const undo = () => {
    if (phase !== 'armed') return;
    const a = anim.current;
    if (a) {
      a.onfinish = null;
      a.pause();
    }
    onUndo?.();
    go('idle');
  };

  useEffect(() => {
    const inside = rootRef.current?.contains(document.activeElement);
    if (phase === 'armed') undoRef.current?.focus({ preventScroll: true });
    else if (inside) (phase === 'idle' ? idleRef.current : rootRef.current)?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    const onVisibility = () => {
      pause.current.hidden = document.hidden;
      syncPlayState();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      anim.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const a = anim.current;
    if (!a || phase !== 'armed') return;
    light(Number(a.currentTime) || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuse]);

  useEffect(() => {
    if (pauseOnHover) return;
    pause.current.hover = false;
    syncPlayState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseOnHover]);

  const handlePointerDown = e => {
    lastInput.current = 'pointer';
    const pressable = phase === 'armed' || (phase === 'idle' && !disabled);
    if (e.button === 0 && pressable && rootRef.current) rootRef.current.dataset.pressed = '';
  };
  const release = () => {
    if (rootRef.current) delete rootRef.current.dataset.pressed;
  };
  const handlePointerEnter = e => {
    if (pauseOnHover && e.pointerType === 'mouse' && pause.current.canHoverPause) {
      pause.current.hover = true;
      syncPlayState();
    }
  };
  const handlePointerLeave = e => {
    release();
    if (e.pointerType !== 'mouse') return;
    pause.current.canHoverPause = true;
    pause.current.hover = false;
    syncPlayState();
  };
  const handleKeyDown = e => {
    if (e.key === 'Enter' || e.key === ' ') lastInput.current = 'keyboard';
    if (e.key === 'Escape' && phase === 'armed') {
      e.preventDefault();
      lastInput.current = 'keyboard';
      undo();
    }
  };

  const actionIcon = icon ?? <HugeiconsIcon icon={Archive02Icon} size={preset.icon} strokeWidth={1.8} />;
  const line = <i ref={lineRef} className="fuse-button__fuse" aria-hidden="true" />;

  return (
    <span
      ref={rootRef}
      tabIndex={-1}
      className={`fuse-button${className ? ` ${className}` : ''}`}
      data-phase={phase}
      data-fuse={fuse}
      data-instant={instant ? '' : undefined}
      aria-disabled={phase === 'settled' || undefined}
      style={{
        '--fb-ink': color,
        '--fb-bg': background,
        '--fb-fuse': fuseColor,
        '--fb-fuse-h': `${fuseThickness}px`,
        '--fb-radius': `${radius}px`,
        '--fb-fade': `${crossfadeMs}ms`,
        '--fb-h': `${preset.height}px`,
        '--fb-fs': `${preset.font}px`,
        '--fb-icon': `${preset.icon}px`,
        '--fb-px': `${preset.px}px`
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={idleRef}
        type={type}
        className="fuse-button__face fuse-button__idle"
        disabled={disabled}
        inert={phase !== 'idle'}
        onClick={arm}
      >
        <span className="fuse-button__icon" aria-hidden="true">
          {actionIcon}
        </span>
        {label}
      </button>
      <button
        ref={undoRef}
        type="button"
        className="fuse-button__face fuse-button__undo"
        aria-describedby={statusId}
        aria-keyshortcuts="Escape"
        inert={phase !== 'armed'}
        onClick={undo}
      >
        <span className="fuse-button__icon fuse-button__icon--undo" aria-hidden="true">
          <HugeiconsIcon icon={Undo02Icon} size={preset.icon} strokeWidth={2} />
        </span>
        {undoLabel}
        {fuse !== 'outline' ? line : null}
      </button>
      <span className="fuse-button__face fuse-button__settled" inert={phase !== 'settled'}>
        <span className="fuse-button__icon" aria-hidden="true">
          <HugeiconsIcon icon={Tick02Icon} size={preset.icon} strokeWidth={2.2} />
        </span>
        {doneLabel}
      </span>
      {fuse === 'outline' ? (
        <svg className="fuse-button__rim" aria-hidden="true">
          <rect ref={rimRef} pathLength="1" />
        </svg>
      ) : null}
      <span className="fuse-button__status" id={statusId} role="status" aria-live="polite">
        {phase === 'idle' ? '' : doneLabel}
      </span>
    </span>
  );
}

```

### Component CSS
```css
.fuse-button {
  --fb-ink: #f5f5f5;
  --fb-bg: #27272a;
  --fb-fuse: #f5a524;
  --fb-fuse-h: 1.5px;
  --fb-radius: 22px;
  --fb-fade: 200ms;
  --fb-press: 0.97;
  --fb-h: 44px;
  --fb-fs: 14px;
  --fb-icon: 15px;
  --fb-px: 20px;
  --fb-ease-out: cubic-bezier(0.23, 1, 0.32, 1);

  position: relative;
  display: inline-grid;
  grid-template-columns: minmax(0, 1fr);
  height: var(--fb-h);
  border-radius: var(--fb-radius);
  background: var(--fb-bg);
  color: var(--fb-ink);
  font-family: inherit;
  font-size: var(--fb-fs);
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.01em;
  overflow: hidden;
  isolation: isolate;
  outline: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: transform 160ms var(--fb-ease-out);
}

.fuse-button[data-pressed] {
  transform: scale(var(--fb-press));
}

.fuse-button:has(:focus-visible) {
  outline: 2px solid color-mix(in srgb, var(--fb-ink) 60%, transparent);
  outline-offset: 3px;
}

.fuse-button__idle:focus-visible,
.fuse-button__undo:focus-visible {
  outline: none;
}

@supports not selector(:has(a)) {
  .fuse-button__idle:focus-visible,
  .fuse-button__undo:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--fb-ink) 60%, transparent);
    outline-offset: -3px;
  }
}

.fuse-button__face {
  position: relative;
  grid-area: 1 / 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  min-width: 0;
  margin: 0;
  padding: 0 var(--fb-px);
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  white-space: nowrap;
  cursor: pointer;
  opacity: 0;
  filter: blur(2px);
  visibility: hidden;
  transition:
    opacity var(--fb-fade) ease,
    filter var(--fb-fade) ease,
    visibility 0s linear var(--fb-fade),
    background-color 160ms ease;
}

.fuse-button[data-phase='idle'] .fuse-button__idle,
.fuse-button[data-phase='armed'] .fuse-button__undo,
.fuse-button[data-phase='settled'] .fuse-button__settled {
  opacity: 1;
  filter: blur(0);
  visibility: visible;
  transition-delay: 0s;
}

.fuse-button[data-instant] .fuse-button__face {
  transition-duration: 0s;
}

.fuse-button__idle:disabled,
.fuse-button__settled {
  cursor: default;
}

.fuse-button[data-phase='idle']:has(.fuse-button__idle:disabled) {
  opacity: 0.55;
}

.fuse-button__icon {
  display: inline-flex;
  width: var(--fb-icon);
  height: var(--fb-icon);
}

.fuse-button__icon svg {
  width: 100%;
  height: 100%;
}

.fuse-button__icon--undo {
  transform: rotate(-70deg);
  transition: transform var(--fb-fade) var(--fb-ease-out);
}

.fuse-button[data-phase='armed'] .fuse-button__icon--undo {
  transform: rotate(0deg);
}

.fuse-button__fuse {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--fb-fuse-h);
  background: var(--fb-fuse);
  box-shadow: 0 0 6px color-mix(in srgb, var(--fb-fuse) 55%, transparent);
  transform-origin: left center;
  pointer-events: none;
}

.fuse-button[data-fuse='top'] .fuse-button__fuse {
  bottom: auto;
  top: 0;
}

.fuse-button__rim {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  opacity: 0;
  filter: drop-shadow(0 0 3px color-mix(in srgb, var(--fb-fuse) 60%, transparent));
  transition: opacity var(--fb-fade) ease;
}

.fuse-button[data-phase='armed'] .fuse-button__rim {
  opacity: 1;
}

.fuse-button[data-instant] .fuse-button__rim {
  transition-duration: 0s;
}

.fuse-button__rim rect {
  x: calc(var(--fb-fuse-h) / 2);
  y: calc(var(--fb-fuse-h) / 2);
  width: calc(100% - var(--fb-fuse-h));
  height: calc(100% - var(--fb-fuse-h));
  rx: max(0px, calc(var(--fb-radius) - var(--fb-fuse-h) / 2));
  fill: none;
  stroke: var(--fb-fuse);
  stroke-width: var(--fb-fuse-h);
  stroke-linecap: round;
  stroke-dasharray: 1;
}

.fuse-button__status {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (hover: hover) and (pointer: fine) {
  .fuse-button__idle:not(:disabled):hover,
  .fuse-button__undo:hover {
    background: color-mix(in srgb, var(--fb-ink) 7%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fuse-button[data-pressed] {
    transform: none;
  }

  .fuse-button .fuse-button__face {
    filter: none;
    transition:
      opacity var(--fb-fade) ease,
      visibility 0s linear var(--fb-fade);
  }

  .fuse-button .fuse-button__icon--undo {
    transform: none;
    transition: none;
  }
}

@media (prefers-contrast: more) {
  .fuse-button {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fb-ink) 40%, transparent);
  }
}

@media (forced-colors: active) {
  .fuse-button__fuse {
    background: Highlight;
  }

  .fuse-button__rim rect {
    stroke: Highlight;
  }
}

```

### Integration Instructions
1. Install any listed dependencies.
2. Copy the component source into the appropriate directory in the project.
3. Import the CSS file alongside the component.
4. Import and render the component using the usage example above as a starting point.
5. Adjust props as needed for the specific use case — refer to the props table for all available options.

### More from React Bits
The full library index, including everything reactbits.dev offers, is at https://reactbits.dev/llms.txt — fetch it if this component is not the right fit or the project needs more pieces.
