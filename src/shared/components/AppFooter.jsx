/**
 * AppFooter — BGB Group copyright notice.
 * Appears consistently across every dashboard and layout.
 *
 * Props:
 *   variant  "page"    — full-width bar below main content (default)
 *            "sidebar" — compact version inside a sidebar bottom strip
 */
export function AppFooter({ variant = 'page' }) {
  return (
    <footer
      className={`app-footer app-footer--${variant}`}
      aria-label="Copyright notice"
    >
      <p className="app-footer__text">
        © 2026 BGB Group (Pty) Ltd. All Rights Reserved.{' '}
        <span className="app-footer__brand">SafetyMate™</span>
        {' '}– A BGB Group Safety Solution.
      </p>
    </footer>
  )
}
