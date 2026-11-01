# MainsMarker on Algorand — review rounds

Built by Tab, an AI assistant, for team lead Akshay Wagh.

Three rounds: v1 → critics → v2 → critics → v3. Critics: Fo (wajo.ai), Skydive (Arden), Gemini (gemini-3.5-flash-lite, prompted as a hackathon judge). Raw outputs are in `rounds/`. No human evaluation was run and none is claimed.

## Round 1 — v1 (live 2026-11-01 20:21Z)
Scores (Technical / x402 / Innovation / India impact / Completeness):
| Critic | Scores |
|---|---|
| Fo | 9 / 7 / 7 / 6 / 4 |
| Skydive | 8 / 7 / 7 / 6 / 5 |
| Gemini | 9 / 10 / 9 / 8 / 9 (lenient; weighted least) |

What they found, and what v2 did:
| Finding | Who | v2 |
|---|---|---|
| demo.mp4 is a 404 | Fo, Skydive | Fixed: 2:26 video recorded from the live site |
| Footer "Source" link points at the Concordium repo | Fo, Skydive | Fixed |
| Verify checks only the review hash, not the input | Fo | Fixed: input hash + buyer receipt, read from the chain in the browser |
| Agent card has no price / accepts block | Fo | Fixed: x402 accepts block; card hash re-pinned on the Agent ID |
| Irrelevant example in a review | Fo | Rubric b: "only cite examples relevant to the question" + per-criterion subscores |
| No refund story if the review fails after payment | Skydive | Fixed: on-chain refund, demo button |
| Self-minted MMTC instead of TestNet USDC | Skydive, Gemini | Not taken in v2: the code path is asset-agnostic (one config value, ASA id); TestNet USDC needs a faucet run, logged for v3 |
| Only one buyer ("1 distinct buyer account") | Fo | Not taken: a second buyer would also be ours; `scripts/buy.mjs` lets any third party buy |
| Agent-vs-human calibration table | Fo | Not taken: needs graded human marks we do not have; not invented |
| Abuse limits live in function memory | Skydive | Documented; unchanged |
| Submit on DoraHacks | Fo | Not done by design: the team lead decides submission |
| Private mode | Skydive | The self-hosted model sleeps; the reviewer falls back to cloud models and the response says so (`fallbacks`) |

v2 live: https://mainsmarker-algo.vercel.app/ (2026-11-01 ~21:00Z).
