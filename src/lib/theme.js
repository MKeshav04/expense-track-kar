// Dark is the default. The choice is a per-phone convenience, so localStorage is enough;
// index.html applies it before the first paint to avoid a flash.

const BAR_COLORS = { dark: '#17140f', light: '#fff4e0' }

export function getTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function setTheme(theme) {
  if (theme === 'light') document.documentElement.dataset.theme = 'light'
  else delete document.documentElement.dataset.theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLORS[theme])
  try {
    localStorage.setItem('theme', theme)
  } catch {
    /* private mode: works for this session only */
  }
}
