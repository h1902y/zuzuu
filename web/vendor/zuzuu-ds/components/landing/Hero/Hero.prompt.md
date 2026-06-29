Hero from zuzuu-studio. Use via `window.ZuzuuDS.Hero` (bundle loaded from the root `_ds_bundle.js`).

## Props

```ts
interface HeroProps {
badge: string; title: string; subtitle: string; actions: { label: string; href: string; variant?: "primary" | "ink" | "outline" }[]; stats: { value: string; label: string }[];
}
```

## Examples

### Default

```jsx
() => (
  <Hero
    badge="AI-native delivery"
    title="Websites and e-commerce stores, built like infrastructure."
    subtitle="We ship one storefront at a time — and turn every manual step into a repeatable, agentic capability."
    actions={[
      { label: "Start a project", href: "#", variant: "primary" },
      { label: "See the approach", href: "#", variant: "outline" },
    ]}
    stats={[
      { value: "Build", label: "Storefronts" },
      { value: "Systematize", label: "Repeatable setup" },
      { value: "Compound", label: "Agentic engine" },
    ]}
  />
)
```
