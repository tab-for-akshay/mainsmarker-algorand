# MainsMarker on Algorand — submission draft (AlgoBharat, DoraHacks)

Built by Tab, an AI assistant, for team lead Akshay Wagh.

**One line:** an AI answer-review agent for India's UPSC aspirants that other agents pay per call over x402 on Algorand — gasless through fee pooling, gated by an on-chain Agent ID, and audited with an ARC-2 note per review.

- Live demo: https://mainsmarker-algo.sites.tab.bot/
- Buyer agent: https://studybuddy-algo.vercel.app/
- Code: https://github.com/tab-for-akshay/mainsmarker-algorand (MIT)
- Demo video (≤ 3 min): https://mainsmarker-algo.sites.tab.bot/demo.mp4
- Explorer: payment https://lora.algokit.io/testnet/transaction/JE2T6FRODQWZ6JJDTY74FACHHJJK73K3WTTO67TQM3ELLHMQPJUA · audit note https://lora.algokit.io/testnet/transaction/PWLDY77ORO6V7HO5BERUDRV4FHK6VEPMPPVRK6X6JGRTPLQYAI7Q · Agent ID https://lora.algokit.io/testnet/asset/775327772

## Judging criteria → how we meet it
(The AlgoBharat page lists the theme — AI, agentic commerce, x402, payments — rather than a scored rubric; these are the dimensions we built against.)

| Criterion | How we meet it |
|---|---|
| Technical use of Algorand | Official `@x402/avm` exact scheme (seller, facilitator, buyer); atomic groups with fee pooling; ASA pricing; ARC-69 Agent ID; ARC-2 audit notes; indexer-based policy and audit log |
| x402 / agentic payments | Two independent agents on two clouds trade over HTTP 402; the buyer applies a spending policy and verifies identity before paying; a 60-line CLI lets any account buy |
| Innovation | Pay-per-call AI with an on-chain accountability trail: anyone can prove which model and rubric produced a review and who paid for it |
| Real-world impact (India) | Built for UPSC / IFoS Mains aspirants, whose biggest gap is feedback on written answers; priced for ₹5–10 per review on MainNet |
| Completeness | Live demo, open repo, TestNet transactions, video, path to production |

## Status of this submission
Built and live. Not submitted on DoraHacks: the AlgoBharat BUIDL form asks "Kindly provide the name of hackathon you have participated in", "Hackathon Organising University/Community name" and "Your position in hackathon (1st, 2nd, finalist)", and this project did not come from a regional college/community hackathon. It will be submitted only if the team names a real regional event it took part in.
