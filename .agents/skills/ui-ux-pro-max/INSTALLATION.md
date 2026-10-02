# UI UX Pro Max in PBL4-517

Related to #49. Installed project-locally on 2026-10-02; no global CLI or npm
dependency is required. Python 3.12 is used for verification.

## Source and local changes

- Upstream: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill).
- Pinned commit: `09170eec67eefd46a7ae85de61b40c194020f997`.
- Imported directory: `.claude/skills/ui-ux-pro-max/`, including scripts, data,
  references and upstream tests. Root upstream MIT [LICENSE](LICENSE) is included;
  data provenance and font licensing metadata remain in `data/`.
- Installed using the Codex skill-installer helper with `--ref` set to the SHA
  above and `--dest D:/PBL4-517/.agents/skills`.
- Local adaptations: `SKILL.md` points to this checkout instead of
  `CLAUDE_PLUGIN_ROOT`, and adds repository stack/workflow constraints.
  `INSTALLATION.md` and the root license copy are packaging additions.
  Blank-line trailing whitespace was removed from `scripts/design_system.py`;
  runtime logic and datasets are unchanged.

## Use

The skill is available to compatible agents on their next turn. Root `AGENTS.md`
also links it explicitly. Example request:

> Use ui-ux-pro-max to improve the product page, retaining React, TypeScript,
> Vite, plain CSS and the current API/authentication behavior.

From the repository root, run these commands in PowerShell or a Unix shell:

```sh
python .agents/skills/ui-ux-pro-max/scripts/search.py "ecommerce electronics store" --design-system -p "PBL4-517"
python .agents/skills/ui-ux-pro-max/scripts/search.py "error summary validation" --domain ux
python .agents/skills/ui-ux-pro-max/scripts/search.py "form state" --stack react
```

From another working directory, use the script's absolute path. On this Windows
checkout, that is `D:/PBL4-517/.agents/skills/ui-ux-pro-max/scripts/search.py`.
Search runs locally using Python's standard library and bundled data.

Start with console output. If a task requires saved proposals, explicitly pass
`--persist --output-dir <project-root>`; do not overwrite an existing design
system without authorization. `wiki/` retains accepted project context.
Recommendations do not authorize adding frameworks or changing the secure baseline.

## Verification and maintenance

```sh
python .agents/skills/ui-ux-pro-max/scripts/validate_data.py
python -m unittest discover -s .agents/skills/ui-ux-pro-max/scripts/tests -p test_core.py -v
```

These checks are included in the existing `python-check` CI job. Other bundled
upstream tests include maintainer checks that depend on the full upstream repo;
they are preserved for provenance and are not the supported test command for
this standalone installation. Verification evidence lives in
[`evidence/DEVTOOLS-01/README.md`](../../../evidence/DEVTOOLS-01/README.md).

Updates use a new feature branch and PR: choose an explicit upstream commit,
install to a separate temporary directory using skill-installer, compare the
files, preserve the license and local adaptations, then run the checks above
and required repository CI. Update this pin and evidence together.
