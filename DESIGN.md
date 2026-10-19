---
name: REAL Institutional Public Identity
description: A restrained institutional identity for China–Serbia materials research.
colors:
  institutional-navy: "#102c49"
  research-teal: "#187e86"
  action-teal: "#197d86"
  action-hover: "#226772"
  secondary-hover: "#25425d"
  hero-accent: "#6ed3ce"
  white: "#fff"
  cooperation-surface: "#edf3f5"
  body-muted: "#4e6374"
  divider: "#c7d8df"
  outline-light: "#afc7d7"
  focus: "#20a4b0"
typography:
  display:
    fontFamily: "Manrope, 'Noto Sans SC', sans-serif"
    fontSize: "clamp(52px, 5.4vw, 88px)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "'Noto Sans SC', system-ui, sans-serif"
    fontSize: "clamp(30px, 3vw, 44px)"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'Noto Sans SC', system-ui, sans-serif"
    fontSize: "17px"
    lineHeight: 1.75
  action:
    fontFamily: "'Noto Sans SC', system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
rounded:
  button: "3px"
spacing:
  compact-gap: "24px"
  column-gap: "80px"
  section: "100px"
components:
  button-primary:
    backgroundColor: "{colors.action-teal}"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.button}"
    padding: "16px 27px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    typography: "{typography.action}"
    rounded: "{rounded.button}"
    padding: "16px 27px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  evidence-panel:
    backgroundColor: "{colors.institutional-navy}"
    textColor: "{colors.white}"
    padding: "42px"
---

# Design System: REAL Institutional Public Identity

## Overview

**Creative North Star: "REAL institutional research"**

The approved public identity combines a white institutional header, deep navy fields, restrained teal accents, and a strong typographic hero. Small original Jiangsu Normal University and University of Belgrade crests establish affiliation; readable bilingual names and generous spacing carry the institutional character.

This document records the implemented homepage and public header/footer from `src/workbench/institutional.css`, `InstitutionalHome.tsx`, and `PublicWorkbenchApp.tsx`, with the approved opening contract in `index.html`. It does not replace the existing evidence-galaxy-v1 visual system, private workbench, or inherited literature/intake components. PRODUCT.md supplies the enduring evidence and accessibility commitments; its broader legacy orange palette is not an instruction to add orange to this public identity.

**Key Characteristics:**

- White, navy, and teal institutional fields.
- Small official university crests and clear bilingual typography.
- Flat, spacious sections with fine rules and limited motion.

## Colors

Primary institutional navy grounds the hero, evidence panel, footer, and main text. Research teal signals interaction; action teal is the implemented button variant. The lighter hero accent supports the Chinese subtitle against navy. These remain distinct observed values, not an invented tonal scale.

White is the default surface; the cool cooperation surface separates a major section. Muted text and thin dividers establish hierarchy without tinted card stacks. The light outline supports the secondary action on dark backgrounds; focus has its own brighter teal.

## Typography

Manrope is the self-hosted Latin display face, declared at weight (800). Noto Sans SC with system fallbacks carries Chinese and body text. Display and section-heading roles are defined above; English value headings use Manrope (36px, 800, line-height 1.4), paired with Chinese labels (22px, 600).

Body copy is generally (17–20px), with relaxed line heights. At the mobile breakpoint, the hero display becomes (43px), section headings (29px), and buttons (16px). Preserve the Latin/Chinese relationship rather than shrinking all text together.

## Layout

The centered content container caps at (1380px), with total horizontal subtraction of (112px). The header caps at (1728px). Desktop sections use two columns, frequently separated by (80px); the foundation uses a (1.15fr / 1fr) split. Major white sections use the section spacing token; cooperation uses (96px).

At (1200px), content margins and column gaps narrow. At (1000px), navigation becomes a toggle-controlled panel, section introductions stack, and the footer becomes two columns. At (600px), the container leaves (20px) per side, content grids stack, section padding becomes (60px), and the decorative outlined REAL letterform disappears. At (1700px) and above, hero minimum height increases to (650px).

## Elevation & Depth

The public identity uses flat tonal fields, whitespace, and one-pixel rules. The only explicit shadow in the institutional stylesheet belongs to the mobile navigation panel (`0 12px 22px #102c4914`); it separates the temporary menu from page content. Do not extrapolate this into elevated content cards.

## Shapes

Section panels are rectangular. Actions use only a slight corner softening through the button radius token. University assets retain their original proportions with `object-fit: contain`: desktop image boxes are (46 × 56px), mobile boxes (29 × 40px). The crests are small identifiers at the top left, not a large decorative strip.

## Components

**Actions:** Filled teal and outlined transparent variants share padding and typography; the outlined action belongs on navy. Hover changes the background over (0.15s). Links and buttons have a (3px) teal focus outline offset by (5px). Mobile actions use (12px 16px) padding. CSS transitions are disabled under reduced-motion preference; route scrolling behavior is owned by the application code.

**Navigation:** A sticky white header combines compact university identities on the left and horizontal navigation on the right. Hover and current location use teal text and a bottom rule. At the menu breakpoint, an accessible toggle exposes the navigation; Escape and route changes close it. A skip link appears on focus.

**Value articles:** Open, two-column text groups use top rules rather than card boxes. English headings and Chinese labels share a baseline; supporting copy is muted. They stack on mobile.

**Evidence panel:** A navy rectangle combines an existing evidence-interface preview, explanatory copy, and a text link. Public record and DOI counts come from the loaded snapshot; missing values remain placeholders. This preview does not redefine the underlying interactive database.

**Entry links and footer:** Entry links are divided rows with right-aligned arrows. The footer returns to navy, groups platform and institution information, then ends with a fine rule and small closing line.

## Do's and Don'ts

- Do preserve the approved white header, navy hero, teal accents, and small official university identities.
- Do keep keyboard focus visible and state labels understandable without color alone.
- Do derive displayed research counts from the current public snapshot.
- Don't add photographs or a large crest strip to this approved public identity.
- Don't restyle evidence-galaxy-v1 or the private workbench under this document's scope.
- Don't introduce unsupported claims, invented metrics, or decorative model-number orbits.
