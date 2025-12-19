# AI Rules for ABF Portal React Project

## Environment (Non-Negotiable)

- **OS:** Windows
- **Shell:** PowerShell only
- **Paths:** Windows paths (I:\...)
- Do NOT emit bash or WSL commands
- Do NOT assume remote containers

## Project Structure

- **App root:** `abf-portal-react/`
- Context and specs live in `_context/`
- Do NOT modify files outside `src/` unless asked
- Prefer editing existing files over creating new ones

## Dependencies

- Assume all dependencies are installed
- Do NOT suggest `npm install`, `npx`, or version changes
- If a dependency is missing, ASK before proposing changes
- If a shadcn component is missing, tell user which `npx shadcn add ...` to run

## UI Framework

- Use shadcn/ui components from `@/components/ui/*`
- Do NOT introduce alternative UI libraries
- Follow existing patterns in the repo
- Primary color: `#1E3A5F`

## Uncertainty Handling

- If environment or intent is unclear, ask ONE clarifying question
- Do NOT guess
- Do NOT narrate imaginary actions

## Priorities

- Code must run locally
- Small, incremental changes
- Minimal diffs
- Prefer clarity over cleverness
- Match existing code style

## What NOT To Do

- Do NOT run shell commands
- Do NOT create documentation files unless asked
- Do NOT add emojis unless asked
- Do NOT over-engineer or add features beyond what was asked
