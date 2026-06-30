StatStrip from zuzuu-studio. Use via `window.ZuzuuDS.StatStrip` (bundle loaded from the root `_ds_bundle.js`).

## Props

```ts
interface StatStripProps {
items: { value: string; label: string }[];
}
```

## Examples

### ThreeUp

```jsx
() => (
  <StatStrip
    items={[
      { value: "Build", label: "Storefronts" },
      { value: "Systematize", label: "Repeatable setup" },
      { value: "Compound", label: "Agentic engine" },
    ]}
  />
)
```

### Metrics

```jsx
() => (
  <StatStrip
    items={[
      { value: "12+", label: "Deliveries" },
      { value: "4", label: "Engagement types" },
    ]}
  />
)
```
