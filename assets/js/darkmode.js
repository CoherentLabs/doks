const buttons = document.querySelectorAll('.toggle-theme-mode');

if (buttons !== null) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
    if (event.matches) {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-dark-mode', '');
    } else {
      localStorage.setItem('theme', 'light');
      document.documentElement.removeAttribute('data-dark-mode');
    }
  });

  for (let button of buttons) {
    button.addEventListener('click', () => {
      document.documentElement.toggleAttribute('data-dark-mode');

      const isDarkModeSet = document.documentElement.hasAttribute('data-dark-mode');
      localStorage.setItem('theme', isDarkModeSet ? 'dark' : 'light');
      change_logo();
    });

    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.setAttribute('data-dark-mode', '');
    } else {
      document.documentElement.removeAttribute('data-dark-mode');
    }
    change_logo();
  }
}

function change_logo() {
  // TODO: Do this in a more robust way when we decide on a way to pass meta info
  // to frontend (so we can get product directly instead of relying on the hardcodeed image name)
  const product_logos = document.querySelectorAll('.gfp_logo_icon');
  if (!product_logos.length) return;

  for (let product_logo of product_logos) {
    const isDarkModeSet = document.documentElement.hasAttribute('data-dark-mode');
    let new_logo_src = '';
    if (isDarkModeSet) {
      new_logo_src = product_logo.src.replace('light', 'dark');
    }
    else {
      new_logo_src = product_logo.src.replace('dark', 'light');
    }
    if (new_logo_src != product_logo.src) {
      product_logo.src = new_logo_src;
    }
  }
}
