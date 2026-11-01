// Built by Tab, an AI assistant, for team lead Akshay Wagh.
// Checks a real MainsMarker review against Algorand TestNet with nothing but the public indexer:
// review hash, input hash, buyer receipt; and that a tampered review fails. Run: node --test tests/
import test from 'node:test'; import assert from 'node:assert/strict'; import crypto from 'node:crypto'; import fs from 'node:fs';
const IDX = 'https://testnet-idx.algonode.cloud';
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : (v && typeof v === 'object') ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const note = (b64, p) => { const s = Buffer.from(b64 || '', 'base64').toString('utf8'); return s.startsWith(p) ? JSON.parse(s.slice(p.length)) : null; };
const S = JSON.parse(fs.readFileSync(new URL('./sample.json', import.meta.url)));

test('canonical JSON is key-order independent', () => {
  assert.equal(canon({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: 'x' } }), canon({ a: { c: 'x', d: [2, { x: 2, y: 1 }] }, b: 1 }));
  assert.equal(canon({ b: 1, a: 2 }), '{"a":2,"b":1}');
});

test('audit note on-chain matches the review and its input', async () => {
  const t = (await (await fetch(`${IDX}/v2/transactions/${S.tx}`)).json()).transaction;
  const rec = note(t.note, 'mainsmarker:j');
  assert.ok(rec, 'audit tx carries a mainsmarker:j note');
  assert.equal(t.sender, 'HOT2D2KIXUHNU6WJISIJP5VAJM3VIY4LW2ILBJGTRES3UAPHRLHSXD6HIY', 'written by the seller (payTo)');
  assert.equal(rec.out, sha(canon(S.review)), 'review hash');
  assert.equal(rec.in, sha(canon({ question: S.q, answer: S.a })), 'input hash');
  const tampered = { ...S.review, score: S.review.score + 3 };
  assert.notEqual(rec.out, sha(canon(tampered)), 'a tampered review must not match');
  // payment referenced by the note is a real asset transfer to the seller
  const p = (await (await fetch(`${IDX}/v2/transactions/${rec.pay}`)).json()).transaction;
  assert.equal(p['asset-transfer-transaction'].receiver, t.sender);
  assert.equal(p['asset-transfer-transaction'].amount, 50000, '0.05 USDC');
  assert.equal(p['asset-transfer-transaction']['asset-id'], 10458941, 'TestNet USDC');
});

test('buyer wrote its own receipt with the same hash', async () => {
  const t = (await (await fetch(`${IDX}/v2/transactions/${S.tx}`)).json()).transaction; const rec = note(t.note, 'mainsmarker:j');
  const j = await (await fetch(`${IDX}/v2/accounts/${rec.payer}/transactions?note-prefix=${encodeURIComponent(Buffer.from('studybuddy:j').toString('base64'))}&limit=200`)).json();
  const r = (j.transactions || []).map(x => note(x.note, 'studybuddy:j')).find(x => x && x.audit === S.tx);
  assert.ok(r, 'receipt found'); assert.equal(r.out, rec.out);
});
