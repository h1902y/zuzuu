Tag from zuzuu-studio. Use via `window.ZuzuuDS.Tag` (bundle loaded from the root `_ds_bundle.js`).

## Props

```ts
interface TagProps {
children: React.ReactNode; tone?: "default" | "teal" | "accent"; className?: string;
}
```

## Examples

### Categories

```jsx
() => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    <Tag>Web design</Tag>
    <Tag>Branding</Tag>
    <Tag>SEO</Tag>
  </div>
)
```

### Year

```jsx
() => <Tag>2026</Tag>
```
