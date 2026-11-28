# Firestore Security Specification — QuizPro Reels Studio

## Roles & Ownership
- Every user document and subcollection lives strictly under `/users/{userId}/...`.
- `isOwner(userId)` requires `request.auth != null && request.auth.uid == userId`.
- `isVerifiedUser()` requires `isSignedIn() && request.auth.token.email_verified == true`.
- Public reads and cross-user reads/writes are globally denied by `match /{document=**} { allow read, write: if false; }`.

## New Video-Series Entities (Structured Native Maps — No JSON Blobs)
1. **`/users/{userId}/series/{seriesId}` (`Series`)**
   - Required fields: `id`, `ownerId`, `schemaVersion`, `name`, `topic`, `prompt`, `language`, `audience`, `status`, `episodeCount`, `targetDurationSec`, `stylePreset`, `format`, `brandPreset`, `createdAt`, `updatedAt`, `serverUpdatedAt`.
   - Optional fields: `isOpenEnded` (`bool`), `scenesPerEpisode` (`int`, `0..30`), `activeJobId`, `error`.
   - `episodeCount` (`1..500`), `targetDurationSec` (`15..600`).
   - `brandPreset` stored as validated native Map (colors, typography, narrator, intro, outro, subtitleStyle, lowerThirdStyle).
   - Immutability: `id`, `ownerId`, `createdAt` cannot change on update. `serverUpdatedAt == request.time`.
   - Parent gate: `exists(/databases/$(database)/documents/users/$(userId))`.

2. **`/users/{userId}/series/{seriesId}/episodes/{episodeId}` (`Episode`)**
   - Required fields: `id`, `seriesId`, `ownerId`, `index`, `title`, `titleOptions`, `hook`, `script`, `duration`, `status`, `narration`, `music`, `publishKit`, `exportSettings`, `updatedAt`, `serverUpdatedAt`.
   - Bounded arrays: `titleOptions` <= 4 items, `publishKit.hashtags` <= 12, `publishKit.tags` <= 20, `captions` <= 120.
   - `index` (`0..500`), `duration` (`5..3600`).
   - Immutability: `id`, `seriesId`, `ownerId` immutable on update.
   - Parent gate: `exists(/databases/$(database)/documents/users/$(userId)/series/$(seriesId))`.

3. **`/users/{userId}/series/{seriesId}/episodes/{episodeId}/scenes/{sceneId}` (`Scene`)**
   - Required fields: `id`, `episodeId`, `seriesId`, `ownerId`, `index`, `narration`, `onScreenText`, `visualPrompt`, `visualType`, `duration`, `transition`, `animation`, `mood`, `serverUpdatedAt`.
   - Bounded fields: `index` (`0..200`), `narration <= 2000`, `onScreenText.size() <= 6`, `visualPrompt <= 1000`, `duration >= 1 && <= 300`.
   - Parent gate: `exists(/databases/$(database)/documents/users/$(userId)/series/$(seriesId)/episodes/$(episodeId))`.

4. **`/users/{userId}/brandPresets/{brandPresetId}` (`BrandPreset`)**
   - Stores unified channel brand identity as structured nested maps (`logo`, `primaryColors`, `secondaryColors`, `typography`, `narrator`, `music`, `intro`, `outro`, `subtitleStyle`, `lowerThirdStyle`).
   - Strict owner/parent check and `serverUpdatedAt == request.time`.

5. **`/users/{userId}/generationJobs/{jobId}` (`GenerationJob`)**
   - Tracks async job states (`queued | generating | reviewing | ready | exporting | failed`), bounded progress (`0..100`), stage label, and episode counters.
   - Prevents terminal state spoofing (`existing().status != 'ready' && existing().status != 'failed'` on status transitions or explicit retry resets).
