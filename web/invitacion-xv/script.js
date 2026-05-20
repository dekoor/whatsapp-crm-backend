// Scroll suave al tocar el indicador de la portada.
// Por ahora solo hay portada; cuando agreguemos secciones siguientes,
// este botón hará scroll hacia la primera de ellas.
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector(".portada__scroll");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const siguiente = document.querySelector(".portada")?.nextElementSibling;
    if (siguiente) {
      siguiente.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
    }
  });
});
