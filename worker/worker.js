// MainsMarker on Algorand — an accountable answer-review agent paid per call over x402 (gasless), with an on-chain audit note per review.
// Built by Tab, an AI assistant, for team lead Akshay Wagh.
import algosdk from 'algosdk';
import { ExactAvmScheme as AvmServer } from '@x402/avm/exact/server';
import { ExactAvmScheme as AvmFacilitator } from '@x402/avm/exact/facilitator';
import { toFacilitatorAvmSigner } from '@x402/avm';
import { encodePaymentRequiredHeader, decodePaymentSignatureHeader, encodePaymentResponseHeader } from '@x402/core/http';

const SECRETS = globalThis.__MM_SECRETS__ || {};
const CFG = __CFG__;
const NET = CFG.network;
const ALGOD = 'https://testnet-api.algonode.cloud', IDX = 'https://testnet-idx.algonode.cloud';
const EXPLORER = 'https://lora.algokit.io/testnet';
const PRICE = '250000'; // 0.25 MMTC (test credit ASA, 6 decimals)
const NOTE_PREFIX = 'mainsmarker:j';
const DISCLOSURE = 'Built by Tab, an AI assistant, for team lead Akshay Wagh.';
const enc = new TextEncoder();
async function sha256hex(s) { const d = await crypto.subtle.digest('SHA-256', typeof s === 'string' ? enc.encode(s) : s); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : (v && typeof v === 'object') ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-Audit-Tx', ...headers } });
const txUrl = h => `${EXPLORER}/transaction/${h}`;
const accUrl = a => `${EXPLORER}/account/${a}`;
const now = () => Date.now();
const algod = () => new algosdk.Algodv2('', ALGOD, '');
let _fac; const facilitator = () => (_fac ||= new AvmFacilitator(toFacilitatorAvmSigner(SECRETS.FAC_KEY, { testnetUrl: ALGOD })));

async function requirements(resourceUrl) {
  const server = new AvmServer();
  const p = await server.parsePrice({ amount: PRICE, asset: String(CFG.asa) }, NET);
  let req = { scheme: 'exact', network: NET, payTo: CFG.accounts.mainsmarker, amount: p.amount, asset: p.asset, maxTimeoutSeconds: 300, extra: p.extra || {} };
  req = await server.enhancePaymentRequirements(req, { x402Version: 2, scheme: 'exact', network: NET, extra: facilitator().getExtra(NET) }, []);
  return { x402Version: 2, error: 'Payment required: 0.25 MMTC (test credit ASA ' + CFG.asa + ') per review. Fees are paid by the facilitator (fee pooling), so the buyer needs no ALGO.', resource: { url: resourceUrl, description: 'MainsMarker: review of one UPSC Mains answer with an on-chain audit note.', mimeType: 'application/json' }, accepts: [req] };
}

// ---------- LLM review ----------
const RUBRIC_VERSION = 'mm-rubric-2026-11-01b'; // b: per-criterion subscores (round-1 feedback)
const SYS = `You are MainsMarker, a strict but fair UPSC Civil Services / IFoS Mains examiner.
Evaluate the candidate's answer to the question. Judge: directive word compliance (discuss/explain/critically examine...), introduction, structure, content accuracy and coverage, Indian examples and data, diagram/flowchart use where it earns marks, conclusion, and word limit (about 150 words for 10 marks, 250 for 15).
Be specific and actionable. Never invent statistics; if you mention a figure, say it must be checked.
Return ONLY JSON with keys:
"score" (number, to one decimal), "max" (number), "verdict" (one sentence),
"strengths" (array of up to 3 short strings), "improvements" (array of up to 4 short strings),
"missing_points" (array of up to 5 short strings), "model_outline" (array of 4-7 short lines: intro, body points, diagram idea, conclusion),
"diagram_tip" (string or ""), "word_count_note" (string),
"subscores" (object with integer marks out of 10 for each criterion: "directive", "structure", "content", "examples", "diagram", "conclusion").
Use the whole scale: an answer that misses the directive or has no content scores low; reserve high marks for answers a topper would write. Only cite Indian examples that are relevant to the question's topic.`;

let _rb; const rubricHash = async () => (_rb ||= await sha256hex(RUBRIC_VERSION + '\n' + SYS));
async function chat(url, key, model, messages, extra = {}, timeoutMs = 45000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages, temperature: 0.2, ...extra }) });
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content;
    if (!r.ok || !text) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    return text;
  } finally { clearTimeout(t); }
}
function parseReview(text, max) {
  let s = text.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  const o = JSON.parse(s.slice(a, b + 1));
  const arr = v => Array.isArray(v) ? v.map(String).slice(0, 7) : [];
  return {
    score: Math.max(0, Math.min(Number(max), Number(o.score) || 0)), max: Number(max),
    verdict: String(o.verdict || ''), strengths: arr(o.strengths), improvements: arr(o.improvements),
    missing_points: arr(o.missing_points), model_outline: arr(o.model_outline),
    diagram_tip: String(o.diagram_tip || ''), word_count_note: String(o.word_count_note || ''),
    subscores: Object.fromEntries(['directive', 'structure', 'content', 'examples', 'diagram', 'conclusion'].map(k => [k, Math.max(0, Math.min(10, Math.round(Number(o?.subscores?.[k]) || 0)))])),
  };
}
async function review({ question, answer, marks, mode }) {
  const max = [10, 15, 20].includes(Number(marks)) ? Number(marks) : 10;
  const words = (answer.match(/\S+/g) || []).length;
  const messages = [{ role: 'system', content: SYS }, { role: 'user', content: `Question (${max} marks): ${question}\n\nCandidate answer (${words} words):\n${answer}` }];
  const tries = [];
  if (mode === 'private') tries.push(['self-hosted/huihui-qwythos-9b-abliterated', () => chat(SECRETS.PRIV_URL + '/chat/completions', SECRETS.PRIV_KEY, 'any', messages, { max_tokens: 900, chat_template_kwargs: { enable_thinking: false } }, 60000)]);
  tries.push(['groq/openai/gpt-oss-120b', () => chat('https://api.groq.com/openai/v1/chat/completions', SECRETS.GROQ, 'openai/gpt-oss-120b', messages, { max_tokens: 1800, reasoning_effort: 'low', response_format: { type: 'json_object' } })]);
  tries.push(['groq/openai/gpt-oss-20b', () => chat('https://api.groq.com/openai/v1/chat/completions', SECRETS.GROQ, 'openai/gpt-oss-20b', messages, { max_tokens: 1800, reasoning_effort: 'low', response_format: { type: 'json_object' } })]);
  tries.push(['google/gemini-3.5-flash-lite', () => chat('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', SECRETS.GEMINI, 'gemini-3.5-flash-lite', messages, { max_tokens: 1800 })]);
  const errors = [];
  for (const [model, fn] of tries) {
    try { const out = parseReview(await fn(), max); return { review: { ...out, words, model }, model, fallbacks: errors }; }
    catch (e) { errors.push(`${model}: ${String(e.message || e).slice(0, 120)}`); }
  }
  throw new Error('All models failed: ' + errors.join(' | '));
}



// ---------- accountability: ARC-2 note on a 0-ALGO self-payment ----------
async function anchorAudit(rec) {
  const sk = algosdk.mnemonicToSecretKey(SECRETS.MM_MNEMONIC).sk;
  const c = algod(); const sp = await c.getTransactionParams().do();
  const t = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: CFG.accounts.mainsmarker, receiver: CFG.accounts.mainsmarker, amount: 0, note: enc.encode(NOTE_PREFIX + JSON.stringify(rec)), suggestedParams: sp });
  const { txid } = await c.sendRawTransaction(t.signTxn(sk)).do();
  return txid;
}
async function refundAsa(payer, payTx, why) {
  const sk = algosdk.mnemonicToSecretKey(SECRETS.MM_MNEMONIC).sk;
  const c = algod(); const sp = await c.getTransactionParams().do();
  const t = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender: CFG.accounts.mainsmarker, receiver: payer, amount: Number(PRICE), assetIndex: Number(CFG.asa), note: enc.encode(NOTE_PREFIX + JSON.stringify({ v: 1, t: 'refund', pay: payTx, payer, why: String(why).slice(0, 80) })), suggestedParams: sp });
  const { txid } = await c.sendRawTransaction(t.signTxn(sk)).do();
  return txid;
}
const b64 = s => btoa(s);
function readNote(n) { try { const s = atob(n); if (!s.startsWith(NOTE_PREFIX)) return null; return JSON.parse(s.slice(NOTE_PREFIX.length)); } catch { return null; } }
async function auditLog(limit = 20) {
  const r = await fetch(`${IDX}/v2/accounts/${CFG.accounts.mainsmarker}/transactions?note-prefix=${encodeURIComponent(b64(NOTE_PREFIX))}&limit=${limit}`);
  const j = await r.json();
  return (j.transactions || []).map(t => ({ ...readNote(t.note), tx: t.id, at: new Date(t['round-time'] * 1000).toISOString(), round: t['confirmed-round'], explorer: txUrl(t.id) })).filter(x => x.out || x.t === 'refund');
}
async function auditByTx(id) {
  const r = await fetch(`${IDX}/v2/transactions/${id}`); if (r.status !== 200) return { found: false, status: 'not indexed yet' };
  const t = (await r.json()).transaction; const rec = readNote(t.note || '');
  return rec ? { found: true, status: 'confirmed in round ' + t['confirmed-round'], record: rec, explorer: txUrl(id) } : { found: false, status: 'no MainsMarker note' };
}
async function stats() {
  const r = await fetch(`${IDX}/v2/accounts/${CFG.accounts.mainsmarker}/transactions?asset-id=${CFG.asa}&tx-type=axfer&limit=1000`);
  const j = await r.json(); const buyers = new Set(); let paid = 0, refunds = 0;
  for (const t of j.transactions || []) { const x = t['asset-transfer-transaction']; if (!x) continue;
    if (x.receiver === CFG.accounts.mainsmarker && t.sender !== CFG.accounts.mainsmarker && String(x.amount) === PRICE) { paid++; buyers.add(t.sender); }
    if (t.sender === CFG.accounts.mainsmarker && x.receiver !== CFG.accounts.mainsmarker && String(x.amount) === PRICE) refunds++; }
  return { paid_reviews: paid, refunds, distinct_buyer_accounts: buyers.size, revenue_mmtc: (paid - refunds) * Number(PRICE) / 1e6, price_mmtc: Number(PRICE) / 1e6, note: 'Counts only transfers of exactly the price; the initial 1,000 MMTC funding of StudyBuddy and opt-ins are excluded.', buyers: [...buyers] };
}
async function agentId() {
  const [a, cfgTx] = await Promise.all([fetch(`${IDX}/v2/assets/${CFG.agent_asa}`).then(r => r.json()), fetch(`${IDX}/v2/assets/${CFG.agent_asa}/transactions?tx-type=acfg&limit=20`).then(r => r.json())]);
  const p = a.asset?.params || {}; const txs = (cfgTx.transactions || []).sort((x, y) => y['confirmed-round'] - x['confirmed-round']);
  let meta = null; for (const t of txs) { try { meta = JSON.parse(atob(t.note)); break; } catch {} }
  return { asset_id: CFG.agent_asa, creator: p.creator, manager: p.manager, total: p.total, url: p.url, arc69: meta, explorer: `${EXPLORER}/asset/${CFG.agent_asa}` };
}

// ---------- abuse limits on the gasless path ----------
const LIMITS = { per_payer_per_10min: 6, max_in_flight: 4 }; const seen = new Map(); let inFlight = 0;
function limitCheck(payer) { const t = now(), xs = (seen.get(payer) || []).filter(x => t - x < 600000); if (xs.length >= LIMITS.per_payer_per_10min) return 'rate limit: 6 paid reviews per payer per 10 minutes'; if (inFlight >= LIMITS.max_in_flight) return 'busy, retry shortly'; xs.push(t); seen.set(payer, xs); return null; }

async function handleX402(request, origin) {
  const pr = await requirements(origin + '/x402/review');
  let body; try { body = await request.json(); } catch { body = {}; }
  const question = String(body.question || '').slice(0, 1500).trim(), answer = String(body.answer || '').slice(0, 6000).trim();
  if (question.length < 10 || answer.length < 30) return json({ error: 'Send JSON {question, answer, marks: 10|15|20, mode: "cloud"|"private"}.' }, 400);
  const sig = request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('X-PAYMENT');
  if (!sig) return json(pr, 402, { 'PAYMENT-REQUIRED': encodePaymentRequiredHeader(pr) });
  let payload; try { payload = decodePaymentSignatureHeader(sig); } catch { return json({ ...pr, error: 'Malformed PAYMENT-SIGNATURE' }, 402); }
  const req = pr.accepts[0]; const t0 = now();
  const v = await facilitator().verify(payload, req);
  if (!v.isValid) return json({ ...pr, error: 'Payment rejected: ' + (v.invalidReason || 'invalid') + (v.invalidMessage ? ' — ' + v.invalidMessage : '') }, 402);
  const lim = limitCheck(v.payer || 'unknown'); if (lim) return json({ ...pr, error: lim }, 429);
  inFlight++;
  try {
    const s = await facilitator().settle(payload, req);
    if (!s.success) return json({ ...pr, error: 'Settlement failed: ' + (s.errorReason || '') }, 402);
    const tPaid = now();
    let rvOut;
    try { if (body.simulate === 'reviewer_outage') throw new Error('Simulated reviewer outage (refund-path demo requested by the buyer)'); rvOut = await review({ question, answer, marks: body.marks, mode: body.mode }); }
    catch (e) { let refundTx = null, rerr = null; try { refundTx = await refundAsa(s.payer, s.transaction, e.message || e); } catch (e2) { rerr = String(e2.message || e2); }
      return json({ error: 'Review failed after payment; refunded.', reason: String(e.message || e).slice(0, 200), payment: { transaction: s.transaction, explorer: txUrl(s.transaction) }, refund: refundTx ? { tx: refundTx, explorer: txUrl(refundTx) } : { error: rerr } }, 502); }
    const { review: rv, model, fallbacks } = rvOut;
    const tRev = now();
    const inHash = await sha256hex(canon({ question, answer })), outHash = await sha256hex(canon(rv));
    const rec = { v: 1, in: inHash, out: outHash, rb: (await rubricHash()).slice(0, 12), m: model, pay: s.transaction, payer: s.payer, sc: `${rv.score}/${rv.max}`, agent: CFG.agent_asa };
    let auditTx = null, auditErr = null; try { auditTx = await anchorAudit(rec); } catch (e) { auditErr = String(e.message || e); }
    const settle = { success: true, transaction: s.transaction, network: s.network, payer: s.payer };
    return json({ review_id: s.transaction.slice(0, 10), review: rv, review_sha256: outHash, input_sha256: inHash, hashing: 'SHA-256 over canonical JSON (keys sorted recursively, no whitespace)',
      payment: { ...settle, amount: Number(PRICE) / 1e6, asset: CFG.asa, fee_payer: CFG.accounts.facilitator, explorer: txUrl(s.transaction) },
      audit: auditTx ? { tx: auditTx, memo: rec, note: NOTE_PREFIX + JSON.stringify(rec), explorer: txUrl(auditTx), status: 'submitted; confirmed in ~3 s' } : { error: auditErr },
      rubric: { version: RUBRIC_VERSION, sha256: await rubricHash() }, model, fallbacks, timings_ms: { settle: tPaid - t0, review: tRev - tPaid, total: now() - t0 }, disclosure: DISCLOSURE,
    }, 200, { 'PAYMENT-RESPONSE': encodePaymentResponseHeader(settle), 'X-Audit-Tx': auditTx || '' });
  } finally { inFlight--; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url); const origin = url.origin;
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-expose-headers': 'PAYMENT-REQUIRED, PAYMENT-RESPONSE' } });
    try {
      if (url.pathname === '/x402/review' && request.method === 'POST') return await handleX402(request, origin);
      if (url.pathname === '/x402/review') { const pr = await requirements(origin + '/x402/review'); return json(pr, 402, { 'PAYMENT-REQUIRED': encodePaymentRequiredHeader(pr) }); }
      if (url.pathname === '/api/audit') return json(await auditLog(Math.min(50, Number(url.searchParams.get('limit')) || 20)));
      if (url.pathname.startsWith('/api/audit/')) return json(await auditByTx(url.pathname.split('/').pop()));
      if (url.pathname === '/api/stats') return json(await stats());
      if (url.pathname === '/api/agent-id') return json(await agentId());
      if (url.pathname === '/api/rubric') return json({ version: RUBRIC_VERSION, sha256: await rubricHash(), system_prompt: SYS });
      if (url.pathname === '/api/info') return json({ network: NET, price: Number(PRICE) / 1e6, asset: CFG.asa, agent_asa: CFG.agent_asa, accounts: CFG.accounts, explorer: Object.fromEntries(Object.entries(CFG.accounts).map(([k, v]) => [k, accUrl(v)])), buyer_url: CFG.buyer_url, setup_txs: CFG.txs, limits: LIMITS, disclosure: DISCLOSURE });
      if (url.pathname === '/health') return json({ ok: true });
    } catch (e) { return json({ error: String(e?.message || e).slice(0, 500) }, 500); }
    return env.ASSETS.fetch(request);
  },
};
