
import algosdk from 'algosdk'; import fs from 'fs';
import { x402Client } from '@x402/core/client';
import { ExactAvmScheme as Server } from '@x402/avm/exact/server';
import { ExactAvmScheme as Fac } from '@x402/avm/exact/facilitator';
import { ExactAvmScheme as Cli } from '@x402/avm/exact/client';
import { toClientAvmSigner, toFacilitatorAvmSigner } from '@x402/avm';
const K = JSON.parse(process.env.ALGO_KEYS); const acc = {}; for (const [k, m] of Object.entries(K)) acc[k] = algosdk.mnemonicToSecretKey(m);
const b64 = a => Buffer.from(a.sk).toString('base64');
const algod = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
const NET = 'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe';
const st = fs.existsSync('state.json') ? JSON.parse(fs.readFileSync('state.json')) : {};
const save = () => fs.writeFileSync('state.json', JSON.stringify(st, null, 1));
async function send(txn, sk) { const s = txn.signTxn(sk); const { txid } = await algod.sendRawTransaction(s).do(); const r = await algosdk.waitForConfirmation(algod, txid, 8); return { txid, round: Number(r.confirmedRound ?? r['confirmed-round']), r }; }
const sp = async () => await algod.getTransactionParams().do();
const addr = a => a.addr.toString();
if (!st.asa) {
  const t = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({ sender: addr(acc.facilitator), total: 10n ** 13n, decimals: 6, assetName: 'MainsMarker Test Credit', unitName: 'MMTC', assetURL: 'https://mainsmarker-algo.sites.tab.bot/#mmtc', defaultFrozen: false, manager: addr(acc.facilitator), suggestedParams: await sp(), note: new TextEncoder().encode('Test credit for the MainsMarker x402 demo on Algorand TestNet. No value. Built by Tab, an AI assistant, for team lead Akshay Wagh.') });
  const r = await send(t, acc.facilitator.sk); st.asa = Number(r.r.assetIndex ?? r.r['asset-index']); st.asa_tx = r.txid; save(); console.log('asa', st.asa, r.txid);
}
for (const who of ['mainsmarker', 'studybuddy']) if (!st['optin_' + who]) {
  const t = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender: addr(acc[who]), receiver: addr(acc[who]), amount: 0, assetIndex: st.asa, suggestedParams: await sp() });
  st['optin_' + who] = (await send(t, acc[who].sk)).txid; save(); console.log('optin', who);
}
if (!st.fund_sb) { const t = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender: addr(acc.facilitator), receiver: addr(acc.studybuddy), amount: 1000n * 10n ** 6n, assetIndex: st.asa, suggestedParams: await sp() }); st.fund_sb = (await send(t, acc.facilitator.sk)).txid; save(); console.log('funded sb'); }
// x402 round trip
const fac = new Fac(toFacilitatorAvmSigner(b64(acc.facilitator)));
const server = new Server();
const price = await server.parsePrice({ amount: '250000', asset: String(st.asa) }, NET);
let req = { scheme: 'exact', network: NET, payTo: addr(acc.mainsmarker), amount: price.amount, asset: price.asset, maxTimeoutSeconds: 300, extra: price.extra || {} };
req = await server.enhancePaymentRequirements(req, { x402Version: 2, scheme: 'exact', network: NET, extra: fac.getExtra(NET) }, []);
console.log('req', JSON.stringify(req));
const cli = new Cli(toClientAvmSigner(b64(acc.studybuddy)));
const p = await cli.createPaymentPayload(2, req);
const payload = { ...p, accepted: req, resource: { url: 'test' } };
const v = await fac.verify(payload, req); console.log('verify', JSON.stringify(v));
if (v.isValid) { const s = await fac.settle(payload, req); console.log('settle', JSON.stringify(s)); st.x402_test = s.transaction; save(); }
