/** Shared, data-only capability detection. A CSS perspective gallery alone is not a Three.js scene. */
export type TemplateMotion = { three: boolean; transitions: boolean; celebration: boolean };
export function templateMotion(config: unknown): TemplateMotion {
  const c = (config && typeof config === 'object' ? config : {}) as Record<string, unknown>;
  const effects = Array.isArray(c.effects) ? c.effects.filter((e): e is string => typeof e === 'string') : [];
  return {
    three: c.hero === '3d' || c.background === '3d' || effects.includes('3d-objects'),
    transitions: effects.includes('smooth-transitions') || effects.includes('scroll-reveal'),
    celebration: effects.includes('confetti') || effects.includes('fireworks'),
  };
}
