# Form Filler App (NestJS + Playwright)

Opens a browser with **proxy tunneling** and **device fingerprint rotation** so you can fill web forms manually while appearing as a different user each time.

Built with **NestJS v10**, **Playwright**, and **TypeScript**.

---

## Prerequisites

Install the following on your PC before cloning/running this project:

### 1. Node.js (v18 or later)

Download and install from [https://nodejs.org](https://nodejs.org) (LTS recommended).

Verify after install:

```bash
node -v    # should print v18.x.x or higher
npm -v     # should print 9.x.x or higher
```

### 2. Git (optional, for cloning)

Download from [https://git-scm.com](https://git-scm.com) if you want to clone the repo. Otherwise just copy the project folder.

---

## Installation

### 1. Install npm dependencies

```bash
npm install
```

### 2. Install Playwright browsers

Playwright needs to download browser binaries (Chromium). Run:

```bash
npx playwright install chromium
```

On **Linux**, you may also need system dependencies:

```bash
npx playwright install-deps chromium
```

### 3. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

| Variable                | Required | Description                                                                 |
|-------------------------|----------|-----------------------------------------------------------------------------|
| `FORM_URL`              | Yes      | The URL to open in the browser (e.g. `https://example.com/my-form`)         |
| `WEBSHARE_PROXY_SERVER` | No       | Proxy server address (e.g. `http://geo.iproyal.com:12321`). If not set, falls back to the built-in proxy list or the Webshare API. |
| `WEBSHARE_USERNAME`     | Yes      | Proxy username                                                              |
| `WEBSHARE_PASSWORD`     | Yes      | Proxy password                                                              |
| `WEBSHARE_API_KEY`      | No       | Webshare API key (used to fetch proxy list from Webshare API if no `WEBSHARE_PROXY_SERVER` is set) |

---

## Usage

### Build and run (recommended)

```bash
npm run start:fill
```

This builds the TypeScript project and immediately runs the form filler.

### Run without rebuilding

If you've already built once and haven't changed any code:

```bash
npm run fill
```

### Build only

```bash
npm run build
```

### Start NestJS HTTP server (optional)

```bash
npm run start
# or with hot reload:
npm run start:dev
```

---

## What it does

1. Picks a **random device profile** (desktop/laptop with different screen sizes, GPUs, user agents)
2. Creates an **anonymous proxy tunnel** using your configured proxy credentials
3. **Detects the proxy's geolocation** (timezone, locale, country) so the browser fingerprint matches the IP
4. Launches a **Chromium browser** with anti-detection settings (no webdriver flag, realistic viewport, matching timezone/locale)
5. Navigates to your `FORM_URL` — you fill the form manually
6. When you close the browser window, the process exits and cleans up the proxy tunnel

---

## Project structure

```
src/
  main.ts                            # NestJS HTTP server entry (optional)
  run-form-filler.ts                 # CLI entry point (no HTTP server)
  app.module.ts                      # Root NestJS module
  config/
    form-filler.config.ts            # Environment variable mapping
  form-filler/
    form-filler.module.ts            # FormFiller NestJS module
    form-filler.service.ts           # Core logic: proxy, device, browser launch
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `net::ERR_TUNNEL_CONNECTION_FAILED` | Proxy is unreachable or account expired | Check proxy credentials and account balance |
| `Geo lookup failed` | Proxy not forwarding requests | Same as above — verify the proxy is active |
| `npx playwright install` hangs | Network/firewall blocking downloads | Try from a different network or use `--with-deps` |
| `WEBSHARE_USERNAME and WEBSHARE_PASSWORD must be set` | Missing `.env` values | Make sure `.env` has both `WEBSHARE_USERNAME` and `WEBSHARE_PASSWORD` |

---

## Quick start (fresh PC summary)

```bash
# 1. Install Node.js v18+ from https://nodejs.org

# 2. Clone or copy the project, then:
cd form-filler-app
npm install
npx playwright install chromium

# 3. Create .env from example and fill in your proxy credentials:
cp .env.example .env

# 4. Run:
npm run start:fill
```
