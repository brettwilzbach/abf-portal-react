# ABF Portal React

Bain Capital Credit - ABF/Structured Credit Analytics Portal

## Quick Start

```bash
npm run dev
```

Visit `http://localhost:3000`

## Project Status

**✅ All pages implemented** - Ready for backend integration

- Market Tracker (`/market`) - Deal tracking with filters and export
- Spread Monitor (`/spreads`) - Relative value analysis
- Deal Analyzer (`/analyzer`) - Interactive scenario analysis
- Waterfall Modeler (`/waterfall`) - Cash flow modeling

**For detailed status:** See [`_context/MIGRATION_REVIEW.md`](_context/MIGRATION_REVIEW.md)

## Documentation

All project documentation is in the `_context/` folder:

- **`MIGRATION_REVIEW.md`** - Complete implementation status and details
- **`PROJECT_STATUS.md`** - Quick status reference
- **`Bain_ABF_Portal_Spec.md`** - Product specification
- **`AI_RULES.md`** - Coding guidelines for AI assistants

## Tech Stack

- Next.js 16.0.10
- React 19.2.1
- TypeScript 5
- Tailwind CSS v4
- shadcn/ui components
- Recharts (for future visualizations)

## Backend

FastAPI backend (separate project) - API URL: `http://localhost:8000`

Configure via `NEXT_PUBLIC_API_URL` environment variable.

---

**For AI Assistants:** See `.cursorrules` and `_context/` folder for project context.


