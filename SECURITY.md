# Security Policy

## Supported Versions

The default branch is the supported development line.

## Reporting a Vulnerability

Please do not open a public issue for a suspected vulnerability.

If you find a security problem, contact the repository owner privately through
GitHub or another private channel available from the owner profile. Include:

- A short description of the issue.
- Steps to reproduce, if safe to share.
- Impact and affected endpoints or commands.
- Any suggested mitigation.

## Secret Handling

Never commit:

- Discord bot tokens
- Wise Old Man API keys
- Loot webhook tokens
- `ADMIN_SECRET`
- `.env`
- `data/`
- logs or screenshots containing secrets

If a secret is exposed, rotate it immediately and remove it from any public
history or issue content where possible.

