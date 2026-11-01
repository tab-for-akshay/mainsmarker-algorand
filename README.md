# MainsMarker on Algorand — an AI agent you can pay per call over x402, and audit afterwards

Built by Tab, an AI assistant, for team lead Akshay Wagh.

**MainsMarker** reviews UPSC / IFoS Mains answers (score, strengths, gaps, model outline, diagram tip). **StudyBuddy** is Akshay's study agent that buys those reviews. They are two separate services on two different clouds, each with its own Algorand account, and they trade over plain HTTP **x402** on Algorand TestNet:

- StudyBuddy checks MainsMarker's **Agent ID** first: an ARC-69 asset created by the payee whose metadata pins the SHA-256 of the Agent Card it just fetched;
- it pays with the x402 **exact** scheme for AVM: an atomic group with its asset transfer; the facilitator adds a fee-payer transaction and pays all fees (**fee pooling**), so StudyBuddy holds no ALGO for fees;
- MainsMarker anchors an **ARC-2 audit note** for every review (`mainsmarker:j{…}`: input hash, review hash, rubric hash, model, payment tx, payer, score), readable from the indexer by anyone.

| | Link |
|---|---|
| Live demo (seller page; the button calls StudyBuddy) | https://mainsmarker-algo.sites.tab.bot/ |
| StudyBuddy (buyer agent, different cloud) | https://studybuddy-algo.vercel.app/ |
| Agent Card | https://mainsmarker-algo.sites.tab.bot/.well-known/agent-card.json |
| Agent ID asset | https://lora.algokit.io/testnet/asset/775327772 |
| Demo video (≤ 3 min) | https://mainsmarker-algo.sites.tab.bot/demo.mp4 |

## Architecture
```
Browser ─POST /api/buy─▶ StudyBuddy (Vercel, Node)                MainsMarker (Cloudflare Worker)
                         1 GET agent-card.json ─────────────────▶ card
                         2 indexer: Agent ID asset #775327772 (creator = payTo, ARC-69 card_sha256 = card)
                         3 POST /x402/review ───────────────────▶ 402 + PAYMENT-REQUIRED (exact, ASA 775327739, feePayer)
                         4 policy: payTo, asset, price cap, daily budget from the indexer
                         5 sign its axfer in an atomic group (0 fee)
                         6 POST + PAYMENT-SIGNATURE ────────────▶ facilitator: verify, simulate, add fee-payer txn, submit
                                                                  LLM review (cloud or private self-hosted model)
                                                                  ARC-2 audit note (0-ALGO self-payment)
                         7 hash(review) = anchored hash ◀───────── 200 + review + PAYMENT-RESPONSE
```

| Algorand feature | How it is used |
|---|---|
| x402 exact scheme (`@x402/avm`) | Seller, facilitator and buyer all use the official AVM implementation; CAIP-2 `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe` |
| Atomic groups + fee pooling | Gasless buying: the facilitator's fee-payer transaction covers the group's fees (capped at 5000 µAlgo per txn by the scheme) |
| ASA | Price in MMTC (ASA 775327739), a TestNet test credit we created so the demo does not depend on a captcha faucet; any ASA, e.g. USDC (ASA 10458941 on TestNet), works by changing one config value |
| ARC-69 | Agent ID asset #775327772 (total 1) created by the payee; its latest asset-config note pins the Agent Card hash |
| ARC-2 notes | One audit note per review; read back with the indexer's `note-prefix` filter |
| Indexer | Buyer's spending policy and the seller's audit log and stats are computed from chain data, not a database |

Abuse limits on the gasless path: 6 paid reviews per payer per 10 minutes, at most 4 settlements in flight (in worker memory today; a Durable Object in production). Hashes are SHA-256 over canonical JSON (keys sorted recursively, no whitespace).

## Proof on Algorand TestNet
| What | Transaction |
|---|---|
| MMTC test credit created | https://lora.algokit.io/testnet/transaction/J4CC6EBIFW5P65COW65ADKKLB46F46V3KNUYIBY4MUHMIYXY454A |
| Agent ID minted (ARC-69) | https://lora.algokit.io/testnet/transaction/W2BIXFEM6OA4UX3YCO7GPOUSGCMFOEA3XWVYYHV77BECW2WJOUSQ |
| Agent Card hash pinned (ARC-69 update) | https://lora.algokit.io/testnet/transaction/KTIZOTPJPWTAV3QLYYIRJSJ7NKI3PNMIMCMDVZJTDZEKWAZM5ZWA |
| StudyBuddy → MainsMarker x402 payment (gasless) | https://lora.algokit.io/testnet/transaction/JE2T6FRODQWZ6JJDTY74FACHHJJK73K3WTTO67TQM3ELLHMQPJUA |
| …its ARC-2 audit note | https://lora.algokit.io/testnet/transaction/PWLDY77ORO6V7HO5BERUDRV4FHK6VEPMPPVRK6X6JGRTPLQYAI7Q |

Accounts: MainsMarker `HOT2D2KIXUHNU6WJISIJP5VAJM3VIY4LW2ILBJGTRES3UAPHRLHSXD6HIY`, StudyBuddy `2CFROGGGE7OINW4UYE7CPOMUXZUDCP2SRW3MKI367M5RK7QPZIPUTLXK4M`, facilitator / fee payer `LYWBPK4OVJABP7CJGGURIYCVJULVGSQF4X4PMWWI5Q2TSSJETFGHDUPXIQ`.

## Run it
Buy with any TestNet account that has opted in to ASA 775327739 (ask us for test credits, or change the asset):
```
npm i algosdk @x402/avm @x402/core
BUYER_MNEMONIC="your 25 words" node scripts/buy.mjs
```
Deploy your own: `worker/` (Cloudflare Worker, `scripts/build.cjs`), `studybuddy/` (Vercel Node function), `scripts/setup.mjs` (ASA, opt-ins, local x402 round trip), `scripts/mint.mjs` (Agent ID mint and card pin). Keys are injected at deploy time and never committed.

## Impact
UPSC Mains is written, and feedback on answers is slow and costly; many aspirants in India practise with none. An answer-review agent that study apps and tutor bots can pay per call (no accounts, no API keys, no subscriptions), and that leaves a public record of each review, makes feedback cheap and checkable. The same pattern (on-chain Agent ID + gasless x402 + audit notes) fits any paid AI service in India's agentic-commerce stack.

## Path to production
- MainNet: network id `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k`, price in USDC (ASA 31566704), fee-payer key in a KMS with a small daily float.
- Cost per review on MainNet: 3 transactions × 0.001 ALGO (payment group of 2 + audit note) plus inference (≈ €0.001 at provider list prices, approx.). A ₹5–10 price per review covers it.
- Who pays: study apps, coaching platforms and Telegram/WhatsApp tutor bots run buyer agents and bill students in rupees; students never touch crypto.
- Trust: rubric versions published and hashed; per-buyer limits in a Durable Object; a human-graded evaluation set before charging real money.

## Models
Cloud: gpt-oss-120b/20b, Gemini Flash-Lite fallback. **Private mode:** a self-hosted open-weights model (an abliterated Qwen-family 9B) for users who do not want their answers to leave infrastructure we control. The model is written into every audit note.

## Credits and disclosure
Built by Tab, an AI assistant, for team lead Akshay Wagh. Design reviews during the build came from AI critics (Skydive's agent Arden, Fo on wajo.ai, Gemini); see `ROUNDS.md`. TestNet only; MMTC has no value.

MIT licence.
