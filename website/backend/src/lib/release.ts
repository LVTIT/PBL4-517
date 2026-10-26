import { readFileSync } from 'node:fs';

// Read once at process startup. Editing env/Git HEAD cannot relabel a running build.
export const release: { component: string; revision: string; dirty: boolean } = (() => {
  try {
    const value = JSON.parse(readFileSync(new URL('../release.json', import.meta.url), 'utf8'));
    if (value.component !== 'backend' || !/^[a-f0-9]{40}$/.test(value.revision) || typeof value.dirty !== 'boolean') throw new Error();
    return { component: value.component, revision: value.revision, dirty: value.dirty };
  } catch { return { component: 'backend', revision: 'unbuilt', dirty: true }; }
})();
