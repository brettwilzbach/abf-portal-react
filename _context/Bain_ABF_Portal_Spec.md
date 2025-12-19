# Bain Capital Credit - ABF/Structured Credit Analytics Portal
## Product Specification for Brett Wilzbach

---

# Executive Summary

**Purpose:** Create an interactive analytics portal/dashboard to assist Bain Capital Credit's product management team in:
1. Tracking structured credit & ABF market developments
2. Modeling example waterfall triggers and deal structures
3. Monitoring collateral groupings, issuance, and spreads
4. Supporting client communication and investor education

**Context:** This tool supports the Lincoln Bain Capital Total Credit Fund launch and broader ABF/structured credit initiatives.

---

# ABF Market Overview

### Market Size
| Metric | Value |
|--------|-------|
| Total ABF Market | $20T+ |
| Private ABF | ~$6T (doubled since 2008) |
| 2024 Private ABS Issuance | $130B (40% of total ABS) |
| Projected Private ABS (5yr) | $200B |

### Collateral Categories

| Category | Examples |
|----------|----------|
| **Consumer Finance** | Auto loans, credit cards, consumer loans, BNPL |
| **Hard Assets** | Aircraft, equipment, rail, shipping, infrastructure |
| **Real Estate** | Residential mortgages, commercial mortgages, HELOCs |
| **Financial/Esoteric** | Royalties (music, pharma, IP), trade finance, litigation funding |
| **Specialty** | Data centers, digital infra, subscription/SaaS, sports finance |

---

# Portal Features & Modules

## Module 1: Market Tracker (ABS/CLO New Issuance)

### Data Fields
| Field | Description |
|-------|-------------|
| Deal name | Issuer + Series (e.g., ACMAT 2025-4) |
| Issuer | Sponsor/originator |
| Collateral type | Auto, consumer, equipment, esoteric, etc. |
| Deal size | Total issuance ($M) |
| Tranche breakdown | Class A/B/C sizes, ratings, spreads, coupons |
| WAL | Weighted average life by tranche |
| Credit enhancement | Subordination %, OC levels |
| Pricing date | When deal priced |

### Filters
- By collateral type
- By rating (AAA to unrated)
- By date range
- By issuer/shelf
- By spread range

---

## Module 2: Spread Monitor

### Sectors Tracked
| Sector | Benchmark |
|--------|-----------|
| CLO AAA | vs. IG Corps, Treasuries |
| CLO Mezz (AA-BBB) | vs. BBB Corps |
| CLO BB/Equity | vs. HY Index |
| Prime Auto ABS | vs. IG Corps |
| Subprime Auto ABS | vs. HY Corps |
| Consumer ABS | vs. IG/HY |
| Esoteric ABS | vs. IG Corps |
| Equipment ABS | vs. IG Corps |

### Visualizations
- Spread time series (interactive, selectable sectors)
- Spread differential: Structured vs. Corporate
- Z-score: Current spread vs. historical average

---

## Module 3: Waterfall Modeler (Interactive)

### Payment Priority Waterfall
```
1. Senior Fees (trustee, servicer, admin)
2. Class A Interest
3. Class A Principal (if sequential)
4. Class B Interest
5. Class B Principal (if sequential)
6. OC Test - if fails, trap cash
7. Class C Interest
8. Class C Principal
9. Subordinated Fees
10. Residual/Equity
```

### Trigger Events
| Trigger | Description | Consequence |
|---------|-------------|-------------|
| **OC Test Breach** | Collateral value / Notes < threshold | Redirect cash to senior paydown |
| **IC Test Breach** | Interest coverage falls below threshold | Redirect cash to senior paydown |
| **Delinquency Trigger** | 60+ day delinquencies > X% | Switch to sequential pay |
| **Cumulative Loss Trigger** | CNL exceeds threshold | Accelerate senior amortization |

### Interactive Inputs
| Input | User Can Adjust |
|-------|-----------------|
| Default rate | 0-30% |
| Recovery rate | 0-100% |
| Prepayment speed | 0-50% CPR |
| Interest rate | SOFR + spread |
| Collateral yield | Gross WAC |

---

## Module 4: Deal Analyzer

Educational tool for understanding ABS/CLO structures with:
- Interactive scenario sliders (CPR, CDR, Severity)
- Bond returns dashboard (MOIC, WAL)
- Waterfall flow visualization
- OC trigger analysis

---

# ABF Collateral Taxonomy

## Consumer Assets
- Prime auto loans
- Subprime auto loans
- Credit card receivables
- Student loans (private)
- Personal loans / marketplace lending
- BNPL (Buy Now Pay Later)

## Commercial Assets
- Equipment leases (construction, medical, tech)
- Fleet/vehicle leases
- Small business loans
- Franchise loans
- Inventory finance

## Hard Assets
- Aircraft (operating leases, loans)
- Railcar
- Shipping containers
- Solar panels / PACE
- Data centers / digital infrastructure

## Real Estate
- Residential mortgages (non-QM, jumbo)
- Home equity (HELOCs, HEIs)
- Commercial mortgages (CRE CLO)
- Single-family rental (SFR)

## Financial / Esoteric
- Music royalties
- Pharma royalties
- Litigation finance
- Whole business securitization
- Sports franchise finance
- Insurance-linked securities
- Timeshare receivables
- Cell tower / spectrum
- Subscription / SaaS revenue
