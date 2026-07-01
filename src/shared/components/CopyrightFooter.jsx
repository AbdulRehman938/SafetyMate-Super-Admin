export function CopyrightFooter({ variant = 'dashboard', className = '' }) {
  const classes = ['shell-copyright', `shell-copyright--${variant}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <footer className={classes} aria-label="Copyright footer">
      © 2026 BGB Group (Pty) Ltd. All Rights Reserved. SafetyMate™ – A BGB Group Safety Solution.
    </footer>
  )
}
