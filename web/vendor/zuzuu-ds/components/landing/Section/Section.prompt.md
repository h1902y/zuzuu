Section from zuzuu-studio. Use via `window.ZuzuuDS.Section` (bundle loaded from the root `_ds_bundle.js`).

## Props

```ts
interface SectionProps {
id?: string; index?: string; label?: string; lead?: React.ReactNode; leadSize?: "manifesto" | "intro"; action?: React.ReactNode; children?: React.ReactNode; className?: string;
}
```

## Examples

### WithHeading

```jsx
() => (
  <Section
    index="02"
    label="What we do"
    lead="One canonical frame — eyebrow, lead, body, action — so every section reads the same."
  />
)
```

## Related

`SectionHeading`
