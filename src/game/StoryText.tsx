import { useEffect, useRef } from 'react';
import type { Page, GameData } from './engine';

export function StoryText({ page, onKeyword }: { page: Page; onKeyword?: (id: number) => void }) {
  const spans = page.spans ?? [];
  const parts = spans.map((span, index) => {
    const before = page.text.slice(index ? spans[index - 1].end : 0, span.start);
    const label = page.text.slice(span.start, span.end);
    const className = `text-color-${span.color} ${span.keyword !== undefined ? 'story-keyword' : ''} ${span.fresh ? 'keyword-new' : ''}`;
    const style = { fontSize: `${Math.max(0.8, 1 + span.size * 0.065)}em` };
    return <span key={index}>{before}{span.keyword !== undefined && onKeyword
      ? <button data-keyword={span.keyword} className={className} style={style} onClick={() => onKeyword(span.keyword!)} aria-label={`${label}，查看关键词`}>{label}</button>
      : <span className={className} style={style}>{label}</span>}</span>;
  });
  return <>{parts}{page.text.slice(spans.at(-1)?.end ?? 0)}</>;
}

/** First mount / restored saves display receipts without replaying acquisition. */
export function CollectionFeedback({ page, data, session, onOpen }: {
  page: Page | null; data: GameData; session: number; onOpen: (panel: 'terms' | 'keywords', id: number) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef({ page, session });
  useEffect(() => {
    const before = previous.current;
    previous.current = { page, session };
    if (before.page?.id === page?.id || before.session !== session || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animations = Array.from(root.current?.children ?? []).map((element, i) => element.animate([
      { opacity: 0, transform: 'translateY(-12px) scale(.96)' },
      { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.25 },
      { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.85 },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], { duration: 1800, delay: i * 140, easing: 'ease-out', fill: 'backwards' }));
    const ghosts: HTMLElement[] = [];
    page?.acquisitions?.forEach((event, i) => {
      if (event.kind !== 'keyword') return;
      const source = root.current?.parentElement?.querySelector(`[data-keyword="${event.id}"]`);
      const target = root.current?.children[i];
      if (!source || !target) return;
      const from = source.getBoundingClientRect(), to = target.getBoundingClientRect();
      const ghost = document.createElement('span');
      ghost.textContent = data.keywords?.[event.id] ?? '';
      ghost.className = 'collection-flight';
      ghost.setAttribute('aria-hidden', 'true');
      Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, maxWidth: `${Math.min(from.width, window.innerWidth - from.left)}px` });
      root.current?.appendChild(ghost);
      ghosts.push(ghost);
      animations.push(ghost.animate([
        { transform: 'translate(0, 0)', opacity: 0 },
        { transform: 'translate(0, -5px)', opacity: 1, offset: .2 },
        { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(.8)`, opacity: 0 },
      ], { duration: 1000, delay: i * 140, easing: 'ease-in-out', fill: 'both' }));
    });
    return () => { animations.forEach(animation => animation.cancel()); ghosts.forEach(ghost => ghost.remove()); };
  }, [page, session, data]);
  return <div ref={root} className="collection-feedback" aria-live="polite" aria-label="本段收录">
    {page?.acquisitions?.map((event, i) => <button key={`${event.kind}-${event.id}-${i}`} onClick={() => onOpen(event.kind === 'term' ? 'terms' : 'keywords', event.id)}>
      <span aria-hidden="true">✦</span> {event.kind === 'term' ? '辞典已收录' : '获得关键词'} · {event.kind === 'term' ? data.terms[event.id] : data.keywords?.[event.id]} <span aria-hidden="true">↗</span>
    </button>)}
  </div>;
}
