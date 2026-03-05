async function loadPartial(id, url) {
  const el = document.getElementById(id);
  if (!el) return;

  const res = await fetch(url);
  el.innerHTML = await res.text();

    // Run footer script after loading
  if (id === "site-footer") {
    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  }

    // Active navigation link
  if (id === "site-header") {
    const links = document.querySelectorAll(".nav-links a");
    const currentPage = window.location.pathname.split("/").pop();

    links.forEach(link => {
      if (link.getAttribute("href") === currentPage) {
        link.classList.add("active");
      }
    });
  }
}

loadPartial("site-header", "/partials/header.html");
loadPartial("site-footer", "/partials/footer.html");
