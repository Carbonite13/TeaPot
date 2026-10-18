# Frontend quick context

- Stack: Vite 8 + React 19; the application entry point is `src/main.jsx` and the current page is `src/App.jsx`.
- The Vite starter UI (logos, counter, documentation, and social panels) has been removed; `App.jsx` currently renders only the background layer.
- Global visual tokens and page shell live in `src/index.css`; page-specific rules live in `src/App.css`.
- `src/components/GradientASCII.jsx` renders the animated canvas background. It intentionally has no external dependency and respects `prefers-reduced-motion`.
- `App.jsx` owns the fixed `.ascii-background` layer. It sits behind the UI (`z-index: -1`) and ignores pointer events, so controls remain interactive.
- Adjust the background through the `<GradientASCII />` props in `App.jsx`; its component styles are in `src/components/GradientASCII.css`.
- Verify frontend changes with `npm run lint` and `npm run build` from `tea/`.
