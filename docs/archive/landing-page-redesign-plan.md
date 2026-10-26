# Premium Landing Page Overhaul — TAP

Transform the TAP landing page from a basic light-mode MVP into an enterprise-grade, dark-mode-first design inspired by dockit-1.0.0, with richer color depth and Claude-level typographic sophistication.

## User Review Required

> [!IMPORTANT]
> **Dark-mode first approach**: The dockit reference uses a dark (#0d0d0d) base with warm accent gradients. I plan to adopt a similar dark base but with a deeper, more premium color system — shifting from dockit's `#D76D77` coral to a refined **warm amber-to-violet gradient** (`#3a1c71 → #D76D77 → #ffca7b`) for accent elements. The overall feel will be closer to **Anthropic/Claude's website** — restrained, typographic, and luxurious — rather than the colorful SaaS look the current site has.

> [!WARNING]
> **This rewrites all landing page components**. Dashboard pages, auth pages, and shared UI components (Button, Card, etc.) will remain untouched. Only the landing-page-facing code will change. The Navbar will update visually but keep the same navigation links.

## Proposed Changes

### Design System — Color & Typography Foundation

#### [MODIFY] [index.css](file:///c:/Users/mohit/OneDrive/Desktop/backend%20TAP/apps/web/src/index.css)

- Replace the current light-mode HSL variables with a **dark-first color system**:
  - `--background`: deep near-black `#0a0a0b`
  - `--foreground`: warm off-white `#f0ede8`
  - Muted tones using warm grays (`#7a7770`, `#3a3935`) instead of cold zinc
  - Accent gradient: `linear-gradient(135deg, #3a1c71, #D76D77, #ffca7b)`
- Add CSS custom properties for the gradient, glow effects, and section spacing
- Add `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap')` for refined typography with light weights
- Keep the existing scrollbar, glass, and utility classes intact (they feed the dashboard)
- Add new landing-page-specific utilities (`.landing-gradient-text`, `.landing-section`, `.landing-glow`)

#### [MODIFY] [tailwind.config.js](file:///c:/Users/mohit/OneDrive/Desktop/backend%20TAP/apps/web/tailwind.config.js)

- Extend colors with the new premium palette tokens
- Add custom animations: `float`, `gradient-shift`, `fade-in-up`, `scale-in`
- Add `fontFamily` override for Inter with proper weight axis

#### [MODIFY] [index.html](file:///c:/Users/mohit/OneDrive/Desktop/backend%20TAP/apps/web/index.html)

- Update `<title>` to "TAP — AI Teaching Assistant Platform"
- Add meta description for SEO
- Add Google Fonts `<link>` for Inter with weights 300–700

---

### Navbar — Refined & Minimal

#### [MODIFY] [Navbar.tsx](file:///c:/Users/mohit/OneDrive/Desktop/backend%20TAP/apps/web/src/components/ui/Navbar.tsx)

- **Dark glassmorphic navbar**: `bg-[#0a0a0b]/80 backdrop-blur-2xl` with a subtle bottom border using `border-b border-white/[0.06]`
- Logo: keep the icon + "TAP" branding but style it with warm off-white
- Nav links: `text-[#7a7770]` with hover to `#f0ede8`, smooth transitions
- "Get Started" button: **gradient border treatment** (like dockit's `.btn-outline-primary`) — transparent fill, gradient `::before` mask border, hover fills with gradient
- Mobile menu: dark panel with same warm tones, no jarring white
- Typography: `font-medium text-[13px] tracking-[0.01em]` — tight, professional, Claude-like

---

### Hero Section — Commanding & Typographic

#### [MODIFY] [Hero.tsx](file:///c:/Users/mohit/OneDrive/Desktop/backend%20TAP/apps/web/src/components/landing/Hero.tsx)

Inspired by dockit's hero pattern of **large display text with dimmed secondary text** (`light-text` class):

- **Background**: Dark base with subtle radial gradient glow (warm amber at 5% opacity, centered)
- **Badge**: Refined pill with subtle border and `backdrop-blur`, muted text — not attention-grabbing, just classy
- **Headline**: 
  - `text-[4.5rem] md:text-[5.5rem]` with `tracking-[-0.04em] leading-[0.92]` 
  - Primary line in bright off-white `#f0ede8`
  - Secondary line in muted `#5a5650` (dockit's `light-text` pattern)
  - Font weight 600, not 700 — avoiding the heavy "vibecoded" look
- **Subtitle**: `text-lg text-[#7a7770] font-light max-w-xl` — restrained, descriptive
- **CTA buttons**: 
  1. Primary: gradient fill button (`#3a1c71 → #D76D77 → #ffca7b`) with subtle shadow
  2. Secondary: ghost button with gradient border mask (dockit pattern)
- **Visual element**: Replace the floating "DASHBOARD PREVIEW" placeholder with a refined dark card showing an abstract UI preview — dark rounded rect with subtle grid lines and glow, suggesting the product without screenshots
- Subtle floating animation on the visual element (gentle `translateY` loop)

---

### Features Section — Card Grid with Gradient Borders

#### [MODIFY] [Features.tsx](file:///c:/Users/mohit/OneDrive/Desktop/backend%20TAP/apps/web/src/components/landing/Features.tsx)

Inspired by dockit's `NewCard` component pattern — dark cards with hover gradient borders:

- **Section styling**: Dark background, generous padding (`py-24 md:py-32`)
- **Section heading**: Large display text with dimmed secondary span (dockit pattern)
- **Cards** (4 features in a grid):
  - `bg-[#111113]` with `border border-[#1e1e21]` 
  - On hover: gradient border appears using `::before` pseudo-element with mask technique (from dockit)
  - Icon: inside a subtle circular background `bg-[#1a1a1d]`, with a unique warm color per card
  - Title: `text-lg font-semibold text-[#f0ede8]`
  - Description: `text-sm text-[#7a7770] leading-relaxed`
  - Bottom arrow icon that rotates on hover (dockit pattern)
- Features data stays the same (Smart Notes, Automated Assignments, Interactive Flashcards) plus a 4th: "Course Analytics"
- Staggered scroll-triggered animation via Framer Motion

---

### How It Works — Tabbed Walkthrough (Dockit HeroTabs Adaptation)

#### [MODIFY] [HowItWorks.tsx](file:///c:/Users/mohit/OneDrive/Desktop/backend%20TAP/apps/web/src/components/landing/HowItWorks.tsx)

Adapt dockit's **HeroTabs** pattern — numbered tabs with content panels:

- **Section heading**: Same display typography pattern
- **Tab navigation bar**: horizontal row of clickable steps separated by a top border line
  - Each tab: numbered circle + title + subtitle
  - Active tab: gradient top border line (dockit's `::before` with `--color-primary-gradient`)
  - Inactive tabs: reduced opacity (`0.6`)
  - Click switches active tab with smooth transition
- **Content panel**: Below the tabs, a dark panel (`bg-[#111113]`) showing a visual representation of each step — abstract UI mockup or descriptive content
- Keyboard navigation support (arrow keys)
- State managed via React `useState`
- 3 steps: Upload → Generate → Review

---

### FAQ Section — Interactive Accordion with Tabbed Categories

#### [NEW] [FAQ.tsx](file:///c:/Users/mohit/OneDrive/Desktop/backend%20TAP/apps/web/src/components/landing/FAQ.tsx)

Adapted from dockit's `AccordionContainer` — tabbed FAQ with category switching:

- **Layout**: Two-column grid (sidebar tabs + accordion list)
- **Tab sidebar**: 3 categories (General, Features, Support)
  - Each tab: icon + title + subtitle in a dark card
  - Active tab: gradient border (dockit pattern)
  - Hover: subtle lift + background change
- **Accordion list**: Expandable Q&A items
  - Smooth height transition with CSS `max-height` + JS
  - Staggered fade-in animation when switching categories
  - Clean dividers between items
- Content relevant to TAP (AI teaching assistant questions)

---

### CTA Section — Premium Gradient Treatment

#### [MODIFY] [CTA.tsx](file:///c:/Users/mohit/OneDrive/Desktop/backend%20TAP/apps/web/src/components/landing/CTA.tsx)

- Full-width dark section with centered content
- Heading: Large display text, warm white with dimmed secondary span
- Subtitle: Muted warm gray
- Two buttons: gradient fill primary + gradient border secondary (dockit CTA pattern)
- Subtle radial glow behind the CTA block
- No glassmorphism card wrapper — just clean centered text with generous whitespace

---

### Footer — Refined & Minimal

#### [MODIFY] [Footer.tsx](file:///c:/Users/mohit/OneDrive/Desktop/backend%20TAP/apps/web/src/components/ui/Footer.tsx)

- Dark background matching the site base
- Subtle top border `border-t border-[#1e1e21]`
- Logo + description in warm muted tones
- Link columns: `text-[#5a5650]` with hover to `#f0ede8`
- Copyright with warm gray text
- No white backgrounds

---

### Landing Page Assembly

#### [MODIFY] [LandingPage.tsx](file:///c:/Users/mohit/OneDrive/Desktop/backend%20TAP/apps/web/src/pages/LandingPage.tsx)

- Add the new FAQ section
- Wrap everything in the dark background context
- Ensure sections flow naturally with consistent spacing

---

### App-Level Styles

#### [MODIFY] [App.css](file:///c:/Users/mohit/OneDrive/Desktop/backend%20TAP/apps/web/src/App.css)

- Update focus ring color to match the warm accent palette
- Update selection color to match the warm accent palette

## Verification Plan

### Automated Tests
- Run `npm run build` from `apps/web` to verify no TypeScript or build errors
- Run `npm run dev` and visually inspect the landing page in browser

### Manual Verification
- Verify all landing page sections render correctly
- Confirm navbar, hero, features, how-it-works tabs, FAQ accordion, CTA, and footer all function
- Verify the dashboard/auth pages are NOT affected by the landing page changes
- Check responsive behavior at mobile, tablet, and desktop breakpoints
- Confirm all animations are smooth and not janky
