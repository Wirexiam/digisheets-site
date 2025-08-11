/* ===== Бургер и меню ===== */
document.addEventListener("DOMContentLoaded", () => {
  const burger  = document.getElementById('burger');
  const navList = document.getElementById('navList');

  if (burger && navList){
    burger.addEventListener('click', () => {
      const open = burger.classList.toggle('active');
      navList.classList.toggle('show', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navList.querySelectorAll('a').forEach(link=>{
      link.addEventListener('click',()=>{
        burger.classList.remove('active');
        navList.classList.remove('show');
        burger.setAttribute('aria-expanded','false');
      });
    });
  }

  /* ===== Плавный скролл и подсветка активного пункта ===== */
  const navLinks = document.querySelectorAll(".nav-link[href^='#']");
  navLinks.forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const id = link.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  const sections = Array.from(document.querySelectorAll("[id]"))
    .filter(el => document.querySelector(`a[href="#${el.id}"]`));

  function highlightActiveLink(){
    const y = window.pageYOffset;
    sections.forEach(section=>{
      const top = section.offsetTop - 120;
      const bottom = top + section.offsetHeight;
      const id = section.id;
      const isActive = y >= top && y < bottom;
      navLinks.forEach(a => {
        if (a.getAttribute("href") === `#${id}`) a.classList.toggle("active", isActive);
      });
    });
  }
  window.addEventListener("scroll", highlightActiveLink);
  highlightActiveLink();

  /* ===== Ручной переключатель темы (light/dark) ===== */
  const root = document.documentElement;
  const toggleBtn = document.getElementById('themeToggle');

  function applyTheme(theme){
    root.setAttribute('data-theme', theme);
    localStorage.setItem('ds-theme', theme);
    if (toggleBtn){
      toggleBtn.textContent = theme === 'dark' ? '☀️ Светлая' : '🌙 Тёмная';
      toggleBtn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    }
  }

  // Инициализация из localStorage (по умолчанию — light)
  const saved = localStorage.getItem('ds-theme');
  applyTheme(saved === 'dark' ? 'dark' : 'light');

  toggleBtn?.addEventListener('click', ()=>{
    const current = root.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
});

/* ===== Walkthrough slider (vanilla) ===== */
(function(){
  const root = document.getElementById('walkthrough');
  if (!root) return;

  const track   = root.querySelector('.wt-track');
  const slides  = Array.from(root.querySelectorAll('.wt-slide'));
  const prevBtn = root.querySelector('.wt-prev');
  const nextBtn = root.querySelector('.wt-next');
  const caption = document.getElementById('wtCaption');
  const counter = document.getElementById('wtCounter');

  if (!track || !slides.length) return;

  let index = 0;

  function update(){
    const x = -index * 100;
    track.style.transform = `translateX(${x}%)`;
    const cap = slides[index].dataset.caption || '';
    if (caption) caption.textContent = cap;
    if (counter) counter.textContent = `${index+1} / ${slides.length}`;
  }

  prevBtn?.addEventListener('click', ()=>{ index = (index - 1 + slides.length) % slides.length; update(); });
  nextBtn?.addEventListener('click', ()=>{ index = (index + 1) % slides.length; update(); });

  // Перелистывание стрелками с клавиатуры в фокусе вьюпорта
  const viewport = root.querySelector('.wt-viewport');
  viewport?.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowRight'){ nextBtn?.click(); }
    else if (e.key === 'ArrowLeft'){ prevBtn?.click(); }
  });

  // Свайпы на мобильных
  let startX = 0; let dx = 0; let dragging = false;
  viewport?.addEventListener('touchstart', (e)=>{ dragging=true; startX=e.touches[0].clientX; dx=0; }, {passive:true});
  viewport?.addEventListener('touchmove',  (e)=>{ if(!dragging) return; dx = e.touches[0].clientX - startX; }, {passive:true});
  viewport?.addEventListener('touchend',   ()=>{
    if (!dragging) return;
    dragging=false;
    if (Math.abs(dx) > 40){
      if (dx < 0) nextBtn?.click(); else prevBtn?.click();
    }
  });

  update();
})();

(function(){
  const grid = document.querySelector('.cases__grid');
  if (!grid) return;

  function setHeightToFace(card, face){
    card.style.height = face.scrollHeight + 'px';
  }
  function currentFace(card){
    return card.classList.contains('is-flipped')
      ? card.querySelector('.case-back')
      : card.querySelector('.case-front');
  }

  // начальная высота
  grid.querySelectorAll('.case-card').forEach(card=>{
    setHeightToFace(card, card.querySelector('.case-front'));
  });

  // клики
  grid.addEventListener('click', e=>{
    const more = e.target.closest('.case-more');
    const back = e.target.closest('.case-back-btn');
    if (!more && !back) return;

    const card = e.target.closest('.case-card');
    if (!card) return;

    const targetFace = back
      ? card.querySelector('.case-front')
      : card.querySelector('.case-back');

    setHeightToFace(card, targetFace);

    requestAnimationFrame(()=>{
      if (more) card.classList.add('is-flipped');
      if (back) card.classList.remove('is-flipped');
    });
  });

  // доступность
  grid.addEventListener('keydown', e=>{
    const card = e.target.closest('.case-card');
    if (!card) return;
    if (e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      const toBack = !card.classList.contains('is-flipped');
      const targetFace = toBack ? card.querySelector('.case-back') : card.querySelector('.case-front');
      setHeightToFace(card, targetFace);
      requestAnimationFrame(()=> card.classList.toggle('is-flipped'));
    }
  });

  // ресайз
  window.addEventListener('resize', ()=>{
    grid.querySelectorAll('.case-card').forEach(card=>{
      setHeightToFace(card, currentFace(card));
    });
  });
})();

/* ===== Walkthrough: клик по картинке -> лайтбокс (мобилки) ===== */
(function(){
  if (!window.matchMedia('(max-width: 768px)').matches) return;

  const imgs = document.querySelectorAll('#walkthrough .wt-slide img');
  if (!imgs.length) return;

  // Оверлей создаём один раз
  const overlay = document.createElement('div');
  overlay.className = 'wt-lightbox';
  overlay.innerHTML = '<button class="wt-lightbox__close" aria-label="Закрыть">✕</button><img class="wt-lightbox__img" alt="">';
  document.body.appendChild(overlay);

  const lbImg   = overlay.querySelector('.wt-lightbox__img');
  const lbClose = overlay.querySelector('.wt-lightbox__close');

  function open(src, alt){
    lbImg.src = src;
    lbImg.alt = alt || '';
    overlay.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden'; // блокируем скролл фона
  }
  function close(){
    overlay.classList.remove('is-open');
    lbImg.src = '';
    document.documentElement.style.overflow = '';
  }

  imgs.forEach(img=>{
    img.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation(); // чтобы свайп слайдера не мешал
      open(img.currentSrc || img.src, img.alt);
    });
  });

  lbClose.addEventListener('click', close);
  overlay.addEventListener('click', (e)=>{ if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') close(); });
})();


/* ===== GUIDE: вкладки + пошаговый просмотр ===================== */
(function(){
  const guide = document.querySelector('#guide');
  if (!guide) return;

  const tabs = Array.from(guide.querySelectorAll('.guide-tab'));
  const panels = Array.from(guide.querySelectorAll('.guide-panel'));

  // Вспомогательные
  const byId = id => guide.querySelector('#'+id);
  const setActiveTab = (tab) => {
    tabs.forEach(t=>{
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
      byId(t.getAttribute('aria-controls')).classList.toggle('is-active', active);
      // при смене вкладки всегда показываем первую карточку
      resetPanel(byId(t.getAttribute('aria-controls')));
    });
  };

  const resetPanel = (panel) => {
    const cards = Array.from(panel.querySelectorAll('.guide-card'));
    cards.forEach(c=>c.classList.remove('is-active'));
    if (cards[0]) cards[0].classList.add('is-active');
    const counter = panel.querySelector('.guide-counter');
    if (counter) counter.textContent = `1 / ${cards.length}`;
  };

  // Навигация карточек
  const showCard = (panel, dir) => {
  const cards = Array.from(panel.querySelectorAll('.guide-card'));
  const activeIndex = cards.findIndex(c => c.classList.contains('is-active'));
  if (activeIndex === -1) return;
  const next = (activeIndex + dir + cards.length) % cards.length;

  // убираем активную
  cards[activeIndex].classList.remove('is-active');
  // даём время на анимацию ухода
  setTimeout(() => {
    cards[next].classList.add('is-active');
  }, 20);

  const counter = panel.querySelector('.guide-counter');
  if (counter) counter.textContent = `${next + 1} / ${cards.length}`;
};


  // Клики по табам
  tabs.forEach(tab=>{
    tab.addEventListener('click', ()=> setActiveTab(tab));
    tab.addEventListener('keydown', (e)=>{
      // стрелочная навигация по вкладкам
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const i = tabs.indexOf(tab);
        const n = e.key === 'ArrowRight'
          ? (i+1) % tabs.length
          : (i-1+tabs.length) % tabs.length;
        tabs[n].focus();
        setActiveTab(tabs[n]);
      }
    });
  });

  // Стрелки внутри панелей
  panels.forEach(panel=>{
    const prev = panel.querySelector('.guide-prev');
    const next = panel.querySelector('.guide-next');
    prev?.addEventListener('click', ()=> showCard(panel, -1));
    next?.addEventListener('click', ()=> showCard(panel, +1));

    // стрелки клавиатуры, когда фокус в панели
    panel.addEventListener('keydown', (e)=>{
      if (e.key === 'ArrowRight') { e.preventDefault(); showCard(panel, +1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); showCard(panel, -1); }
    });
  });

  // Инициализация
  setActiveTab(byId('tab-start'));
})();

/* ===== TESTIMONIALS: слайдер отзывов ========================== */
(function(){
  const root = document.querySelector('#testimonials');
  if (!root) return;

  const track   = root.querySelector('.ts-track');
  const cards   = Array.from(root.querySelectorAll('.ts-card'));
  const prevBtn = root.querySelector('.ts-prev');
  const nextBtn = root.querySelector('.ts-next');
  const counter = root.querySelector('#tsCounter');
  const viewport= root.querySelector('.ts-viewport');

  if (!cards.length) return;

  let index = 0;

  function show(i){
    cards.forEach(c => c.classList.remove('is-active'));
    cards[i].classList.add('is-active');
    if (counter) counter.textContent = `${i+1} / ${cards.length}`;
  }

  prevBtn?.addEventListener('click', ()=>{
    index = (index - 1 + cards.length) % cards.length;
    show(index);
  });
  nextBtn?.addEventListener('click', ()=>{
    index = (index + 1) % cards.length;
    show(index);
  });

  // Клавиатура: стрелки влево/вправо, если фокус в вьюпорте
  viewport?.addEventListener('keydown', (e)=>{
    if (e.key === 'ArrowRight'){ nextBtn?.click(); }
    if (e.key === 'ArrowLeft'){  prevBtn?.click(); }
  });

  // Свайпы на мобильных
  let startX=0, dx=0, dragging=false;
  viewport?.addEventListener('touchstart', (e)=>{ dragging=true; startX=e.touches[0].clientX; dx=0; }, {passive:true});
  viewport?.addEventListener('touchmove',  (e)=>{ if(!dragging) return; dx = e.touches[0].clientX - startX; }, {passive:true});
  viewport?.addEventListener('touchend',   ()=>{
    if (!dragging) return; dragging=false;
    if (Math.abs(dx) > 40){ if (dx < 0) nextBtn?.click(); else prevBtn?.click(); }
  });

  // Инициализация
  show(index);
})();

/* ===== FAQ: доступный аккордеон с плавной высотой ============= */
(function(){
  const root = document.querySelector('#faq');
  if (!root) return;

  const items = Array.from(root.querySelectorAll('.faq-item'));

  // утилиты
  const openItem = (item) => {
    const btn = item.querySelector('.faq-toggle');
    const panel = item.querySelector('.faq-a');
    if (!btn || !panel) return;

    // раскрываем
    item.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    panel.hidden = false;

    // анимируем max-height до фактической высоты контента
    panel.style.maxHeight = panel.scrollHeight + 'px';
  };

  const closeItem = (item) => {
    const btn = item.querySelector('.faq-toggle');
    const panel = item.querySelector('.faq-a');
    if (!btn || !panel) return;

    item.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');

    // анимируем закрытие
    panel.style.maxHeight = panel.scrollHeight + 'px'; // фиксация текущей
    // кадр спустя — уводим к нулю
    requestAnimationFrame(() => {
      panel.style.maxHeight = '0px';
    });

    // после завершения transition прячем от ассистивных технологий
    const onEnd = (e) => {
      if (e.propertyName !== 'max-height') return;
      panel.hidden = true;
      panel.removeEventListener('transitionend', onEnd);
    };
    panel.addEventListener('transitionend', onEnd);
  };

  const toggleItem = (item) => {
    if (item.classList.contains('is-open')) closeItem(item);
    else openItem(item);
  };

  // делегирование кликов
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.faq-toggle');
    if (!btn) return;
    const item = btn.closest('.faq-item');
    if (!item) return;

    // если нужен режим "только один открыт" — закрываем остальные:
    items.forEach(i => { if (i !== item && i.classList.contains('is-open')) closeItem(i); });

    toggleItem(item);
  });

  // клавиатура: Enter/Space на кнопке уже работают по умолчанию
  // стрелочная навигация между вопросами
  root.addEventListener('keydown', (e) => {
    const currentBtn = e.target.closest('.faq-toggle');
    if (!currentBtn) return;

    const btns = Array.from(root.querySelectorAll('.faq-toggle'));
    const i = btns.indexOf(currentBtn);
    if (i < 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      btns[(i + 1) % btns.length].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      btns[(i - 1 + btns.length) % btns.length].focus();
    }
  });

  // ресайз: если ответ открыт — пересчитать max-height
  window.addEventListener('resize', () => {
    items.forEach(item => {
      if (!item.classList.contains('is-open')) return;
      const panel = item.querySelector('.faq-a');
      if (panel) panel.style.maxHeight = panel.scrollHeight + 'px';
    });
  });
})();
