# Form Filler App (NestJS + TypeScript)

Fills a web form automatically using rows from a SQLite database. Each run uses a **different device** (Samsung, iPhone, Dell PC, etc.) and a **different proxy** (different IP/location) so submissions look like they come from different users and places.

Built with **NestJS** and **TypeScript** for structure, dependency injection, and maintainability.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Configure your form and database**
   - Copy `.env.example` to `.env` and set:
     - `FORM_URL` – URL of the form page
     - `FIELD_MAPPING_JSON` – JSON object mapping form selectors to DB column names
     - `SUBMIT_SELECTOR` – CSS selector for the submit button
     - Optionally `SUCCESS_INDICATOR` – selector that appears after successful submit
   - If your form has different field names, add columns to the `submissions` table (see `src/database/database.service.ts`) and update the config in `src/config/form-filler.config.ts` or `.env`.

3. **Initialize the database and add data**
   ```bash
   npm run init-db
   ```
   This creates `data/submissions.db` and inserts sample rows. Edit `scripts/init-db.ts` to add your own rows or import from CSV.

4. **Proxies (optional)**
   - Set `PROXY_LIST` in `.env` (comma-separated URLs), or
   - Set `PROXY_LIST_PATH` to a file with one proxy per line.
   - Format: `http://host:port` or `http://user:pass@host:port`

## Run

**Run the form filler** (processes all pending rows, then exits):

```bash
npm run start:fill
```

Or build once, then run:

```bash
npm run build
npm run fill   # runs node dist/src/run-form-filler.js
```

**Start the NestJS HTTP server** (optional; for future API endpoints):

```bash
npm run start
# or with watch: npm run start:dev
```

The form filler will:
1. Take the next **pending** row from the database
2. Pick the next **device** (Samsung → iPhone → Dell PC → …) and next **proxy**
3. Open Chrome with that device profile and proxy, go to the form, fill it, and submit
4. Mark the row as **success** or **failed**
5. Wait a random delay (default 30–60 seconds), then repeat until no pending rows remain

## Project structure (NestJS)

- `src/main.ts` – HTTP server entry (optional)
- `src/run-form-filler.ts` – Form filler CLI entry (no HTTP)
- `src/app.module.ts` – Root module
- `src/config/form-filler.config.ts` – Form URL, field mapping, timeouts, proxy paths
- `src/database/` – `DatabaseModule`, `DatabaseService` (SQLite, get next row, mark success/failed)
- `src/form-filler/` – `FormFillerModule`, `FormFillerService` (Playwright loop), `DevicesService`, `ProxiesService`
- `scripts/init-db.ts` – Create DB table and optional sample data
- `data/submissions.db` – SQLite DB (created on first run or `npm run init-db`)

## Customizing

- **Form fields**: Edit `FIELD_MAPPING_JSON` in `.env` or `src/config/form-filler.config.ts`: keys = CSS selectors, values = column names in `submissions`.
- **DB columns**: Add columns in `src/database/database.service.ts` (schema) and in `SubmissionRow`, then add matching entries to the field mapping.
- **Devices**: Edit `src/form-filler/devices.service.ts` to add or change device profiles.
- **Delays**: Adjust `DELAY_MIN_MS` and `DELAY_MAX_MS` in `.env`.

## Retrying failed rows

Use `DatabaseService.resetToPending(id)` from a Nest context, or run SQL:

```sql
UPDATE submissions SET status = 'pending', error_message = NULL WHERE id = ?;
```
