import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, normalizeOrigin, mergeCors, referenceFilter, objectKey } from './migrate-local-videos-r2.mjs';

test('defaults to read-only, rejects incompatible modes and unknown arguments', () => {
  assert.equal(parseArgs([]).apply, false);
  assert.throws(() => parseArgs(['--dry-run', '--apply']));
  assert.throws(() => parseArgs(['--delete-cloudinary']));
});
test('CORS preserves unrelated rules and uses exact origins', () => {
  const previous = [{ ID: 'other-app', AllowedOrigins: ['https://other.example'] }];
  const next = mergeCors(previous, ['https://lms.example', 'http://localhost:3000']);
  assert.deepEqual(next[0], previous[0]);
  assert.deepEqual(mergeCors(next, ['https://lms.example', 'http://localhost:3000']), next);
  assert.equal(normalizeOrigin('https://lms.example/'), 'https://lms.example');
  assert.throws(() => normalizeOrigin('https://user:password@lms.example'));
  assert.throws(() => normalizeOrigin('https://lms.example/path'));
});
test('reference update compares source and parent identity including absent properties', () => {
  assert.deepEqual(referenceFilter({ _id: 'lesson', course: 'course', module: 'module', videoUrl: 'old' }),
    { _id: 'lesson', course: 'course', module: 'module', videoUrl: 'old', youtubeVideoId: { $exists: false } });
});
test('deterministic object keys change with file content and reject malformed identifiers', () => {
  const args = ['a'.repeat(24), 'b'.repeat(24), 'c'.repeat(64)];
  assert.equal(objectKey(...args), objectKey(...args));
  assert.notEqual(objectKey(...args), objectKey(args[0], args[1], 'd'.repeat(64)));
  assert.throws(() => objectKey('../escape', args[1], args[2]));
});
