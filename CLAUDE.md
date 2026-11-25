# CLAUDE.md

Guidance for Claude Code in this repository. The shared rules for every coding agent are in `AGENTS.md`:

@AGENTS.md

## Repository status

Phase 1 and the v5 UI redesign are built. Work is tracked as plain GitHub issues and PRs (no backlog files, board or wave tooling). The repo holds:

| Path | What |
|---|---|
| `design_handoff_stay_focused_phase1/` | **Historical** v2 design handoff (superseded by v5; the v2 design system is removed from the code) |
| `design/` | **v5 redesign** source: `Vesper v5.dc.html` (prototype, source of truth), `screens-v5/` (24 reference PNGs, re-render with `scripts/design/capture-v5.mjs`). `README.md`/`screenshots/` there are the older v2 (historical) |
| `docs/design/V5_SPEC.md` | v5 spec for epics M11–M13: strategy, tokens, components, copy per screen, extras |
| `docs/IMPLEMENTATION_PLAN.md` | Decisions, module map, workflow, definition of done, data model, backend/Functions policy |
| `docs/INFRASTRUCTURE.md` | Terraform + GitHub Actions only; one prod GCP project; state in GCS; keyless login |
| `infra/` | Terraform: `seed` (project, state bucket, keyless login), `gcp` (Firebase), `github` (repo settings, ruleset, Pages). Public CI values in `infra/prod.env` |
| `.github/workflows/infra.yml` | All Terraform (`infra/seed`, `infra/gcp`, `infra/github`): plan on PR, apply on merge to `main`. |
| `.coderabbit.yaml` | CodeRabbit review config (advisory reviewer; never blocks a merge) |

## Commands

Android (available as the M1 stories land):

```bash
scripts/dev/setup-hooks.sh                                           # install pre-commit + pre-push hooks, once per clone/worktree
./gradlew assembleDebug                                              # both apps
./gradlew ciCheck                                                    # everything CI runs (M1-02) = Definition of done
./gradlew spotlessApply                                              # auto-format Kotlin (ktlint + Compose rules)
./gradlew detekt lintAll                                             # static analysis (config/detekt/detekt.yml)
./gradlew unitTests koverXmlReport koverVerify                       # JVM + Robolectric tests, coverage gate (80% logic modules, 60% overall)
./gradlew verifyScreenshots                                          # Roborazzi: compare against committed baselines
./gradlew :core:blocking:testDebugUnitTest --tests '*RuleEvaluator*' # one test class
./gradlew recordRoborazziDebug                                       # update screenshot baselines
./gradlew ciDevicesGroupDebugAndroidTest                             # instrumented tests on managed emulators (M1-16)
maestro test e2e/flows                                               # end-to-end flows on a running emulator (M1-16)
```

Infra (never apply locally; Actions plans on the PR and applies on merge):

```bash
terraform -chdir=infra/github fmt -recursive && terraform -chdir=infra/github validate
```

## Working on a change

Branch from `origin/main`, implement, run the Definition-of-done command and open a PR (add `Closes #<n>` when there is
an issue). Work through CodeRabbit's review (fix or answer every comment; never `@coderabbitai approve`), then
squash-merge once CI is green and no threads are unresolved.

## Notes for Claude

- Look up library and API details (Compose, Room, Hilt, Firebase, Terraform providers, Play policy) in current docs
  (Context7 / official docs) before writing code. Versions and APIs change.
- The design copy is final. Take strings from the prototype verbatim.
- This is a **public** repo: never commit secrets, `google-services.json`, keystores, Terraform state,
  `.idea/`, or real user data. Use placeholders in docs.
