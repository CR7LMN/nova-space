/* ============================================================
 *  INTRO.JS — Logika Intro / Splash Screen (Non-Module)
 *  Menyediakan fallback agar layar intro bisa di-hide
 *  meskipun Three.js gagal dimuat.
 * ============================================================ */

(function () {
  /**
   * hideIntroFallback()
   * Menyembunyikan #intro dengan class "intro--done" (CSS fade-out),
   * lalu setelah 900ms set display:none.
   */
  function hideIntroFallback() {
    var el = document.getElementById("intro");
    if (!el) return;

    el.classList.add("intro--done");
    el.setAttribute("aria-hidden", "true");

    // Tampilkan HUD & floating menu
    var hud = document.getElementById("hud");
    var menu = document.getElementById("floating-menu");
    if (hud) hud.classList.add("ui-ready");
    if (menu) menu.classList.add("ui-ready");

    setTimeout(function () {
      el.style.display = "none";
    }, 900);
  }

  // Simpan di window agar bisa dipanggil dari module utama
  window.__hideIntroFallback = hideIntroFallback;

  // Fallback: jika 5.2 detik intro belum hilang, paksa hide
  setTimeout(hideIntroFallback, 5200);
})();
