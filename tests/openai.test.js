const test = require('node:test');
const assert = require('node:assert/strict');

const { buildOpenAIRequestPayload, parseOpenAIResponse } = require('../server.js');

test('buildOpenAIRequestPayload creates a valid chat completion payload', () => {
  const payload = buildOpenAIRequestPayload({
    name: '테스트 프로젝트',
    purpose: '기술 동향 분석',
    documents: [{ fileName: 'report.pdf', extractedText: '전고체 전해질 안전성이 높다.' }],
  });

  assert.equal(payload.model, 'gpt-4o-mini');
  assert.equal(payload.messages[0].role, 'system');
  assert.equal(payload.messages[1].role, 'user');
  assert.match(payload.messages[1].content, /테스트 프로젝트/);
});

test('parseOpenAIResponse extracts valid JSON from fenced content', () => {
  const parsed = parseOpenAIResponse('```json\n{"summary":"테스트 요약"}\n```');
  assert.deepEqual(parsed, { summary: '테스트 요약' });
});
