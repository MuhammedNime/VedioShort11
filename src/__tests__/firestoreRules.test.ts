import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('firestore.rules security invariants', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  it('enforces default deny fallback and email_verified ownership guard', () => {
    expect(rules).toContain('match /{document=**}');
    expect(rules).toContain('allow read, write: if false;');
    expect(rules).toContain('request.auth.token.email_verified == true');
  });

  it('includes strict owner-scoped collections for brandPresets, series, episodes, scenes, and generationJobs', () => {
    expect(rules).toContain('match /brandPresets/{brandPresetId}');
    expect(rules).toContain('match /series/{seriesId}');
    expect(rules).toContain('match /episodes/{episodeId}');
    expect(rules).toContain('match /scenes/{sceneId}');
    expect(rules).toContain('match /generationJobs/{jobId}');
    expect(rules).toContain("'1:1'");
    expect(rules).toContain("'isOpenEnded'");
    expect(rules).toContain("'scenesPerEpisode'");
    expect(rules).toContain('<= 500');
    expect(rules).toContain('<= 200');
  });
});
