# AERORA — Flight Search & Group Booking Platform UI

A responsive React + TypeScript frontend for the Go flight-platform contract described in the attached backend README. It runs standalone with a mock-first API adapter and browser-persisted demo data.

## Run locally

```bash
npm install
npm run dev
```

Production validation/build:

```bash
npm run build
```

## Mock / real API mode

Mock mode is enabled by default. It simulates 320–600ms request latency and persists CRUD data under `aerora-platform-v1` in `localStorage`.

Set `VITE_USE_MOCK_API=false` to use the Go REST API through the Vite `/api/v1` and `/portal-admin-8f2a9c` reverse-proxy paths (the development proxy target defaults to `http://127.0.0.1:8080`). Browser requests stay same-origin; adjust the proxy target for your backend deployment. Admin JWTs are retained in local storage and sent as bearer tokens. The demo login accepts any non-empty email/password while mock mode is enabled.

## Public pages and sections

- Local looping WebM travel-film hero (poster + reduced-motion fallback), atmospheric layered type, float-in destinations and a flight-search reveal.
- GSAP/ScrollTrigger reveals, expandable destination cards, Lenis smooth scrolling, Framer Motion modal/step transitions, a responsive intro animation, and reduced-motion-aware cloud-fill loading indicators.
- Airport autocomplete, scheduled-flight and group-ticket search modes, traveller/date controls, and flexible-date fare calendar.
- Editorial flight results with route imagery, timeline, filters, price summaries and inquiry actions.
- Asymmetric group-flight feature layouts, route-specific imagery, itinerary detail timeline and two-step inquiry flow.
- Image-led promotion campaigns, travel philosophy, route-story visual, FAQ/contact form and layered footer.
- Premium-but-usable admin surfaces with animated metrics, status tables, management modals and accessible responsive layouts.

## Technical SEO and deployment

The public application is a client-rendered single-page site; the homepage is the only current indexable page. Flight results, promotion cards, flight-detail dialogs, and contact are in-page content rather than separate crawlable routes, so the sitemap deliberately does not invent detail URLs. Partner/admin and unknown client paths receive `noindex` metadata; the robots rules disallow the admin and API paths for crawling (not as access control). Existing PNG/JPEG imagery has WebP variants with original-format fallbacks, and the admin chart/notification tools are lazy-loaded rather than included in the homepage entry chunk.

Initial homepage metadata is present in the HTML; route-specific metadata and JSON-LD are applied by the client. Crawlers that render JavaScript can process that runtime content, but social-preview bots and HTTP status behavior depend on the host. SSR/prerendering was not added because the project is currently a client-only SPA. Configure host-level prerendering if unrendered HTML indexing is required, and configure real 404 responses for unknown paths; the SPA fallback alone may return HTTP 200. No Lighthouse or field Core Web Vitals score was measured.

Set `VITE_PUBLIC_SITE_URL` to the verified production origin at build/deployment time (for example, `https://your-real-domain`) to emit an absolute canonical/social URL set, `robots.txt` with its sitemap reference, and a valid root-only `sitemap.xml`. No production domain is hard-coded. In development, `/robots.txt` and `/sitemap.xml` are served using the request host. The production build omits `sitemap.xml` until the real origin is configured rather than publishing a fabricated domain.

Structured data is limited to the visible organization, website, webpage, and displayed email contact point. There is no verified logo file, phone/WhatsApp number (the UI labels those as demo details), booking URL search route, public detail-page route, or configured analytics/Search Console token, so none is asserted in schema or metadata.

## Partner flight deck

- Obscured admin route: `/portal-admin-8f2a9c`.
- Dashboard analytics and inventory/outbox KPIs.
- Group-flight drafts, publish/delete, seat availability adjustments and audit events.
- Featured destination add/edit/delete with image URL or compressed upload in browser-local storage; the current backend contract has no destination CRUD endpoint, so changes do not publish or sync across devices.
- Inquiry filters, permitted lifecycle transitions, inquiry/snapshot detail, WhatsApp outbox state and retry/simulation.
- Airline catalogue create/edit/delete and promotion create/edit/activate/delete.
- Fare markup settings, audit log and password security page.

## API adapter

`src/services/apiClient.ts` contains ERD interfaces, async mock methods, local storage persistence, and real endpoint adapters for airport lookup, flight search, cheapest dates, booking links, public group flights/promotions/inquiries, and the obscured admin surface.
