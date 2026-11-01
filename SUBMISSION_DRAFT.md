# MainsMarker on Algorand — submission draft (AlgoBharat, DoraHacks)

Built by Tab, an AI assistant, for team lead Akshay Wagh.

**One line:** an AI answer-review agent for India's UPSC aspirants that other agents pay per call (0.05 TestNet USDC, about ₹4) over x402 on Algorand — gasless through fee pooling, gated by an on-chain Agent ID, and audited with an ARC-2 note per review.

- Live demo: https://mainsmarker-algo.vercel.app/ (mirror: https://mainsmarker-algo.sites.tab.bot/)
- Buyer agent: https://studybuddy-algo.vercel.app/
- Code: https://github.com/tab-for-akshay/mainsmarker-algorand (MIT)
- Demo video (2:39): https://mainsmarker-algo.vercel.app/demo.mp4
- Explorer (v3, 0.05 TestNet USDC): payment https://lora.algokit.io/testnet/transaction/WPLSTXSVTGCMGYP72JMRF2QLILBK5MDHSKPB5D4J2UKAAPVIFDCQ · audit note https://lora.algokit.io/testnet/transaction/4QIWXVKYKOKQECIAEJADI36GXLBQSMMF4TD2XIMESEFIRKUKN3YA · buyer receipt https://lora.algokit.io/testnet/transaction/4KDK6KD2VPOFURHW6I3JCFMHQ4DMNOPNVYL7TZO3DFGN32FCY3VA · refund demo https://lora.algokit.io/testnet/transaction/XR2VPQUN3ZOLJRFOXUCGUII4PZPOGL3MQGDPNU6ZO77E7X6WEN7A · Agent ID https://lora.algokit.io/testnet/asset/775327772

## Judging criteria → how we meet it
(The AlgoBharat page lists the theme — AI, agentic commerce, x402, payments — rather than a scored rubric; these are the dimensions we built against.)

| Criterion | How we meet it |
|---|---|
| Technical use of Algorand | Official `@x402/avm` exact scheme (seller, facilitator, buyer); atomic groups with fee pooling; USDC (ASA 10458941) pricing; ARC-69 Agent ID; ARC-2 audit notes, buyer receipts and refund notes; indexer-based policy, audit log and a browser-side verifier |
| x402 / agentic payments | Two independent agents on two clouds trade over HTTP 402; the buyer applies a spending policy and verifies identity before paying; a 60-line CLI lets any account buy |
| Innovation | Pay-per-call AI with an on-chain accountability trail: anyone can prove, from the chain alone, which model and rubric produced a review, for which answer, who paid, and that the buyer received the same review; a tampered review fails |
| Real-world impact (India) | Built for UPSC / IFoS Mains aspirants, whose biggest gap is feedback on written answers; priced at 0.05 USDC (about ₹4) per review |
| Completeness | Live demo on Vercel, open repo with an on-chain test in CI, TestNet transactions, 2:39 video, three review rounds (ROUNDS.md) |

## Status of this submission
Built and live. Not submitted on DoraHacks: the AlgoBharat BUIDL form asks "Kindly provide the name of hackathon you have participated in", "Hackathon Organising University/Community name" and "Your position in hackathon (1st, 2nd, finalist)", and this project did not come from a regional college/community hackathon. It will be submitted only if the team names a real regional event it took part in.
