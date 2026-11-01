// StudyBuddy (Algorand) — buyer agent: checks the seller's Agent ID on-chain, applies its policy, pays over x402 (gasless).
// Built by Tab, an AI assistant, for team lead Akshay Wagh.
import algosdk from 'algosdk';
import { ExactAvmScheme as AvmClient } from '@x402/avm/exact/client';
import { toClientAvmSigner } from '@x402/avm';
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader, decodePaymentResponseHeader } from '@x402/core/http';
const CFG = __CFG__;
const IDX = 'https://testnet-idx.algonode.cloud', EXPLORER = 'https://lora.algokit.io/testnet';
const ME = CFG.accounts.studybuddy; const DEFAULT_SELLER = 'https://mainsmarker-algo.vercel.app'; const ALLOWED_SELLERS = [DEFAULT_SELLER, 'https://mainsmarker-algo.sites.tab.bot']; // same seller: public cloud + mirror, same card bytes
const POLICY = { max_price_mmtc: 1, daily_budget_mmtc: 10, max_calls_per_hour: 30 };
const DISCLOSURE = 'Built by Tab, an AI assistant, for team lead Akshay Wagh.';
const enc = new TextEncoder(); const now = () => Date.now();
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', typeof s === 'string' ? enc.encode(s) : s))].map(b => b.toString(16).padStart(2, '0')).join('');
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : (v && typeof v === 'object') ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const json = (o, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } });
const txUrl = h => `${EXPLORER}/transaction/${h}`;
async function purchases(hours = 24) {
  const after = new Date(now() - hours * 36e5).toISOString();
  const j = await (await fetch(`${IDX}/v2/accounts/${ME}/transactions?asset-id=${CFG.asa}&tx-type=axfer&after-time=${after}&limit=500`)).json();
  return (j.transactions || []).filter(t => t.sender === ME && t['asset-transfer-transaction']?.receiver !== ME && t['asset-transfer-transaction']?.amount > 0).map(t => ({ tx: t.id, at: new Date(t['round-time'] * 1000).toISOString(), to: t['asset-transfer-transaction'].receiver, amount: t['asset-transfer-transaction'].amount / 1e6, fee_paid_by_buyer: t.fee / 1e6, explorer: txUrl(t.id) }));
}
async function anchorReceipt(auditTx, out) {
  const sk = algosdk.mnemonicToSecretKey(process.env.SB_MNEMONIC).sk; const c = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', ''); const sp = await c.getTransactionParams().do();
  const t = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: ME, receiver: ME, amount: 0, note: enc.encode('studybuddy:j' + JSON.stringify({ t: 'sb/1', audit: auditTx, out })), suggestedParams: sp });
  const { txid } = await c.sendRawTransaction(t.signTxn(sk)).do(); return txid;
}
async function buy(body, onStep) {
  const steps = []; const T0 = now(); const step = (name, detail, x = {}) => { const st = { t_ms: now() - T0, name, detail, ...x }; steps.push(st); if (onStep) try { onStep(st); } catch {} };
  const SELLER = String(body.seller || DEFAULT_SELLER).replace(/\/$/, '');
  if (!ALLOWED_SELLERS.includes(SELLER)) { step('Discover', `Seller ${SELLER} is not on StudyBuddy's allow-list.`, { ok: false }); return { ok: false, steps }; }
  const cardRes = await fetch(SELLER + '/.well-known/agent-card.json'); const cardBytes = new Uint8Array(await cardRes.arrayBuffer()); const card = JSON.parse(new TextDecoder().decode(cardBytes));
  const ext = card.capabilities.extensions.find(e => /algorand-agent-id/.test(e.uri)); const p = ext.params;
  step('Discover', `Fetched ${card.name}'s Agent Card (HTTP ${cardRes.status}); Agent ID asset #${p.agent_asa}, payTo ${p.payTo.slice(0, 8)}….`);
  const [a, cf] = await Promise.all([fetch(`${IDX}/v2/assets/${p.agent_asa}`).then(r => r.json()), fetch(`${IDX}/v2/assets/${p.agent_asa}/transactions?tx-type=acfg&limit=20`).then(r => r.json())]);
  const ap = a.asset?.params || {}; let meta = null;
  for (const t of (cf.transactions || []).sort((x, y) => y['confirmed-round'] - x['confirmed-round'])) { try { meta = JSON.parse(atob(t.note)); break; } catch {} }
  const cardHash = await sha(cardBytes);
  const ok = ap.creator === p.payTo && ap.total === 1 && meta?.properties?.card_sha256 === cardHash;
  step('Verify agent ID', ok ? `On-chain: asset #${p.agent_asa} was created by the payee ${p.payTo.slice(0, 8)}…, and its ARC-69 metadata pins card hash ${cardHash.slice(0, 12)}… = the card we fetched.` : 'Agent ID check failed — StudyBuddy refuses to pay.', { ok, creator: ap.creator, pinned: meta?.properties?.card_sha256, fetched: cardHash });
  if (!ok) return { ok: false, steps };
  const payloadBody = JSON.stringify({ question: body.question, answer: body.answer, marks: body.marks, mode: body.mode, ...(body.simulate === 'reviewer_outage' ? { simulate: 'reviewer_outage' } : {}) });
  const r1 = await fetch(SELLER + '/x402/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payloadBody });
  if (r1.status !== 402) { step('402 Payment Required', 'Unexpected ' + r1.status, { ok: false }); return { ok: false, steps }; }
  const pr = decodePaymentRequiredHeader(r1.headers.get('PAYMENT-REQUIRED')); const req = pr.accepts.find(x => x.network === CFG.network); const price = Number(req.amount) / 1e6;
  step('402 Payment Required', `HTTP 402: ${price} of ASA ${req.asset} to ${req.payTo.slice(0, 8)}…; fee payer ${String(req.extra?.feePayer || '').slice(0, 8)}….`, { requirements: req });
  const day = await purchases(24); const spent = day.reduce((s, x) => s + x.amount, 0); const lastHour = day.filter(x => Date.parse(x.at) > now() - 36e5).length;
  const why = req.payTo !== p.payTo ? 'payTo differs from the verified Agent ID' : String(req.asset) !== String(CFG.asa) ? 'unexpected asset' : price > POLICY.max_price_mmtc ? 'price over cap' : spent + price > POLICY.daily_budget_mmtc ? `daily budget would be exceeded (spent ${spent})` : lastHour >= POLICY.max_calls_per_hour ? 'hourly cap reached' : null;
  step('Check policy', why ? 'Refused: ' + why : `payTo = verified Agent ID's creator; ${price} ≤ ${POLICY.max_price_mmtc} MMTC cap; spent today ${spent.toFixed(2)} of ${POLICY.daily_budget_mmtc} MMTC (read from the indexer).`, { ok: !why });
  if (why) return { ok: false, steps };
  const sk = algosdk.mnemonicToSecretKey(process.env.SB_MNEMONIC).sk;
  const client = new AvmClient(toClientAvmSigner(Buffer.from(sk).toString('base64')));
  const pp = await client.createPaymentPayload(2, req);
  step('Sign payment', 'StudyBuddy signed its asset transfer inside an atomic group; the fee-payer transaction is left for the facilitator, so StudyBuddy pays 0 ALGO in fees.');
  const r2 = await fetch(SELLER + '/x402/review', { method: 'POST', headers: { 'content-type': 'application/json', 'PAYMENT-SIGNATURE': encodePaymentSignatureHeader({ ...pp, accepted: req, resource: pr.resource }) }, body: payloadBody });
  const res = await r2.json();
  if (r2.status !== 200 && res.refund && res.refund.tx) { step('Settled', `Paid ${price} MMTC (payment tx below), but the seller could not deliver: ${res.reason || res.error}.`, { tx: res.payment && res.payment.transaction, explorer: res.payment && res.payment.explorer, ok: true }); step('Refunded', `MainsMarker sent the ${price} MMTC back on-chain with a refund note naming the payment. StudyBuddy's budget is whole again.`, { tx: res.refund.tx, explorer: res.refund.explorer, ok: true }); return { ok: false, refunded: true, refund: res.refund, payment: res.payment, steps }; }
  if (r2.status !== 200) { step('Settled', 'Seller rejected: ' + (res.error || r2.status), { ok: false }); return { ok: false, steps }; }
  const pay = decodePaymentResponseHeader(r2.headers.get('PAYMENT-RESPONSE'));
  step('Settled', `Facilitator verified and simulated the group, added its fee payment and submitted it; confirmed in ${(res.timings_ms.settle / 1000).toFixed(1)} s.`, { tx: pay.transaction, explorer: txUrl(pay.transaction) });
  step('Reviewed', `${res.model} marked the answer ${res.review.score}/${res.review.max} in ${(res.timings_ms.review / 1000).toFixed(1)} s.`);
  const got = await sha(canon(res.review));
  step('Logged on-chain', res.audit.tx ? `MainsMarker wrote an ARC-2 audit note. StudyBuddy's own hash of the review: ${got.slice(0, 12)}… ${got === res.review_sha256 ? '= the anchored hash' : '≠ anchored hash!'}` : 'Audit write failed: ' + res.audit.error, { tx: res.audit.tx, explorer: res.audit.explorer, ok: !!res.audit.tx && got === res.review_sha256 });
  if (res.audit.tx) { try { const rt = await anchorReceipt(res.audit.tx, got); step('Buyer receipt', 'StudyBuddy wrote its own receipt note from its own account: the hash of the review it received + the seller\'s audit tx. Two independent parties now attest the same review.', { tx: rt, explorer: txUrl(rt), ok: true }); } catch (e) { step('Buyer receipt', 'Receipt not written: ' + String(e.message || e).slice(0, 120), { ok: false }); } }
  return { ok: true, steps, result: res };
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    try {
      if (url.pathname === '/api/buy' && request.method === 'POST' && url.searchParams.get('stream') === '1') {
        const body = await request.json().catch(() => ({})); const te = new TextEncoder();
        const rs = new ReadableStream({ async start(c) { const send = o => c.enqueue(te.encode(JSON.stringify(o) + '\n'));
          try { const r = await buy(body, st => send({ step: st })); send({ done: true, ...r }); } catch (e) { send({ done: true, ok: false, error: String(e?.message || e).slice(0, 300) }); } c.close(); } });
        return new Response(rs, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' } });
      }
      if (url.pathname === '/api/buy' && request.method === 'POST') return json(await buy(await request.json().catch(() => ({}))));
      if (url.pathname === '/api/receipts') return json(await purchases(24 * 30));
      if (url.pathname === '/api/status') { const acc = await (await fetch(`${IDX}/v2/accounts/${ME}`)).json(); const bal = (acc.account?.assets || []).find(x => x['asset-id'] === CFG.asa); const day = await purchases(24);
        return json({ agent: 'StudyBuddy (Algorand)', account: ME, algo: (acc.account?.amount || 0) / 1e6, mmtc: (bal?.amount || 0) / 1e6, policy: POLICY, spent_today_mmtc: day.reduce((s, x) => s + x.amount, 0), runtime: 'vercel-node ' + process.versions.node, explorer: `${EXPLORER}/account/${ME}`, disclosure: DISCLOSURE }); }
      if (url.pathname === '/api/health') return json({ ok: true });
    } catch (e) { return json({ ok: false, error: String(e?.message || e).slice(0, 400) }, 500); }
    return json({ error: 'not found' }, 404);
  },
};
