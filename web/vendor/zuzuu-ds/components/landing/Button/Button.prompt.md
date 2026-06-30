Button from zuzuu-studio. Use via `window.ZuzuuDS.Button` (bundle loaded from the root `_ds_bundle.js`).

## Props

```ts
interface ButtonProps {
href: string; children: React.ReactNode; variant?: "primary" | "ink" | "outline" | "block"; icon?: unknown; className?: string;
}
```

## Examples

### Primary

```jsx
() => (
  <Button href="#" variant="primary">Start a project</Button>
)
```

### Ink

```jsx
() => (
  <Button href="#" variant="ink">Pitch us</Button>
)
```

### Outline

```jsx
() => (
  <Button href="#" variant="outline">See the approach</Button>
)
```

### Block

```jsx
() => (
  <Button href="#" variant="block">View project</Button>
)
```

### NoIcon

```jsx
() => (
  <Button href="#" variant="primary" icon={null}>Submit</Button>
)
```
