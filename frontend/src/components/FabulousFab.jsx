import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useProject } from '../context/ProjectContext.jsx';
import { ASSISTANT_NAME } from '../constants/assistant.js';
import { publicAssetUrl } from '../config/appBase.js';

const NO_PROJECT_HINT = 'Créez d’abord un projet pour accéder à Fabulous';
const STORAGE_KEY = 'kizumai.fabulousFab.pos';
const DRAG_THRESHOLD_PX = 8;
const EDGE_PAD = 8;

/** Marge basse pour ne pas chevaucher la bottom nav (mobile) / coin (desktop). */
function bottomSafePad() {
  if (typeof window === 'undefined') return 32;
  const w = window.innerWidth;
  if (w >= 1024) return 32;
  if (w >= 640) return 120;
  return 108;
}

function loadStoredPos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      typeof p?.fx === 'number' &&
      typeof p?.fy === 'number' &&
      Number.isFinite(p.fx) &&
      Number.isFinite(p.fy)
    ) {
      return {
        fx: Math.min(1, Math.max(0, p.fx)),
        fy: Math.min(1, Math.max(0, p.fy)),
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveStoredPos(fx, fy) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fx: Math.min(1, Math.max(0, fx)),
        fy: Math.min(1, Math.max(0, fy)),
      })
    );
  } catch {
    /* ignore */
  }
}

function clampPos(left, top, width, height) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxLeft = Math.max(EDGE_PAD, vw - width - EDGE_PAD);
  const maxTop = Math.max(EDGE_PAD, vh - height - bottomSafePad());
  return {
    left: Math.min(maxLeft, Math.max(EDGE_PAD, left)),
    top: Math.min(maxTop, Math.max(EDGE_PAD, top)),
  };
}

function posFromFractions(fx, fy, width, height) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxLeft = Math.max(EDGE_PAD, vw - width - EDGE_PAD);
  const maxTop = Math.max(EDGE_PAD, vh - height - bottomSafePad());
  return {
    left: EDGE_PAD + fx * (maxLeft - EDGE_PAD),
    top: EDGE_PAD + fy * (maxTop - EDGE_PAD),
  };
}

function fractionsFromPos(left, top, width, height) {
  const maxLeft = Math.max(EDGE_PAD, window.innerWidth - width - EDGE_PAD);
  const maxTop = Math.max(EDGE_PAD, window.innerHeight - height - bottomSafePad());
  const spanX = Math.max(1, maxLeft - EDGE_PAD);
  const spanY = Math.max(1, maxTop - EDGE_PAD);
  return {
    fx: (left - EDGE_PAD) / spanX,
    fy: (top - EDGE_PAD) / spanY,
  };
}

/**
 * Bouton flottant Fabulous — guide contextuel de page.
 * Déplaçable (glisser) ; position mémorisée. Clic = ouvrir (si projet).
 */
export default function FabulousFab({ open = false, onOpen }) {
  const { isAuthenticated } = useAuth();
  const { hasProject, loading: projectsLoading } = useProject();
  const btnRef = useRef(null);
  const dragRef = useRef(null);
  const posRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [hasCustomPos, setHasCustomPos] = useState(() => Boolean(loadStoredPos()));

  const setPosBoth = useCallback((next) => {
    posRef.current = next;
    setPos(next);
  }, []);

  const applyFractions = useCallback(
    (stored) => {
      const el = btnRef.current;
      if (!el || !stored) return;
      const { width, height } = el.getBoundingClientRect();
      const raw = posFromFractions(stored.fx, stored.fy, width, height);
      setPosBoth(clampPos(raw.left, raw.top, width, height));
    },
    [setPosBoth]
  );

  useEffect(() => {
    if (!isAuthenticated || open) return undefined;
    const stored = loadStoredPos();
    if (!stored) return undefined;

    const sync = () => {
      requestAnimationFrame(() => applyFractions(loadStoredPos() || stored));
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [isAuthenticated, open, applyFractions]);

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e) => {
      const d = dragRef.current;
      const el = btnRef.current;
      if (!d || !el) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
        d.moved = true;
      }
      if (!d.moved) return;
      e.preventDefault();
      const { width, height } = el.getBoundingClientRect();
      const next = clampPos(d.originLeft + dx, d.originTop + dy, width, height);
      setPosBoth(next);
      setHasCustomPos(true);
    };

    const onUp = (e) => {
      const d = dragRef.current;
      const el = btnRef.current;
      dragRef.current = null;
      setDragging(false);
      try {
        el?.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      if (!d?.moved) {
        if (!d?.locked) onOpen?.();
        return;
      }
      const current = posRef.current;
      if (!el || !current) return;
      const { width, height } = el.getBoundingClientRect();
      const { left, top } = clampPos(current.left, current.top, width, height);
      const fr = fractionsFromPos(left, top, width, height);
      saveStoredPos(fr.fx, fr.fy);
      setPosBoth({ left, top });
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, onOpen, setPosBoth]);

  if (!isAuthenticated || open) return null;

  const locked = !projectsLoading && !hasProject;
  const label = locked
    ? NO_PROJECT_HINT
    : `Ouvrir le guide ${ASSISTANT_NAME} pour cette page (glisser pour déplacer)`;

  const onPointerDown = (e) => {
    if (e.button != null && e.button !== 0) return;
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const originLeft = hasCustomPos && pos ? pos.left : rect.left;
    const originTop = hasCustomPos && pos ? pos.top : rect.top;
    if (!hasCustomPos || !pos) {
      setPosBoth({ left: originLeft, top: originTop });
      setHasCustomPos(true);
    }
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originLeft,
      originTop,
      moved: false,
      locked,
    };
    setDragging(true);
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const resetPosition = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setPosBoth(null);
    setHasCustomPos(false);
  };

  const style =
    hasCustomPos && pos
      ? {
          left: `${pos.left}px`,
          top: `${pos.top}px`,
          right: 'auto',
          bottom: 'auto',
          touchAction: 'none',
        }
      : { touchAction: 'none' };

  return (
    <button
      ref={btnRef}
      type="button"
      onPointerDown={onPointerDown}
      onClick={(e) => {
        // Ouverture gérée au pointerup si pas de drag.
        e.preventDefault();
      }}
      onContextMenu={resetPosition}
      title={`${label} — clic droit : réinitialiser la position`}
      aria-label={label}
      style={style}
      className={[
        'fixed z-[60] flex items-center gap-2 rounded-full',
        !(hasCustomPos && pos) && 'right-4 sm:right-6',
        !(hasCustomPos && pos) &&
          'bottom-[calc(6.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))]',
        !(hasCustomPos && pos) && 'lg:bottom-8 lg:right-8',
        'pl-2.5 pr-3.5 py-2 sm:pl-3 sm:pr-4 sm:py-2.5',
        'shadow-lg shadow-prune-900/20 border select-none',
        dragging ? 'transition-none cursor-grabbing scale-[1.03]' : 'transition-shadow duration-200 cursor-grab',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-wasabi-400 focus-visible:ring-offset-2',
        locked
          ? 'opacity-55 bg-prune-100 border-prune-200 text-prune-400'
          : 'bg-white border-wasabi-200/80 text-prune-800 hover:shadow-xl hover:border-wasabi-300',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <img
        src={publicAssetUrl('fabulous.svg')}
        alt=""
        width={36}
        height={36}
        draggable={false}
        className={[
          'h-9 w-9 sm:h-10 sm:w-10 shrink-0 select-none rounded-full pointer-events-none',
          locked ? 'opacity-50 grayscale' : '',
        ].join(' ')}
        decoding="async"
      />
      <span
        className={[
          'text-sm font-semibold tracking-wide pointer-events-none',
          locked ? 'text-prune-400' : 'text-prune-900',
        ].join(' ')}
      >
        {ASSISTANT_NAME}
      </span>
    </button>
  );
}
