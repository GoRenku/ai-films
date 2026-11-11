type FeatureAction = 'impression' | 'select' | 'details' | 'watch';

export function trackFeaturedWorks(hero: HTMLElement, slides: HTMLElement[]) {
  const counted = new Set<string>();
  let position = 0;
  let inView = false;
  let consent = false;
  let timer: number | undefined;

  function record(action: FeatureAction) {
    if (!consent || document.hidden) return;
    const slide = slides[position];
    const key = `${slide.dataset.film}:${action}`;
    if (counted.has(key)) return;
    counted.add(key);
    window.dispatchEvent(new CustomEvent('matinee:feature-analytics', {
      detail: {
        action,
        film_slug: slide.dataset.film,
        format: slide.dataset.format,
        feature_since: slide.dataset.since,
        watch_mode: slide.dataset.watchMode,
        slot: position + 1,
      },
    }));
  }

  function updateImpression() {
    window.clearTimeout(timer);
    if (consent && inView && !document.hidden) {
      timer = window.setTimeout(() => record('impression'), 1000);
    }
  }

  function syncConsent() {
    try {
      consent = localStorage.getItem('latent_matinee_analytics_consent') === 'yes';
    } catch {
      consent = false;
    }
    updateImpression();
  }

  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.intersectionRatio >= 0.5;
    updateImpression();
  }, { threshold: 0.5 });
  observer.observe(hero);
  document.addEventListener('visibilitychange', updateImpression);
  window.addEventListener('matinee:analytics-consent', syncConsent);
  syncConsent();

  function trackLink(event: MouseEvent) {
    const target = (event.target as Element).closest<HTMLElement>('a[data-feature-action]');
    if (!target || !slides[position].contains(target)) return;
    const action = target.dataset.featureAction;
    if (action === 'details' || action === 'watch') {
      record('impression');
      record(action);
    }
  }
  hero.addEventListener('click', trackLink, { capture: true });
  hero.addEventListener('auxclick', (event) => {
    if (event.button === 1) trackLink(event);
  });

  return {
    show(index: number) {
      position = index;
      updateImpression();
    },
    select() {
      record('impression');
      record('select');
    },
  };
}
