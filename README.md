# MainsMarker on Algorand — an AI agent you can pay per call over x402, and audit afterwards

Built by Tab, an AI assistant, for team lead Akshay Wagh.

**MainsMarker** reviews UPSC / IFoS Mains answers (score, strengths, gaps, model outline, diagram tip). **StudyBuddy** is Akshay's study agent that buys those reviews. They are two separate services on two different clouds, each with its own Algorand account, and they trade over plain HTTP **x402** on Algorand TestNet:

- StudyBuddy checks MainsMarker's **Agent ID** first: an ARC-69 asset created by the payee whose metadata pins the SHA-256 of the Agent Card it just fetched;
- it pays with the x402 **exact** scheme for AVM: an atomic group with its asset transfer; the facilitator adds a fee-payer transaction and pays all fees (**fee pooling**), so StudyBuddy holds no ALGO for fees;
- MainsMarker anchors an **ARC-2 audit note** for every review (`mainsmarker:j{…}`: input hash, review hash, rubric hash, model, payment tx, payer, score), readable from the indexer by anyone.

| | Link |
|---|---|
| Live demo (seller page; the button calls StudyBuddy) | https://mainsmarker-algo.vercel.app/ |
| Mirror (same code and card bytes) | https://mainsmarker-algo.sites.tab.bot/ |
| StudyBuddy (buyer agent, different cloud) | https://studybuddy-algo.vercel.app/ |
| Agent Card | https://mainsmarker-algo.vercel.app/.well-known/agent-card.json |
| Agent ID asset | https://lora.algokit.io/testnet/asset/775327772 |
| Shareable verify link (opens the verifier pre-filled and checks the chain) | see `VERIFY_LINK.txt` |
| Demo video (2:39) | https://mainsmarker-algo.vercel.app/demo.mp4 |

## New in v3 (after round-2 critics)
- **Priced in real TestNet USDC** (Circle's ASA 10458941), 0.05 USDC per review (about ₹4). StudyBuddy was funded from Circle's public faucet; both agents opted in on-chain. MMTC (ASA 775327739) is retired; its history stays on-chain.
- **Agent card v3** carries the USDC `accepts` block and a `trust` block (who runs the facilitator, what the refund is and is not); its hash is re-pinned on the Agent ID.
- **Trust model section** on the page says plainly what you must trust (the seller to refund; our facilitator) and what you need not (what the seller said: the chain checks it).
- **Buyer disputes on-chain:** if the audit note is missing or its hash differs, StudyBuddy writes a `dispute` note naming the payment.
- **StudyBuddy's daily budget nets out refunds** read from the chain.
- **Verifier works with no purchase:** "Load a real sample" and "Try a tampered review" use a real on-chain review; after a purchase the form is pre-filled with it.
- **Tests + CI:** `node --test tests/verify.test.mjs` checks a real review against TestNet with only the public indexer (review hash, input hash, payment amount, buyer receipt, tamper fails); GitHub Actions runs it on every push.
- **Less drift:** temperature 0 on every model call.
- StudyBuddy's page no longer carries Concordium leftovers.

## New in v2 (after round-1 critics)
- **Demo video** is live (https://mainsmarker-algo.vercel.app/demo.mp4, 2:26): buy, explorer, verify, tamper, refund.
- **Chain-only verifier.** "Verify any review" reads the AlgoNode indexer straight from your browser; MainsMarker's own API is not asked. It checks three things: the review hash, the **input hash** (paste the question and answer: proves the review was produced for that answer), and the **buyer's receipt**.
- **Buyer receipt.** After every purchase StudyBuddy writes its own ARC-2 note from its own account (`studybuddy:j{t:"sb/1", audit, out}`): two independent parties attest the same review hash.
- **"Try a tampered review"** changes the score by 3 and shows the chain refusing it.
- **Refund path, on-chain.** If the review fails after settlement, MainsMarker transfers the 0.25 MMTC back with a refund note naming the payment. "Simulate a reviewer outage" shows it live.
- **Agent card carries the x402 `accepts` block** (scheme, network, asset, amount, payTo, feePayer) and `authentication.schemes: ["x402"]`, so a buyer learns the price without probing; the new card hash is re-pinned on the Agent ID (ARC-69 update tx below).
- **Per-criterion marks** (directive, structure, content, examples, diagram, conclusion); rubric `mm-rubric-2026-11-01b` also tells the model to cite only examples relevant to the question (round 1 caught an irrelevant one).
- **Live streamed steps** (NDJSON) with real timings; stats count only exact-price transfers and subtract refunds.
- **Hosting:** seller on Vercel (public, free), StudyBuddy on a separate Vercel project and account key; sites.tab.bot is a mirror.
- Footer source link fixed (it pointed at the Concordium repo).

## Verify a review yourself
1. Open the shareable link in `VERIFY_LINK.txt` (or paste an audit tx id and a review JSON into "Verify any review").
2. Your browser hashes the canonical JSON (keys sorted recursively, no whitespace) with SHA-256 and compares it with `out` in the ARC-2 note of the audit tx, read from `https://testnet-idx.algonode.cloud`.
3. With the question and answer filled in, it also checks `in` = SHA-256 of canonical `{question, answer}`.
4. It then looks for StudyBuddy's receipt note naming that audit tx and checks it carries the same hash.

## Architecture
```
Browser ─POST /api/buy─▶ StudyBuddy (Vercel, Node)                MainsMarker (Vercel, Node)    
                         1 GET agent-card.json ─────────────────▶ card
                         2 indexer: Agent ID asset #775327772 (creator = payTo, ARC-69 card_sha256 = card)
                         3 POST /x402/review ───────────────────▶ 402 + PAYMENT-REQUIRED (exact, USDC ASA 10458941, feePayer)
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
| v2: Agent Card v2 hash re-pinned (ARC-69 update) | https://lora.algokit.io/testnet/transaction/UJTJNH54UMD2JXPEM7XO44KFVTA5MSMI73AQH55CM3YCJFZTNW3Q |
| v2: x402 payment (gasless) | https://lora.algokit.io/testnet/transaction/BCMMISY5BU5Z7EFL67CVTUUVHT53X32BP66C3FJD7EENPBVU72RQ |
| v2: …its ARC-2 audit note | https://lora.algokit.io/testnet/transaction/IONJUAXPMAVBH5ZMD4ZQ7IJQRU5YWSM2W7WVIKKNVGWR73RBD5HQ |
| v2: …StudyBuddy's own receipt note | https://lora.algokit.io/testnet/transaction/4QYZBEN34AMLLVRMEPIVWT3FIRCDTEXKAD3S63UIMYEBBTUOZ7IQ |
| v2 refund demo: payment | https://lora.algokit.io/testnet/transaction/ZR2Z6Y4DWDX6DA7SHYGMPE5WOUNEIXNJHWSXVCMBRCZVKA54RKEA |
| v2 refund demo: refund (0.25 MMTC back, note names the payment) | https://lora.algokit.io/testnet/transaction/EHXUM5TGDJ36DL7N5NZIHOQHHU6EVM3VT76MZXBUPYDU47VFI23A |
| v3: USDC from Circle's faucet to StudyBuddy | https://lora.algokit.io/testnet/transaction/J7V7PWPATER3HIEQ4K3SGEPIUJUW6OQNFVKM7HEBP5HE6G5BNOGQ |
| v3: USDC opt-ins (MainsMarker, StudyBuddy) | https://lora.algokit.io/testnet/transaction/EVTCBLTAEGH5CY57MU2FF6JWYZUX557RDLIUJPBAYTWJEVLNY2JQ · https://lora.algokit.io/testnet/transaction/UHVCLHL77LWKZLL6G3WLXLBO3AO3ZIVL2XP3PROECMIYEM5BFOUA |
| v3: Agent Card v3 hash re-pinned | https://lora.algokit.io/testnet/transaction/QLP3GPIGRAZOIQBQBCLXGV4DEVVGHK4YHPJONCLIB325LLACG3UA |
| v3: x402 payment, 0.05 USDC (gasless) | https://lora.algokit.io/testnet/transaction/WPLSTXSVTGCMGYP72JMRF2QLILBK5MDHSKPB5D4J2UKAAPVIFDCQ |
| v3: …its ARC-2 audit note | https://lora.algokit.io/testnet/transaction/4QIWXVKYKOKQECIAEJADI36GXLBQSMMF4TD2XIMESEFIRKUKN3YA |
| v3: …StudyBuddy's receipt note | https://lora.algokit.io/testnet/transaction/4KDK6KD2VPOFURHW6I3JCFMHQ4DMNOPNVYL7TZO3DFGN32FCY3VA |
| v3 refund demo: payment | https://lora.algokit.io/testnet/transaction/BYABTVK3HOD4TPZXA4L6B6LRF3PATD6ZJG6UXXQHZOB2K4QWSQPA |
| v3 refund demo: refund (0.05 USDC back) | https://lora.algokit.io/testnet/transaction/XR2VPQUN3ZOLJRFOXUCGUII4PZPOGL3MQGDPNU6ZO77E7X6WEN7A |

Accounts: MainsMarker `HOT2D2KIXUHNU6WJISIJP5VAJM3VIY4LW2ILBJGTRES3UAPHRLHSXD6HIY`, StudyBuddy `2CFROGGGE7OINW4UYE7CPOMUXZUDCP2SRW3MKI367M5RK7QPZIPUTLXK4M`, facilitator / fee payer `LYWBPK4OVJABP7CJGGURIYCVJULVGSQF4X4PMWWI5Q2TSSJETFGHDUPXIQ`.

## Run it
Buy with any TestNet account that has opted in to USDC (ASA 10458941) and holds 0.05 USDC (Circle's public faucet at faucet.circle.com sends 20 TestNet USDC on Algorand; no ALGO needed for fees):
```
npm i algosdk @x402/avm @x402/core
BUYER_MNEMONIC="your 25 words" node scripts/buy.mjs
```
Test: `node --test tests/verify.test.mjs` (checks a real review on TestNet).
Deploy your own: `worker/` (Vercel Node function or Cloudflare Worker, `scripts/build.cjs`), `studybuddy/` (Vercel Node function), `scripts/setup.mjs` (ASA, opt-ins, local x402 round trip), `scripts/mint.mjs` (Agent ID mint and card pin). Keys are injected at deploy time and never committed.

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
