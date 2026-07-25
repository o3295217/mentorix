# Model specialists — creative/webdev routing evidence

Updated: 2026-07-25. This is opencode routing evidence, not product runtime config.

## Active specialist config

| Agent | Role | Active model | Overlay `agent2.0_gpt56` | Status |
|---|---|---|---|---|
| `creative-director` | Read-only visual concept, screenshot critique, style system, Russian copy | `anthropic/claude-fable-5` | `openai/gpt-5.6-sol`, `variant: high` | Provisional Fable lead from WebDev/Image-to-WebDev/vision/creative signals. |
| `motion-game-consultant` | Read-only motion, micro-interactions, browser games/gamification specs | `anthropic/claude-opus-5` | `openai/gpt-5.6-sol`, `variant: high` | Переведён с Fable на Opus 5 2026-07-25. Fable стоял здесь provisional без бенчмарка; выход роли — текстовый Handoff Brief (reasoning/спека), а не screenshot critique. Opus 5 вдвое дешевле и ведёт на agentic knowledge work. Bake-off Track B не проводился — экспериментально, откат = одна строка в сценарии. |
| `interactive-frontend` | Executor for approved interactive UI specs | `openai/gpt-5.6-sol`, `variant: high` | `openai/gpt-5.6-sol`, `variant: high` | Sol chosen for implementation/coding/design/game official + local evidence. |
| `visual-reviewer` | Independent read-only browser/screenshot visual QA after implementation | `anthropic/claude-sonnet-5` (`variant: high` в anthropic_primary) | `openai/gpt-5.6-sol`, `variant: high` | Переведён с Fable на Sonnet 5 после cost-аудита сессии 2026-07-24 ($18.9/запуск при процедурном чек-лист профиле); Fable — точечная эскалация для первичной приёмки крупных фич по решению lead. |

## Orchestration & chat routing (updated 2026-07-24)

| Agent | Role | Active model | Rationale |
|---|---|---|---|
| `lead` | Primary-оркестратор: декомпозиция, делегирование, приёмка | `anthropic/claude-opus-4-8` | Переведён с Fable по решению владельца 2026-07-24 (свежайший opus в провайдере, ID подтверждён через `opencode models`). Bake-off vs Fable не проводился — экспериментально; откат = одна строка в scenario. |
| `advisor` | Primary-советник для дешёвых обсуждений в чате без оркестрации | `anthropic/claude-sonnet-5`, `variant: high` | Введён 2026-07-24: чат с flagship-моделью не окупается на обсуждениях; большие задачи — переключение на `lead`. |
| `critical-reviewer` | Усиленная read-only приёмка | `anthropic/claude-fable-5`, `variant: max` | Намеренно оставлен на Fable при opus-lead: cross-model независимость ревью (разные семейства — разные слепые зоны). |

## Evidence matrix by niche

| Niche | Top / runner-up / caveat | Routing impact |
|---|---|---|
| Production WebDev | LM Arena WebDev, accessed 2026-07-18: Kimi K3 `1679±17`, Claude Fable 5 `1631±13`, GPT-5.6 Sol xHigh (codex-harness) `1618±13`. Caveat: preliminary arena, harness-specific, human-preference signal; not a deterministic engineering benchmark. | Kimi K3 is a challenger only after provider connection and local bake-off. Fable remains consultant; Sol remains executor. |
| Screenshot / Image-to-WebDev | LM Arena Image-to-WebDev, accessed 2026-07-18: Claude Fable 5 `1627±15`; Claude Opus 4.7 Thinking `1581±12`. | Supports Fable for visual/screenshot critique and creative handoff. |
| Production coding agents | OpenAI official GPT-5.6 page (2026-07-09) claims Sol leads Artificial Analysis Coding Agent Index, Terminal-Bench 2.1 and DeepSWE, plus strong design/frontend/game examples. Artificial Analysis independently lists Fable/Sol/Kimi near the top of intelligence/coding-agent signals. Caveat: OpenAI figures are vendor claims; compare with independent/local evals before broad replacement. | `interactive-frontend` uses `openai/gpt-5.6-sol` high; build/test discipline is mandatory. |
| Anthropic model roles/prices | Anthropic official Claude overview/pricing pages describe Fable/Opus/Sonnet roles and API pricing. Caveat: vendor positioning, not a project-specific benchmark. | Fable is suitable for high-level creative reasoning; do not infer implementation superiority without bake-off. |
| Motion / WebGL / browser-game implementation | No adequate narrow public benchmark found for deterministic RAF loops, cleanup, reduced motion, Canvas/WebGL perf, browser controls and testability. | Local bake-off mandatory. Current Fable consultant + Sol executor split is provisional. |
| Game design / narrative / gamification | Fable top provisional from creative/vision/general preference signals; Sol runner-up because official evidence includes game/frontend/design examples. No hard benchmark. | Use consultant handoff before nontrivial game/gamification work; reviewer required after implementation. |
| Visual/game QA | Claude Fable 5 has the strongest already-connected screenshot/Image-to-WebDev signal in this repo. Gemini 3.1 Pro is a candidate for visual QA due to strong multimodal reputation/signals, but exact opencode provider/model ID is not verified. Sol is runner-up for browser inspect workflows and is used in overlays. External screenshot/game QA harness required. | `visual-reviewer` uses Fable in base and Sol in overlays. Do not configure Gemini until `/connect` + `opencode models <provider>` confirm an exact ID and bake-off passes. |
| Habr | Search on 2026-07-18 yielded no evidence strong/current enough for routing decisions. | Do not cite Habr as support; state absence honestly. |
| Opus 5 vs Fable 5 (общий) | Anthropic official pricing, проверено 2026-07-25: Opus 5 `$5/$25` за 1M in/out против Fable 5 `$10/$50` — ровно 2× дешевле во всех режимах (cache, batch). Artificial Analysis 2026-07-24: Intelligence Index Opus 5 `61` (#1) vs Fable 5 `60`; Coding Agent Index joint #1; AA-Briefcase `1720` vs `1574` Elo. Контр-сигналы: SWE-bench Pro Fable `80.3%` vs Opus 5 `79.2%`; DeepSWE Fable `69.7%` vs Opus 5 `68.8%`; LMArena WebDev и Image-to-WebDev — для Opus 5 данных НЕТ. Anthropic System Card: Opus 5 «not more capable overall than Fable 5». Caveat: Opus 5 вышел 2026-07-24, локальной телеметрии нет, AA имел pre-release доступ. | `motion-game-consultant` → Opus 5 (Fable стоял без доказательств). `creative-director` остаётся на Fable: Image-to-WebDev — единственное измеренное преимущество Fable, у Opus 5 замеров нет. `critical-reviewer` остаётся на Fable: lead уже на Opus 5, одинаковая модель у арбитра и критического ревьюера убивает независимость приёмки. |

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

## Browser QA MCP guardrails

- Active browser QA uses pinned `@playwright/mcp@0.0.78` with isolated/headless profile, image responses enabled and codegen disabled.
- MCP tool permissions are fail-closed: top-level denies the discovered Playwright namespace, and only browser roles get explicit safe allows. Unsafe tools such as `browser_run_code_unsafe`, `browser_evaluate`, upload/drop, full network details and unmatched Playwright tools stay denied.
- Browser roles must remain non-destructive: no credentials/storage state in repo/prompts/results and no production data mutations without an explicitly approved test account.

## Sources / URLs

- LM Arena WebDev, accessed 2026-07-18: https://lmarena.ai/leaderboard/code/webdev
- LM Arena Image-to-WebDev, accessed 2026-07-18: https://lmarena.ai/leaderboard/code/image-to-webdev
- LM Arena overview with image/video leaderboards, accessed 2026-07-18: https://lmarena.ai/leaderboard
- OpenAI GPT-5.6 official release, 2026-07-09: https://openai.com/index/gpt-5-6/
- OpenAI GPT Image 2 model docs, accessed 2026-07-18: https://platform.openai.com/docs/models/gpt-image-2
- Anthropic Claude overview and model links, accessed 2026-07-18: https://www.anthropic.com/claude
- Anthropic API pricing, accessed 2026-07-18: https://www.anthropic.com/pricing#api
- Anthropic API pricing, проверено lead напрямую 2026-07-25: https://platform.claude.com/docs/en/about-claude/pricing
- Artificial Analysis models, accessed 2026-07-18: https://artificialanalysis.ai/models
- SWE-bench Multimodal, accessed 2026-07-18: https://www.swebench.com/multimodal.html
- Recraft API, accessed 2026-07-18: https://www.recraft.ai/api
- Ideogram docs, accessed 2026-07-18: https://docs.ideogram.ai/
- Hyper3D Rodin, accessed 2026-07-18: https://hyper3d.ai/rodin
- Meshy API, accessed 2026-07-18: https://www.meshy.ai/api
