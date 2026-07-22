# Model specialists — creative/webdev routing evidence

Updated: 2026-07-18. This is opencode routing evidence, not product runtime config.

## Active specialist config

| Agent | Role | Active model | Overlay `agent2.0_gpt56` | Status |
|---|---|---|---|---|
| `creative-director` | Read-only visual concept, screenshot critique, style system, Russian copy | `anthropic/claude-fable-5` | `openai/gpt-5.6-sol`, `variant: high` | Provisional Fable lead from WebDev/Image-to-WebDev/vision/creative signals. |
| `motion-game-consultant` | Read-only motion, micro-interactions, browser games/gamification specs | `anthropic/claude-fable-5` | `openai/gpt-5.6-sol`, `variant: high` | Provisional: no adequate narrow motion/WebGL/game benchmark. |
| `interactive-frontend` | Executor for approved interactive UI specs | `openai/gpt-5.6-sol`, `variant: high` | `openai/gpt-5.6-sol`, `variant: high` | Sol chosen for implementation/coding/design/game official + local evidence. |

## Evidence matrix by niche

| Niche | Top / runner-up / caveat | Routing impact |
|---|---|---|
| Production WebDev | LM Arena WebDev, accessed 2026-07-18: Kimi K3 `1679±17`, Claude Fable 5 `1631±13`, GPT-5.6 Sol xHigh (codex-harness) `1618±13`. Caveat: preliminary arena, harness-specific, human-preference signal; not a deterministic engineering benchmark. | Kimi K3 is a challenger only after provider connection and local bake-off. Fable remains consultant; Sol remains executor. |
| Screenshot / Image-to-WebDev | LM Arena Image-to-WebDev, accessed 2026-07-18: Claude Fable 5 `1627±15`; Claude Opus 4.7 Thinking `1581±12`. | Supports Fable for visual/screenshot critique and creative handoff. |
| Production coding agents | OpenAI official GPT-5.6 page (2026-07-09) claims Sol leads Artificial Analysis Coding Agent Index, Terminal-Bench 2.1 and DeepSWE, plus strong design/frontend/game examples. Artificial Analysis independently lists Fable/Sol/Kimi near the top of intelligence/coding-agent signals. Caveat: OpenAI figures are vendor claims; compare with independent/local evals before broad replacement. | `interactive-frontend` uses `openai/gpt-5.6-sol` high; build/test discipline is mandatory. |
| Anthropic model roles/prices | Anthropic official Claude overview/pricing pages describe Fable/Opus/Sonnet roles and API pricing. Caveat: vendor positioning, not a project-specific benchmark. | Fable is suitable for high-level creative reasoning; do not infer implementation superiority without bake-off. |
| Motion / WebGL / browser-game implementation | No adequate narrow public benchmark found for deterministic RAF loops, cleanup, reduced motion, Canvas/WebGL perf, browser controls and testability. | Local bake-off mandatory. Current Fable consultant + Sol executor split is provisional. |
| Game design / narrative / gamification | Fable top provisional from creative/vision/general preference signals; Sol runner-up because official evidence includes game/frontend/design examples. No hard benchmark. | Use consultant handoff before nontrivial game/gamification work; reviewer required after implementation. |
| Visual/game QA | Gemini 3.1 Pro is a candidate for visual QA due to strong multimodal reputation/signals, but exact opencode provider/model ID is not verified. Sol is runner-up for implement-and-inspect workflows. External screenshot/game QA harness required. | Do not configure Gemini until `/connect` + `opencode models <provider>` confirm an exact ID and bake-off passes. |
| Habr | Search on 2026-07-18 yielded no evidence strong/current enough for routing decisions. | Do not cite Habr as support; state absence honestly. |

## External asset leaders — tools/MCP/API candidates, not active agents

These are not configured as opencode agents/providers/MCP in this repo. IDs, API availability, licensing, data retention and commercial rights must be verified before any integration.

| Category | Top / runner-up | Notes |
|---|---|---|
| Image generation/editing | GPT Image 2 / Recraft | GPT Image 2 is an OpenAI image model/API option; Recraft is strong for production visual workflows. |
| Vectors / brand assets | Recraft / Ideogram | Recraft API supports images + vectors; Ideogram emphasizes typography, logos, API and MCP. |
| Video | Gemini Omni Flash / Seedance | LM Arena video signals favor these; use as external asset tools only. |
| 3D | Rodin / Meshy | Both expose 3D generation/API-oriented workflows; verify licensing and asset retention. |

## Connection and replacement workflow

1. Use `/connect` to add/authorize the provider.
2. Run `opencode models <provider>` and copy only an exact returned model ID.
3. Never guess provider names or unsupported model IDs in active config.
4. Add a temporary overlay only after ID confirmation.
5. Run `.opencode/evals/creative-specialists.md` bake-off with cost/time/token tracking.
6. Replace a persistent agent only after passing hard gates and reviewer-accepted real project work.

## Sources / URLs

- LM Arena WebDev, accessed 2026-07-18: https://lmarena.ai/leaderboard/code/webdev
- LM Arena Image-to-WebDev, accessed 2026-07-18: https://lmarena.ai/leaderboard/code/image-to-webdev
- LM Arena overview with image/video leaderboards, accessed 2026-07-18: https://lmarena.ai/leaderboard
- OpenAI GPT-5.6 official release, 2026-07-09: https://openai.com/index/gpt-5-6/
- OpenAI GPT Image 2 model docs, accessed 2026-07-18: https://platform.openai.com/docs/models/gpt-image-2
- Anthropic Claude overview and model links, accessed 2026-07-18: https://www.anthropic.com/claude
- Anthropic API pricing, accessed 2026-07-18: https://www.anthropic.com/pricing#api
- Artificial Analysis models, accessed 2026-07-18: https://artificialanalysis.ai/models
- SWE-bench Multimodal, accessed 2026-07-18: https://www.swebench.com/multimodal.html
- Recraft API, accessed 2026-07-18: https://www.recraft.ai/api
- Ideogram docs, accessed 2026-07-18: https://docs.ideogram.ai/
- Hyper3D Rodin, accessed 2026-07-18: https://hyper3d.ai/rodin
- Meshy API, accessed 2026-07-18: https://www.meshy.ai/api
