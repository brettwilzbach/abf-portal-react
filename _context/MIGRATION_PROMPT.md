# Complete Migration Prompt: Streamlit to Next.js + shadcn/ui

## Context & Current State

You are migrating a **Bain Capital Credit ABF/Structured Credit Analytics Portal** from Streamlit (Python) to Next.js 16 + shadcn/ui + TypeScript.

### Current Streamlit App Location
- **Path:** `bain_abf_portal/`
- **Main entry:** `bain_abf_portal/app.py`
- **Pages:**
  - Home (`app.py` - main page)
  - Waterfall Modeler (`pages/waterfall_modeler.py`)
  - Spread Monitor (`pages/spread_monitor.py`)
  - Market Tracker (`pages/market_tracker.py`)
  - Deal Analyzer (`pages/deal_analyzer.py`)

### Current React Project Location
- **Path:** `abf-portal-react/`
- **Status:** Foundation built - Home page and Sidebar done
- **Stack:** Next.js 16.0.10, React 19.2.1, TypeScript 5, Tailwind CSS v4

### Backend Models (Python - Keep These)
- `bain_abf_portal/models/bloomberg_client.py` - Direct Bloomberg API client (working, pandas 2.0+ compatible)
- `bain_abf_portal/models/data_fetcher.py` - FRED API, spread estimation
- `bain_abf_portal/models/cashflow_engine.py` - Cash flow calculations
- `bain_abf_portal/models/deal_structure.py` - Deal data models
- `bain_abf_portal/models/deal_database.py` - Deal storage

---

## Architecture Decision

**Use a Hybrid Architecture:**
- **Frontend:** Next.js 16 + shadcn/ui + TypeScript (React 19)
- **Backend:** FastAPI (Python) - Keep all calculation logic in Python
- **Communication:** REST API between Next.js and FastAPI
- **Why:** Python models are complex (pandas, numpy, blpapi) - easier to keep than rewrite

---

## Page Migration Priority

1. **Market Tracker** (Medium) - Deal table, filters, search, export
2. **Spread Monitor** (Medium-High) - Charts, data display, relative value
3. **Deal Analyzer** (Medium) - Educational tool with interactive sliders
4. **Waterfall Modeler** (High) - Complex forms, calculations, visualizations

---

## Key Implementation Details

### Styling
- Use Tailwind CSS (already configured)
- Match color scheme from Streamlit: `#1E3A5F` for primary
- Use shadcn theme system
- Responsive design (mobile-friendly)

### State Management
- **Server State:** React Query (`@tanstack/react-query`)
- **Client State:** React useState/useReducer

### Charts
- Use **Recharts** (already installed)

---

## Success Criteria

- All Streamlit pages migrated to Next.js
- All functionality preserved
- Python backend logic intact (FastAPI)
- Modern, responsive UI with shadcn/ui
- Charts and visualizations functional
- Forms and calculations accurate
- Error handling and loading states
