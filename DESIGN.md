---
name: HireSignal
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#e9bcb9'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#b08784'
  outline-variant: '#5f3e3d'
  surface-tint: '#ffb3af'
  primary: '#ffb3af'
  on-primary: '#68000e'
  primary-container: '#ff5357'
  on-primary-container: '#5c000b'
  inverse-primary: '#bf0024'
  secondary: '#c6c6c7'
  on-secondary: '#2f3131'
  secondary-container: '#454747'
  on-secondary-container: '#b4b5b5'
  tertiary: '#e9c400'
  on-tertiary: '#3a3000'
  tertiary-container: '#c9a900'
  on-tertiary-container: '#4c3e00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad8'
  primary-fixed-dim: '#ffb3af'
  on-primary-fixed: '#410006'
  on-primary-fixed-variant: '#930019'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#ffe16d'
  tertiary-fixed-dim: '#e9c400'
  on-tertiary-fixed: '#221b00'
  on-tertiary-fixed-variant: '#544600'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-xl:
    fontFamily: Bebas Neue
    fontSize: 120px
    fontWeight: '700'
    lineHeight: 100px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Bebas Neue
    fontSize: 72px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Bebas Neue
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Bebas Neue
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: 0em
  body-lg:
    fontFamily: Chivo
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 30px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Chivo
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Chivo
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
spacing:
  margin-edge: 4rem
  margin-mobile: 1.5rem
  gutter: 1rem
  stack-xl: 8rem
  stack-lg: 4rem
  stack-md: 2rem
---

## Brand & Style

This design system is built on a foundation of **activist brutalism**. It rejects the soft, rounded friendliness of modern SaaS in favor of a defiant, high-contrast aesthetic that feels urgent and unpolished. The visual language is inspired by guerrilla street posters, protest flyers, and stenciled underground movements.

The personality is raw and uncompromising. It uses heavy-handed visual cues like redaction bars, paper grain textures, and hazard patterns to communicate a sense of "a little dangerous" accountability. Every element is designed to feel like it was stamped or wheat-pasted onto a digital wall.

## Colors

The palette is intentionally sparse and aggressive. 

*   **Base:** A near-black (#0A0A0A) serves as the "void" background, providing maximum contrast for the content.
*   **Primary:** A high-intensity Signal Red (#FF0033) is used for calls to action, alerts, and critical branding. It should feel like it's vibrating against the black.
*   **Text & Accents:** Stark White is used for primary reading and secondary accents to maintain a clean, editorial hierarchy.
*   **Tertiary:** A sharp, metallic Gold (derived from the reference image) is used sparingly for high-level status indicators or "seal of approval" elements to mimic official stencils.

## Typography

Typography is the primary weapon of the design system. 

**Headlines** must be set in uppercase with tight tracking to create a monolithic block of text. For large display moments, the text should push the boundaries of the viewport, occasionally breaking onto multiple lines to maximize impact.

**Body text** uses a sharp sans-serif to maintain readability while feeling clinical and direct. Avoid long line lengths; keep columns narrow to mimic newspaper or manifesto layouts. Use "Redaction" styling (black background with white text) for emphasized keywords within body paragraphs.

## Layout & Spacing

The layout philosophy is defined by **Hard-Left Alignment** and **Intentional Imbalance**. 

*   **Grid:** A standard 12-column grid is used, but content should rarely be centered. Align primary content to the far left.
*   **Negative Space:** Use massive vertical gaps (stack-xl) between sections to force the user to focus on one singular "demand" or piece of information at a time.
*   **Safe Zones:** On desktop, maintain a minimum 4rem margin to frame the content like a framed piece of protest art.
*   **Mobile:** Content reflows into a single column, but headlines should remain as large as possible, often spanning the full width of the screen.

## Elevation & Depth

This design system is strictly flat. It rejects the concept of "z-space" created by shadows or blurs.

*   **Tonal Layering:** Depth is achieved through color blocking. Use Signal Red or Stark White containers to "lift" content off the #0A0A0A background.
*   **Redaction Bars:** Use solid black bars to obscure or highlight information. These act as high-priority overlays.
*   **Textures:** Apply a subtle paper grain or halftone film grain across the entire UI to reduce the "digital" perfection and give the interface a physical, printed quality.
*   **Outlines:** Use 2px or 4px solid borders for containers. No rounded corners.

## Shapes

The shape language is strictly **Sharp (0)**. There are no rounded corners in this design system. Every button, input, card, and image container must have 90-degree angles. This reinforces the "raw" and "industrial" nature of the protest aesthetic.

## Components

*   **Buttons:** These should look like stenciled stamps. Use a solid Signal Red background with white uppercase text. On hover, the button should invert to white background with red text. No transitions; the state change should be instant and jarring.
*   **Input Fields:** Use thick white borders (2px) on the bottom only, or a full box with a high-contrast label that sits outside the box. 
*   **Hazard Stripes:** Use diagonal red and black "hazard" stripes as a divider for critical warnings or "high-risk" areas of the site (e.g., submitting a formal complaint).
*   **Chips/Tags:** These should look like small pieces of label-maker tape. Sharp corners, black background, white mono-style text.
*   **Cards:** Do not use shadows. Define cards with a simple 1px white border. If a card is "active," fill it with a subtle grain texture or a solid red border.
*   **Lists:** Use large numerals (Bebas Neue) as bullets to create a "list of demands" feel.