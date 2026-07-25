# Creative/motion/frontend specialist bake-off plan

Purpose: compare active specialists and challengers before replacing any persistent agent model. This is a reproducible manual/project eval design. Browser visual QA now uses the executable pinned Playwright MCP harness from `opencode.json`; this file does not add extra executable tooling.

## Candidates and role slots

- `creative-director` slot: current `anthropic/claude-fable-5`; challengers compete only as creative-director consultants.
- `motion-game-consultant` slot: current `anthropic/claude-fable-5`; challengers compete only as motion/game consultants.
- `interactive-frontend` slot: current `openai/gpt-5.6-sol`, `variant: high`; challengers compete only as executors on fixed approved handoffs.
- `visual-reviewer` slot: current `anthropic/claude-fable-5`; overlay `openai/gpt-5.6-sol`, `variant: high`; challengers compete only as read-only browser/screenshot QA after implementation.
- Kimi K3 or Gemini candidates enter only after `/connect` and `opencode models <provider>` confirm the exact local ID.

## Reproducibility protocol

- Pin repo SHA before every bake-off and record it in the run sheet.
- Use the same prompt text, attachments/screenshots, agent permissions, budget, timeout, scenario overlay and allowed tools for every candidate in the same role slot.
- Run each task exactly 3 times per candidate; randomize anonymized output IDs before scoring.
- Record model ID, variant, date, wall-clock time, prompt/completion tokens, estimated cost and any permission/check failures.
- Do not mix roles: consultants never edit code; executor runs only on fixed approved Handoff Briefs.
- Visual QA candidates never edit code, never delegate and never run bash; they must use the same URL, auth approach, pages/states/viewports and browser/screenshot evidence protocol.
- Use pinned isolated Playwright MCP (`@playwright/mcp@0.0.78`, headless, image responses allow, codegen none) and the same safe tool allow-list. Unsafe MCP tools remain denied during evals.

## Track A — `creative-director` Handoff Briefs only

Output must be only a concise creative Handoff Brief; no code, diff, reviewer verdict or implementation steps.

1. Landing hero visual direction for mentorix with dark theme, trust, calm focus and Russian tone.
2. Screenshot critique and redesign handoff for a dense analytics dashboard screenshot.
3. Empty/loading/error/success/focus/disabled state direction for goal planning cards.
4. Russian onboarding and microcopy direction for first-week activation.

Hard gates:
- emits code/diff or attempts to act as executor/reviewer;
- missing Russian product tone or mentorix context;
- missing Handoff Brief sections: Task/context, Outcome, Scope, States, Motion, A11y, Technical constraints, Acceptance, Reviewer focus;
- proposes unsupported providers/MCP/dependencies as active implementation.

Replacement threshold: challenger passes all hard gates, wins at least 3 of 4 tasks across repeated blind runs, improves average score by ≥10% or cost/time by ≥25% with no quality loss, and survives one real project consultant task.

## Track B — `motion-game-consultant` Handoff Briefs only

Output must be only a concise motion/game Handoff Brief; no code, diff, reviewer verdict or implementation steps.

1. Daily-planning completion celebration with exact states, timing/easing and reduced-motion fallback.
2. Goal timeline drilldown interaction spec with keyboard/touch controls and state machine.
3. Habit streak recovery browser mini-game spec with deterministic loop, pause/resume/reset and test matrix.
4. Canvas/WebGL decision brief for a lightweight progress visualization, including when CSS/SVG is sufficient.

Hard gates:
- emits code/diff or attempts to act as executor/reviewer;
- missing reduced-motion/a11y coverage;
- missing deterministic loop or cleanup plan for timers/RAF/listeners where relevant;
- fails to specify states/events/transitions and reviewer focus;
- recommends dependencies or Canvas/WebGL without justification.

Replacement threshold: challenger passes all hard gates, wins at least 3 of 4 tasks across repeated blind runs, improves average score by ≥10% or cost/time by ≥25% with no quality loss, and survives one real project consultant task.

## Track C — `interactive-frontend` fixed-handoff implementation

Executor receives fixed approved Handoff Briefs from Track A/B fixtures and must produce code only within allowed frontend paths. Every run must include `npm run typecheck`, `npm run lint`, `npm run test`; `npm run build` is required for substantial UI/motion/game or build-affecting changes. Independent `visual-reviewer` and `reviewer` evaluate every substantial executor output.

1. Implement approved empty/loading/error/success/focus states for one existing card component.
2. Implement approved CSS/WAAPI-first completion micro-interaction with reduced-motion fallback.
3. Implement approved keyboard/touch accessible timeline drilldown interaction in a constrained component fixture.
4. Implement approved deterministic mini-game/progress-loop fixture with RAF/timer/listener cleanup.

Hard gates:
- modifies backend/API/Prisma/lib/dependencies or other paths outside the approved frontend/test scope;
- omits mandatory checks or ships failing checks caused by its changes;
- misses reduced-motion/a11y requirements;
- leaks timers/RAF/listeners/observers or creates non-deterministic game-loop behavior;
- violates Russian UI text or project frontend patterns.

Replacement threshold: challenger passes all hard gates, wins at least 3 of 4 tasks across repeated blind runs, receives `VERDICT: ACCEPT` from independent visual-reviewer and reviewer on executor outputs, and demonstrates equal-or-better check pass rate plus ≥10% average quality improvement or ≥25% cost/time reduction with no quality loss.

## Track D — `visual-reviewer` browser/screenshot QA only

Output must start with exactly `VERDICT: ACCEPT` or `VERDICT: REWORK`; no code, diff, implementation advice beyond blockers, or author-report reasoning. Candidate receives the same task/Handoff Brief, acceptance, URL, pages/states/viewports, changed files and checks, without the executor report.

1. Visual QA of a dark-theme landing/hero change across desktop and mobile.
2. Visual QA of dense analytics/dashboard states with overflow and contrast risks.
3. Visual QA of form focus/disabled/error/success states with keyboard/a11y snapshot.
4. Visual QA of a motion/interaction fixture with console and reduced-motion concerns.

Hard gates:
- accepts without opening the real URL through Playwright MCP/browser;
- omits desktop or mobile viewport, key states, dark theme, overflow, focus/keyboard/a11y snapshot or console checks;
- no screenshot evidence/reference when the browser harness can provide it;
- accepts when browser/MCP/URL/auth is unavailable instead of fail-closed `REWORK`;
- logs in with unknown secrets, stores credentials/storage state, edits code, delegates or runs bash.

Replacement threshold: challenger passes all hard gates, wins at least 3 of 4 tasks across repeated blind runs, catches seeded visual/a11y/overflow/runtime blockers at equal-or-better rate, and does not increase false accepts.

## Blind scoring rubric

Score each anonymized output 1–5; reveal model names only after scoring.

- Role fidelity and boundary discipline.
- Product fit, Russian tone and mentorix dark-theme consistency.
- Implementation readiness for consultant handoffs; implementation correctness for executor outputs.
- Browser/screenshot evidence quality and fail-closed discipline for visual-reviewer outputs.
- A11y/reduced-motion coverage.
- Technical correctness: cleanup, deterministic loops, CSS/WAAPI-first reasoning and performance awareness.
- Testability: concrete acceptance, reviewer focus and checks.
- Concision: enough detail without excessive tokens.

Any hard-gate failure blocks replacement regardless of score.
