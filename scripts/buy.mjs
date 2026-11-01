#!/usr/bin/env node
// Standalone x402 buyer for MainsMarker on Algorand TestNet — any account opted in to TestNet USDC (ASA 10458941) can buy.
// Built by Tab, an AI assistant, for team lead Akshay Wagh.
//   npm i algosdk @x402/avm @x402/core
//   BUYER_MNEMONIC="25 words" node scripts/buy.mjs [seller-url]
import algosdk from 'algosdk'; import { createHash } from 'node:crypto';
import { ExactAvmScheme } from '@x402/avm/exact/client'; import { toClientAvmSigner } from '@x402/avm';
import { decodePaymentRequiredHeader, encodePaymentSignatureHeader, decodePaymentResponseHeader } from '@x402/core/http';
const SELLER = (process.argv[2] || 'https://mainsmarker-algo.vercel.app').replace(/\/$/, ''); const IDX = 'https://testnet-idx.algonode.cloud';
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : (v && typeof v === 'object') ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const sha = b => createHash('sha256').update(b).digest('hex'); const log = (k, v) => console.log(k.padEnd(10), v);
const bytes = Buffer.from(await (await fetch(SELLER + '/.well-known/agent-card.json')).arrayBuffer()); const card = JSON.parse(bytes);
const p = card.capabilities.extensions.find(e => /algorand-agent-id/.test(e.uri)).params;
const a = await (await fetch(`${IDX}/v2/assets/${p.agent_asa}`)).json(); const cf = await (await fetch(`${IDX}/v2/assets/${p.agent_asa}/transactions?tx-type=acfg`)).json();
const meta = (cf.transactions || []).sort((x, y) => y['confirmed-round'] - x['confirmed-round']).map(t => { try { return JSON.parse(Buffer.from(t.note, 'base64')) } catch { return null } }).find(Boolean);
if (a.asset.params.creator !== p.payTo || meta?.properties?.card_sha256 !== sha(bytes)) { log('agent id', 'check FAILED — refusing to pay'); process.exit(2); }
log('agent id', `asset #${p.agent_asa}: creator = payTo, pinned card hash = served card`);
const body = JSON.stringify({ question: process.env.QUESTION || 'Explain the significance of the Western Ghats as a biodiversity hotspot.', answer: process.env.ANSWER || 'The Western Ghats run parallel to the west coast of India for about 1,600 km. They are a biodiversity hotspot because of high endemism and high threat. They feed peninsular rivers and shape the monsoon. Threats include mining, plantations and dams; the Gadgil and Kasturirangan reports proposed eco-sensitive zones.', marks: 10 });
const r1 = await fetch(SELLER + '/x402/review', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
const pr = decodePaymentRequiredHeader(r1.headers.get('PAYMENT-REQUIRED')); const req = pr.accepts[0];
if (req.payTo !== p.payTo) { log('policy', 'payTo differs from Agent ID — refusing'); process.exit(3); }
log('402', `${Number(req.amount) / 1e6} of ASA ${req.asset} to ${req.payTo}; fee payer ${req.extra.feePayer}`);
const sk = algosdk.mnemonicToSecretKey(process.env.BUYER_MNEMONIC).sk;
const pp = await new ExactAvmScheme(toClientAvmSigner(Buffer.from(sk).toString('base64'))).createPaymentPayload(2, req);
const r2 = await fetch(SELLER + '/x402/review', { method: 'POST', headers: { 'content-type': 'application/json', 'PAYMENT-SIGNATURE': encodePaymentSignatureHeader({ ...pp, accepted: req, resource: pr.resource }) }, body });
const res = await r2.json(); if (r2.status !== 200) { log('paid', `${r2.status} ${res.error}`); process.exit(4); }
const pay = decodePaymentResponseHeader(r2.headers.get('PAYMENT-RESPONSE'));
log('settled', 'https://lora.algokit.io/testnet/transaction/' + pay.transaction);
log('review', `${res.review.score}/${res.review.max} by ${res.model}`);
log('audit', 'https://lora.algokit.io/testnet/transaction/' + res.audit.tx);
log('hash', sha(canon(res.review)) === res.review_sha256 ? 'my hash of the review = anchored hash' : 'MISMATCH');
