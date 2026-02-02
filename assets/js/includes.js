async function loadPartial(id, url) {
  const el = document.getElementById(id);
  if (!el) return;

  const res = await fetch(url);
  el.innerHTML = await res.text();
}

loadPartial("site-header", "/partials/header.html");
loadPartial("site-footer", "/partials/footer.html");
