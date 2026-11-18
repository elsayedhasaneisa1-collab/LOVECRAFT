import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { buildAllTemplateSeeds, buildTemplateDefaultConfig, buildTemplateFieldsSchema, DEFAULT_COMPATIBILITY } from '../src/lib/templates-catalog';
import { COMPONENT_LIBRARY } from '../src/lib/components-catalog';

async function main() {
  const seeds = buildAllTemplateSeeds();
  const slugs = new Set<string>();
  const allowed = new Set(COMPONENT_LIBRARY.map(c => `${c.componentGroup}/${c.variantKey}`));
  const write = async (file: string, value: unknown) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
  };
  const entries = [];
  for (const seed of seeds) {
    assert(!slugs.has(seed.slug), `Repeated slug: ${seed.slug}`);
    slugs.add(seed.slug);
    const config = buildTemplateDefaultConfig(seed);
    for (const group of ['hero','background','typography','button','gallery'] as const) assert(allowed.has(`${group}/${seed[group]}`), `${seed.slug}: unknown ${group}`);
    for (const section of seed.sections) assert(allowed.has(`section/${section}`));
    for (const effect of seed.effects) assert(allowed.has(`effect/${effect}`));
    await fs.access(path.join('public', seed.previewImage));
    const manifest = {
      format: 1, version: seed.experienceType==='links-showcase'?'1.1.0':'1.0.0', slug: seed.slug, category: seed.categorySlug,
      title: { ar: seed.nameAr, en: seed.nameEn }, descriptionAr: seed.descriptionAr,
      experienceType: seed.experienceType, previewImage: seed.previewImage,
      tier: seed.tier, creditCost: seed.creditCost, order: seed.sortOrder,
      fields: buildTemplateFieldsSchema(seed), config: { ...config, experienceType: seed.experienceType },
      dependencies: [ ...(seed.effects.includes('3d-objects') ? ['three'] : []), ...(seed.effects.some(e => ['confetti','fireworks'].includes(e)) ? ['canvas-confetti'] : []) ],
      compatibility: DEFAULT_COMPATIBILITY, footer: 'shared-global',
    };
    await write(seed.githubPath, manifest);
    entries.push({ path: seed.githubPath, ...manifest });
  }
  await write('templates/catalog.json', { format: 1, templates: entries });
  for (const component of COMPONENT_LIBRARY) await write(component.githubPath, component);
  console.log(`Validated and exported ${seeds.length} templates, ${COMPONENT_LIBRARY.length} component manifests, ${new Set(seeds.map(s => s.categorySlug)).size} categories.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
