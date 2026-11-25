# Agent guide: Vesper

Vesper is a free, open-source (GPL-3.0) Android app blocker, with a companion "Kids" app for parent → child control.

**Before you write code, read:**
1. `docs/IMPLEMENTATION_PLAN.md`: decisions, module map, workflow, definition of done, conventions.
2. `docs/design/V5_SPEC.md` and `design/Stay Focused v5.dc.html`: screens, behaviour, design tokens (high fidelity, copy is final).
   `design_handoff_stay_focused_phase1/` is the superseded v2 handoff, kept as history only.
3. The GitHub issue, if the work has one. An issue is **not** required: work can start directly from a request.

**Rules**
- One change = one branch = one PR (add `Closes #<issue>` when there is an issue), reviewed by **CodeRabbit** (`.coderabbit.yaml`).
  Fix or answer every CodeRabbit comment; merge only when the merge gate is met (CI green, 0 unresolved threads, every Qodo/Greptile/CodeRabbit finding fixed or answered; CodeRabbit is advisory and never blocks a merge). Never self-approve. If CodeRabbit is rate limited, **Qodo** is the fallback reviewer (`/agentic_review`, `.pr_agent.toml`).
- Install the git hooks once per clone/worktree (`scripts/dev/setup-hooks.sh`; `pre-commit run --all-files` must pass). Run `./gradlew ciCheck` (from M1-02; before that, `./gradlew assembleDebug`) before every push. Org admins may push small changes straight to `main`; never force-push it.
- The project must build without `google-services.json`.
- Add permissions or manifest flags only when the change needs them, and list each one in the PR description (Play policy). Never add `QUERY_ALL_PACKAGES`.
- Infrastructure (GitHub settings, GCP/Firebase) changes **only** through Terraform in `infra/`, applied by GitHub Actions. Never use a console, `gcloud ... create`, or `firebase deploy`. See `docs/INFRASTRUCTURE.md`.
- The design prototype is HTML for reference only. Rebuild it natively; don't embed it.
