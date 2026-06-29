Section from zuzuu-studio. Use via `window.ZuzuuDS.Section` (bundle loaded from the root `_ds_bundle.js`).

## Props

```ts
interface SectionProps {
id?: string; children: React.ReactNode; className?: string;
}
```

## Examples

### WithHeading

```jsx
() => (
  <Section>
    <SectionHeading index="02" label="What we do" />
    <CardGrid columns={2}>
      <FeatureCard title="Websites" body="Fast, modern marketing sites and storefronts." />
      <FeatureCard title="Store setup" body="Catalog, theme, policy pages, payments, shipping." />
    </CardGrid>
  </Section>
)
```

## Related

`SectionHeading`
