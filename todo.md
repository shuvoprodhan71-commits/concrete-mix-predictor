# Concrete Mix Design Predictor — TODO

## Backend
- [x] Copy trained ML models into project
- [x] Create Python prediction script callable from Node.js
- [x] Add predict tRPC procedure in server/routers.ts
- [x] Add model metadata endpoint (ranges, grades)

## Frontend
- [x] Design system: dark engineering theme, CSS variables
- [x] Input form: target strength slider + numeric input (2–83 MPa)
- [x] Curing age dropdown (1, 3, 7, 14, 28, 56, 90, 180, 270, 365 days)
- [x] Quick-select grade buttons: C20, C25, C30, C35, C40, C50, C60, C70
- [x] Results table: 7 components with predicted kg/m³, Min, Max, Status
- [x] Forward model verification row (predicted vs target + error %)
- [x] Bar chart visualization of mix proportions
- [x] Pie chart showing percentage breakdown
- [x] Export results to CSV
- [x] Status indicators OK/Warning per component
- [x] Loading states and error handling

## Testing
- [x] Vitest test for predict procedure
- [x] Checkpoint and delivery

## Bug Fixes
- [x] Fix Python version mismatch: server calls python3.11 but deployed env uses python3.13

## Railway Deployment
- [x] Create Dockerfile with Node.js + Python 3 support
- [x] Remove Manus OAuth dependency from server and frontend
- [x] Add simple username/password auth (bcrypt + JWT)
- [x] Create .env.example for Railway environment variables
- [x] Add railway.json config file
- [x] Update frontend to remove Manus-specific login UI
- [x] Test production build locally
- [x] Package and deliver Railway-ready ZIP

## Bug Fixes (Round 2)
- [x] Fix ML path: production dist/__dirname resolves to /app/dist/ not /app/server/ml/
