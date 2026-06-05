import assert from 'node:assert/strict';
import { test } from 'node:test';

import { extractResponseText } from '../lib/gemini/response-text';
import {
  isExplicitPersonaCacheEnabled,
  shouldCreateExplicitPersonaCache,
} from '../lib/cache/persona-cache';

test('explicit persona cache is disabled by default', () => {
  assert.equal(isExplicitPersonaCacheEnabled(undefined), false);
});

test('skips explicit persona cache when token count is below Gemini minimum', () => {
  assert.equal(shouldCreateExplicitPersonaCache(318), false);
});

test('allows explicit persona cache when token count reaches Gemini minimum', () => {
  assert.equal(shouldCreateExplicitPersonaCache(1024), true);
});

test('extracts visible response text while ignoring thought signatures', () => {
  const response = {
    candidates: [
      {
        content: {
          parts: [
            { thoughtSignature: 'opaque-signature' },
            { text: 'Hello' },
            { text: ' hidden thought', thought: true },
            { text: ', friend.' },
          ],
        },
      },
    ],
  };

  assert.equal(extractResponseText(response), 'Hello, friend.');
});
