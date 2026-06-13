# Contributing

Thanks for helping improve Muskebeers.

## Development Setup

```bash
npm install
cp .env.example .env
npm test
```

Use a test Discord application and guild while developing. Do not use production
tokens in local experiments.

## Pull Requests

- Keep changes focused and explain the user-facing impact.
- Add or update tests for bug fixes and behavior changes.
- Run `npm test` before opening a pull request.
- Do not commit `.env`, `data/`, logs, screenshots containing tokens, or
  production guild snapshots.

## Code Style

- Use ES modules.
- Prefer small, testable helper modules for logic that does not need Discord.
- Keep API calls routed through the existing Wise Old Man rate limiter.
- Avoid broad refactors unless they directly support the change.

## Reporting Bugs

Please include:

- What command or flow failed.
- What you expected to happen.
- Relevant logs with tokens and guild/user IDs redacted.
- Node.js version and deployment environment.

