document.addEventListener("DOMContentLoaded", () => {
  const swiperEl = document.querySelector(".digiup-swiper");
  if (!swiperEl) return;

  new Swiper(".digiup-swiper", {
    effect: "coverflow",
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: "auto",
    loop: true, // 🔥 цикл включён
    coverflowEffect: {
      rotate: 0,
      stretch: 0,
      depth: 200,
      modifier: 2.5,
      slideShadows: false
    },
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev"
    }
  });
});
