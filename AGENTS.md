# AI Agent bootstrap

The `wiki/` directory is the project's Single Source of Truth for persistent project context. Detailed subsystem setup commands have one canonical location: the subsystem README.

## Before modifying this repository

1. Read [wiki/README.md](wiki/README.md).
2. Read [wiki/PROJECT_CONTEXT.md](wiki/PROJECT_CONTEXT.md).
3. Read [wiki/ARCHITECTURE.md](wiki/ARCHITECTURE.md).
4. Read [wiki/DECISIONS.md](wiki/DECISIONS.md).
5. Read [wiki/CURRENT_STATUS.md](wiki/CURRENT_STATUS.md).
6. Read the documentation specific to the subsystem being modified; for web, [website/README.md](website/README.md) and [wiki/WEB_STACK.md](wiki/WEB_STACK.md).
7. Inspect the related GitHub Issue.
8. Inspect existing code, current branch, Git status and relevant history before making changes. Preserve unrelated work.

## Working rules

- Do not contradict an Accepted decision in `wiki/DECISIONS.md` unless the task explicitly requires changing that decision.
- Do not silently change the technology stack.
- Distinguish **Implemented**, **Planned** and **Proposed**. Do not claim planned functionality is implemented or infer successful testing from the presence of source.
- Do not recreate functionality already marked Completed; inspect and extend the existing implementation.
- Do not modify unrelated subsystems without justification.
- Keep website source in `website/frontend/` and `website/backend/`, with `/api/` routes. Follow [wiki/DEVELOPMENT.md](wiki/DEVELOPMENT.md) for verification and Git conventions.
- Keep `main` a secure baseline. Intentionally vulnerable work belongs in the controlled lab described in [wiki/SECURITY_PLAN.md](wiki/SECURITY_PLAN.md).
- Never commit secrets, `.env`, dependencies, generated clients, build output or local database files. Do not rewrite shared history or force push.
- Follow the task's authorization and repository branch/review rules. Mark GitHub checklist items only after verification; preserve required human review.

If code and wiki documentation disagree:

1. Inspect Git history and the related Issue.
2. Determine which is current.
3. Fix stale documentation as part of the task when appropriate.
4. Never silently assume one is correct.

## After completing substantial work

1. Update [wiki/CURRENT_STATUS.md](wiki/CURRENT_STATUS.md) with verified progress and remaining problems.
2. Update [wiki/DECISIONS.md](wiki/DECISIONS.md) if a new architectural decision was made. Preserve historical decisions; use a new entry and mark the earlier entry Superseded when appropriate.
3. Update relevant subsystem documentation if commands, configuration, architecture or behavior changed.
4. Keep documentation consistent with actual code. Link to canonical documentation instead of copying it; store reports/evidence outside `wiki/`.
