FeatureCard from zuzuu-studio. Use via `window.ZuzuuDS.FeatureCard` (bundle loaded from the root `_ds_bundle.js`).

## Props

```ts
interface FeatureCardProps {
title: string; body: string;
}
```

## Examples

### Grid

```jsx
() => (
  <CardGrid columns={2}>
    <FeatureCard title="Websites" body="Fast, modern marketing sites and storefronts — built to load and convert." />
    <FeatureCard title="E-commerce stores" body="Shopify + Razorpay + Shiprocket, stood up end to end." />
    <FeatureCard title="Store setup" body="Catalog, theme, policy pages, payments, shipping — the whole stack." />
    <FeatureCard title="The engine" body="Every delivery hardens a repeatable, agentic capability." />
  </CardGrid>
)
```
