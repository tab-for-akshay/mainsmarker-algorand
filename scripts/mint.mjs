
import algosdk from 'algosdk'; import fs from 'fs'; import crypto from 'crypto';
const K = JSON.parse(process.env.ALGO_KEYS); const mm = algosdk.mnemonicToSecretKey(K.mainsmarker);
const algod = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
const st = JSON.parse(fs.readFileSync('state.json')); const save = () => fs.writeFileSync('state.json', JSON.stringify(st, null, 1));
const send = async (t) => { const { txid } = await algod.sendRawTransaction(t.signTxn(mm.sk)).do(); const r = await algosdk.waitForConfirmation(algod, txid, 8); return { txid, r }; };
const sp = await algod.getTransactionParams().do(); const me = mm.addr.toString();
const mode = process.argv[2];
if (mode === 'mint' && !st.agent_asa) {
  const note = new TextEncoder().encode(JSON.stringify({ standard: 'arc69', description: 'Agent ID for MainsMarker, an accountable UPSC answer-review agent paid over x402. Built by Tab, an AI assistant, for team lead Akshay Wagh.', external_url: process.env.CARD_URL, mime_type: 'application/json', properties: { role: 'agent-id', payTo: me, x402: process.env.X402 } }));
  const t = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({ sender: me, total: 1, decimals: 0, assetName: 'MainsMarker Agent ID', unitName: 'AGENTID', assetURL: process.env.CARD_URL, defaultFrozen: false, manager: me, reserve: me, suggestedParams: sp, note });
  const r = await send(t); st.agent_asa = Number(r.r.assetIndex ?? r.r['asset-index']); st.agent_mint_tx = r.txid; save(); console.log('agent asa', st.agent_asa, r.txid);
}
if (mode === 'pin') {
  const bytes = fs.readFileSync(process.argv[3]); const h = crypto.createHash('sha256').update(bytes).digest('hex');
  const note = new TextEncoder().encode(JSON.stringify({ standard: 'arc69', description: 'Agent ID for MainsMarker. properties.card_sha256 pins the Agent Card served at external_url. Built by Tab, an AI assistant, for team lead Akshay Wagh.', external_url: process.env.CARD_URL, mime_type: 'application/json', properties: { role: 'agent-id', payTo: me, x402: process.env.X402, card_sha256: h } }));
  const t = algosdk.makeAssetConfigTxnWithSuggestedParamsFromObject({ sender: me, assetIndex: st.agent_asa, manager: me, reserve: me, freeze: undefined, clawback: undefined, suggestedParams: sp, note, strictEmptyAddressChecking: false });
  const r = await send(t); st.agent_pin_tx = r.txid; st.card_sha256 = h; save(); console.log('pinned', h, r.txid);
}
