// Header scroll effect
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
   if (window.scrollY > 100) {
      header.classList.add('scrolled');
   } else {
      header.classList.remove('scrolled');
   }
});

// Mobile navigation
const menuToggle = document.getElementById('menuToggle');
const mobileNav = document.getElementById('mobileNav');
const mobileOverlay = document.getElementById('mobileOverlay');
const mobileNavClose = document.getElementById('mobileNavClose');
const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');

function openMobileNav() {
   mobileNav.classList.add('active');
   mobileOverlay.classList.add('active');
   document.body.style.overflow = 'hidden';
}

function closeMobileNav() {
   mobileNav.classList.remove('active');
   mobileOverlay.classList.remove('active');
   document.body.style.overflow = '';
}

menuToggle.addEventListener('click', openMobileNav);
mobileNavClose.addEventListener('click', closeMobileNav);
mobileOverlay.addEventListener('click', closeMobileNav);

mobileNavLinks.forEach(link => {
   link.addEventListener('click', closeMobileNav);
});

// Sign up modal and Dengage contact key
const USER_STORAGE_KEY = 'cantupneus_user';
const SIGNUP_FIELD_IDS = ['loginFirstName', 'loginLastName', 'loginEmail', 'loginPassword'];

const loginButtons = document.querySelectorAll('[data-login-btn]');
const loginModal = document.getElementById('loginModal');
const closeLoginButtons = document.querySelectorAll('[data-close-login]');
const loginForm = document.getElementById('loginForm');
const loginFormError = document.getElementById('loginFormError');
const loginSuccessMessage = document.getElementById('loginSuccessMessage');
let loginSuccessTimer;

function openLoginModal() {
   if (!loginModal) return;
   loginModal.classList.add('active');
   loginModal.setAttribute('aria-hidden', 'false');
   document.body.style.overflow = 'hidden';

   const firstNameInput = document.getElementById('loginFirstName');
   if (firstNameInput) {
      firstNameInput.focus();
   }
}

function closeLoginModal() {
   if (!loginModal) return;
   loginModal.classList.remove('active');
   loginModal.setAttribute('aria-hidden', 'true');
   document.body.style.overflow = '';
}

function clearSignupErrors() {
   SIGNUP_FIELD_IDS.forEach(id => {
      const input = document.getElementById(id);
      if (input) input.classList.remove('invalid');
   });
   if (loginFormError) {
      loginFormError.hidden = true;
      loginFormError.textContent = '';
   }
}

function setSignupError(message) {
   if (!loginFormError) return;
   loginFormError.textContent = message;
   loginFormError.hidden = false;
}

loginButtons.forEach(button => {
   button.addEventListener('click', () => {
      closeMobileNav();
      clearSignupErrors();
      openLoginModal();
   });
});

closeLoginButtons.forEach(button => {
   button.addEventListener('click', closeLoginModal);
});

SIGNUP_FIELD_IDS.forEach(id => {
   const input = document.getElementById(id);
   if (!input) return;
   input.addEventListener('input', () => {
      if (input.value.trim()) {
         input.classList.remove('invalid');
      }
      if (loginFormError && !loginFormError.hidden) {
         const stillInvalid = SIGNUP_FIELD_IDS.some(fid => {
            const el = document.getElementById(fid);
            return el && !el.value.trim();
         });
         if (!stillInvalid) {
            loginFormError.hidden = true;
            loginFormError.textContent = '';
         }
      }
   });
});

function showLoginSuccessMessage(firstName) {
   if (!loginSuccessMessage) return;

   clearTimeout(loginSuccessTimer);
   loginSuccessMessage.textContent = firstName
      ? `Welcome to CantuPneus, ${firstName}!`
      : 'Welcome to CantuPneus.';
   loginSuccessMessage.classList.add('active');

   loginSuccessTimer = setTimeout(() => {
      loginSuccessMessage.classList.remove('active');
   }, 2000);
}

document.addEventListener('keydown', event => {
   if (event.key === 'Escape' && loginModal && loginModal.classList.contains('active')) {
      closeLoginModal();
   }
});

if (loginForm) {
   loginForm.addEventListener('submit', event => {
      event.preventDefault();

      const firstName = (document.getElementById('loginFirstName')?.value || '').trim();
      const lastName = (document.getElementById('loginLastName')?.value || '').trim();
      const email = (document.getElementById('loginEmail')?.value || '').trim();
      const password = document.getElementById('loginPassword')?.value || '';

      const values = {
         loginFirstName: firstName,
         loginLastName: lastName,
         loginEmail: email,
         loginPassword: password
      };

      let firstInvalidInput = null;
      SIGNUP_FIELD_IDS.forEach(id => {
         const input = document.getElementById(id);
         if (!input) return;
         if (!values[id]) {
            input.classList.add('invalid');
            if (!firstInvalidInput) firstInvalidInput = input;
         } else {
            input.classList.remove('invalid');
         }
      });

      if (firstInvalidInput) {
         setSignupError('Fill in all fields to continue.');
         firstInvalidInput.focus();
         return;
      }

      try {
         localStorage.setItem(USER_STORAGE_KEY, JSON.stringify({
            firstName: firstName,
            lastName: lastName,
            email: email
         }));
      } catch (err) {
         console.error('Could not save the user data to localStorage', err);
      }

      /* Send the resolved CONTACT KEY, not the raw email. A Dengage contact can
         have any contact_key, and sending the email instead created a second
         contact so nothing attached to the real one. js/identity.js owns the
         mapping. The queue stub means dengage() always exists, so no polling. */
      var signupKey = (window.DengageIdentity && window.DengageIdentity.adopt(email)) || email;
      if (typeof window.dengage === 'function') {
         window.dengage('setContactKey', signupKey);
      }

      const userId = 'CANTU-' + Math.floor(10000 + Math.random() * 90000);
      const signupTime = new Date().toLocaleString();

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
         event: 'sign_up',
         user: {
            userId: userId,
            firstName: firstName,
            lastName: lastName,
            email: email,
            signupMethod: 'email',
            passwordEntered: password.length > 0,
            signupTime: signupTime
         },
         businessType: 'pneus'
      });

      loginForm.reset();
      clearSignupErrors();
      closeLoginModal();
      showLoginSuccessMessage(firstName);
   });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
   anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      if (href === '#') {
         window.scrollTo({
            top: 0,
            behavior: 'smooth'
         });
         return;
      }
      const target = document.querySelector(href);
      if (target) {
         const headerHeight = header.offsetHeight;
         const targetPosition = target.offsetTop - headerHeight;
         window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
         });
      }
   });
});

// Hero image slideshow
const slides = document.querySelectorAll('.hero-slide');
const heroTitle = document.getElementById('heroTitle');
const heroPrice = document.getElementById('heroPrice');
let currentSlide = 0;

function changeSlide() {
   slides[currentSlide].classList.remove('active');
   currentSlide = (currentSlide + 1) % slides.length;

   // Fade out text
   heroTitle.style.opacity = '0';
   heroPrice.style.opacity = '0';

   setTimeout(() => {
      heroTitle.textContent = slides[currentSlide].dataset.title;
      heroPrice.textContent = slides[currentSlide].dataset.price;
      heroTitle.style.opacity = '1';
      heroPrice.style.opacity = '1';
   }, 500);

   slides[currentSlide].classList.add('active');
}

setInterval(changeSlide, 4000);

/* ----------------------------------------------------------------------------
   Scroll reveal for sections.

   threshold MUST stay 0. A fractional threshold is a share of the OBSERVED
   ELEMENT's area, not of the viewport, so a section taller than
   viewportHeight / threshold can never satisfy it and stays invisible forever.
   That is exactly what happened with threshold 0.1: on a 512px viewport the
   products section is about 10900px tall, so it needed 1090px on screen inside
   an 800px window. The whole product catalogue was permanently invisible on
   mobile, while desktop looked fine because the same section is only ~2600px
   there. With 0 a section reveals as soon as any part of it crosses the
   rootMargin line, at any viewport size.

   The hidden starting state is only applied when IntersectionObserver exists.
   If it does not, nothing hides the sections and the page renders plainly,
   rather than leaving the entire page at opacity 0 with no way back.
---------------------------------------------------------------------------- */
if ('IntersectionObserver' in window) {
   const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
         if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
         }
      });
   }, { threshold: 0, rootMargin: '0px 0px -50px 0px' });

   document.querySelectorAll('section:not(.hero)').forEach(section => {
      section.style.opacity = '0';
      section.style.transform = 'translateY(30px)';
      section.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
      observer.observe(section);
   });
}

/* ----------------------------------------------------------------------------
   Identidade Dengage

   O SDK guarda o contact key entre páginas, mas o visitante da demo costuma
   se cadastrar em uma aba e navegar em outra. Reafirmar a chave no load deixa
   o comportamento previsível durante a apresentação.
---------------------------------------------------------------------------- */
(function restoreDengageIdentity() {
   let stored = null;
   try {
      stored = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null');
   } catch (err) {
      return;
   }
   if (!stored || !stored.email) return;

   /* identity.js already fed this key into initialize() in the head, so this is
      only a safety net and it is idempotent. It used to be a setInterval that
      polled for up to five seconds, which meant pageView went out anonymous
      before the contact key ever arrived. */
   const restoreKey = (window.DengageIdentity && window.DengageIdentity.contactKey)
      || (window.DengageIdentity && window.DengageIdentity.keyFor(stored.email))
      || stored.email;
   try { window.dengage('setContactKey', restoreKey); } catch (err) { /* noop */ }
})();
