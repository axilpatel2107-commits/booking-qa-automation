# How I use AI in this project

Short version: AI helps me write tests faster. It doesn't decide what "correct" means. I review every line before it goes in.

## What's set up

The repo includes Playwright's built-in test agents (added in Playwright 1.56). They talk to a real browser through the Playwright MCP server, so they work from what's actually on the page, not from guesses.

| Agent | What it does | Where it lives |
|---|---|---|
| **Planner** | Explores the running app and writes a test plan in plain English | `.claude/agents/playwright-test-planner.md` → saves to `specs/` |
| **Generator** | Turns a plan into Playwright tests, checking each locator against the live page | `.claude/agents/playwright-test-generator.md` |
| **Healer** | Runs a failing test, works out why, and suggests a fix | `.claude/agents/playwright-test-healer.md` |

- `.mcp.json` registers the `playwright-test` MCP server.
- `tests/seed.spec.ts` is the starting point the agents use: signed in, on the booking page.

The agent files were generated with `npx playwright init-agents --loop=claude`. If you use VS Code + Copilot instead, run `npx playwright init-agents --loop=vscode`.

## How I actually use them

1. Start the app: `npm start`
2. Open the repo in Claude Code (or VS Code with Copilot agent mode).
3. **Plan:** *"Use the playwright-test-planner agent to plan tests for rescheduling a booking. Use tests/seed.spec.ts as the seed."*
   I read the plan in `specs/` and edit it. Usually I add business rules the agent can't know, and cut scenarios that aren't worth automating.
4. **Generate:** *"Use the playwright-test-generator agent to implement specs/<plan>.md."*
   Then I refactor what it writes to use our page objects and fixtures, so the suite stays consistent.
5. **Heal:** when a test breaks after a UI change, I let the healer propose a fix and then check *why* it broke.

## Where I don't trust it

- **The healer can hide real bugs.** If a button disappears because of a bug, a "healed" test that clicks something else will pass. I treat every heal as a question: did the app change on purpose, or did it break?
- **Generated assertions are often too weak.** "Page is visible" isn't a test. I add checks for the actual business outcome, for example that the slot really becomes unavailable in the API.
- **No secrets or real data.** Agents only ever see this demo app and its throwaway test accounts.

## Why this matters for clients

The useful part isn't "AI writes tests". It's getting good coverage faster while keeping the suite something a human can maintain. The hand-written tests in `tests/ui` and `tests/api` show the standard I hold AI output to.
