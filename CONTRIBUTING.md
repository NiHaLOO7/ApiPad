# Contributing to ApiPad

Thanks for taking the time to contribute! ApiPad is a community-driven project and all kinds of contributions are welcome — bug fixes, new features, UI improvements, or even just fixing a typo.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)

### Setup

```bash
git clone https://github.com/NiHaLOO7/ApiPad.git
cd ApiPad
npm install
npm run tauri dev
```

The app will launch in a native window. Hot reload is enabled for the React frontend — Rust changes require a restart.

## How to Contribute

### Reporting Bugs

Open an issue with:
- What you did
- What you expected
- What actually happened
- Your OS and version

### Suggesting Features

Open an issue with the `enhancement` label. Describe the use case — not just the feature, but *why* it's needed.

### Submitting a PR

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Test it manually — send a real request, check the UI
5. Open a PR with a clear description of what changed and why

### Good First Issues

Look for issues tagged [`good first issue`](https://github.com/NiHaLOO7/ApiPad/issues?q=label%3A%22good+first+issue%22) — these are small, well-scoped tasks that don't require deep context.

## Project Structure

```
src/
  App.jsx          # entire frontend (React + Tailwind)
  main.jsx         # React entry point
src-tauri/
  src/lib.rs       # Tauri app setup, plugin registration
  capabilities/    # permission config
  tauri.conf.json  # app config (window size, identifier, etc.)
```

## Code Style

- Frontend: React functional components, Tailwind for all styling
- No unnecessary abstractions — keep it simple
- No comments explaining *what* the code does — only *why* if non-obvious

## License

By contributing, you agree your contributions will be licensed under the MIT License.
