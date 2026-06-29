Badge from zuzuu-studio. Use via `window.ZuzuuDS.Badge` (bundle loaded from the root `_ds_bundle.js`).

## Props

```ts
interface BadgeProps {
children: React.ReactNode; tone?: "orange" | "teal"; className?: string;
}
```

## Examples

### Default

```jsx
() => <Badge>AI-native delivery</Badge>
```

### Status

```jsx
() => <Badge>Now in beta</Badge>
```
