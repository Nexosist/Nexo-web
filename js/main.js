/**
 * NEXO SISTEMAS CONSTRUCTIVOS - INTERACTIVE ENGINE
 * Features: Sticky Nav, Mobile Menu, Budget Calculator Modal, 
 * vCard Contact Downloader, Project Filtering & Lightbox Modal
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. Sticky Navigation & Active Section Highlighting ---
  const header = document.querySelector('.site-header');
  const sections = document.querySelectorAll('section[id], header[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  const mobileToggle = document.querySelector('.mobile-toggle');
  const headerNav = document.querySelector('.header-nav');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Active Section Detection
    let currentId = '';
    const scrollPos = window.scrollY + 140;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
        currentId = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('active');
      }
    });
  });

  // Mobile Menu Toggle
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      headerNav.classList.toggle('active');
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        headerNav.classList.remove('active');
      });
    });
  }

  // --- 2. Project Filtering Logic ---
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.obra-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');

      projectCards.forEach(card => {
        const cardCategory = card.getAttribute('data-category');
        if (filterValue === 'all' || cardCategory === filterValue) {
          card.style.display = 'flex';
          setTimeout(() => { card.style.opacity = '1'; }, 10);
        } else {
          card.style.opacity = '0';
          setTimeout(() => { card.style.display = 'none'; }, 200);
        }
      });
    });
  });

  // --- 3. Budget Calculator Modal (SOLICITAR PRESUPUESTO) ---
  const modalPresupuesto = document.getElementById('modal-presupuesto');
  const btnOpenPresupuesto = document.querySelectorAll('.trigger-presupuesto');
  const closeBtns = document.querySelectorAll('.modal-close-btn, .modal-overlay');

  const calcService = document.getElementById('calc-service');
  const calcArea = document.getElementById('calc-area');
  const calcAreaVal = document.getElementById('calc-area-val');
  const calcLocation = document.getElementById('calc-location');
  const calcPriceEst = document.getElementById('calc-price-est');
  const btnSendCalcWs = document.getElementById('btn-send-calc-ws');

  // Rates approximation per m2 for quick estimate (in USD / reference value)
  const serviceRates = {
    'steel_frame': 420,
    'placas_yeso': 75,
    'cielorrasos': 65,
    'remodelacion': 280,
    'llave_en_mano': 580
  };

  function updateCalculation() {
    if (!calcArea || !calcService) return;
    const area = parseInt(calcArea.value, 10);
    const service = calcService.value;
    calcAreaVal.textContent = `${area} m²`;

    const rate = serviceRates[service] || 350;
    const minEst = (area * rate * 0.9).toLocaleString('es-AR');
    const maxEst = (area * rate * 1.15).toLocaleString('es-AR');
    calcPriceEst.textContent = `$${minEst} - $${maxEst} USD`;
  }

  if (calcArea && calcService) {
    calcArea.addEventListener('input', updateCalculation);
    calcService.addEventListener('change', updateCalculation);
    updateCalculation();
  }

  // Open Presupuesto Modal
  btnOpenPresupuesto.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(modalPresupuesto);
    });
  });

  // Send Presupuesto to WhatsApp
  if (btnSendCalcWs) {
    btnSendCalcWs.addEventListener('click', (e) => {
      e.preventDefault();
      const serviceName = calcService.options[calcService.selectedIndex].text;
      const area = calcArea.value;
      const location = calcLocation ? calcLocation.value : 'Misiones';
      const clientName = document.getElementById('calc-name')?.value || 'Cliente';

      const message = `¡Hola NEXO Sistemas Constructivos! Mi nombre es ${clientName}. Me comunico desde la web para solicitar presupuesto formal:%0A%0A📌 *Servicio:* ${serviceName}%0A📐 *Superficie estimada:* ${area} m²%0A📍 *Ubicación:* ${location}%0A%0A¿Podríamos coordinar un relevamiento o asesoramiento técnico? Muchas gracias!`;
      
      const whatsappUrl = `https://wa.me/5493757679600?text=${message}`;
      window.open(whatsappUrl, '_blank');
    });
  }

  // --- 4. Guardar Contacto Modal & vCard Generator ---
  const modalContacto = document.getElementById('modal-contacto-vcard');
  const btnOpenContacto = document.querySelectorAll('.trigger-contacto-card');
  const btnDownloadVcard = document.getElementById('btn-download-vcard');

  btnOpenContacto.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(modalContacto);
    });
  });

  if (btnDownloadVcard) {
    btnDownloadVcard.addEventListener('click', () => {
      // Build vCard 3.0 format
      const vCardData = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'N:Sistemas Constructivos;NEXO;;;',
        'FN:NEXO Sistemas Constructivos',
        'ORG:NEXO Sistemas Constructivos',
        'TITLE:Construcción en Seco y Steel Frame',
        'TEL;TYPE=WORK,VOICE,pref:+54 9 3757 679600',
        'TEL;TYPE=CELL,WHATSAPP:+5493757679600',
        'EMAIL;TYPE=PREF,INTERNET:info@nexosistemas.com.ar',
        'URL:https://www.nexosistemas.com.ar',
        'ADR;TYPE=WORK:;;Puerto Libertad;Misiones;;;Argentina',
        'NOTE:Especialistas en Steel Framing, Cielorrasos, Tabiquería y Soluciones Llave en Mano en Misiones.',
        'END:VCARD'
      ].join('\r\n');

      const blob = new Blob([vCardData], { type: 'text/vcard;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'NEXO_Sistemas_Constructivos.vcf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // --- 5. Project Detail Lightbox Modal ---
  const modalObra = document.getElementById('modal-obra-detail');
  const modalObraImg = document.getElementById('modal-obra-img');
  const modalObraTitle = document.getElementById('modal-obra-title');
  const modalObraLocation = document.getElementById('modal-obra-location');
  const modalObraArea = document.getElementById('modal-obra-area');
  const modalObraSystem = document.getElementById('modal-obra-system');
  const modalObraDesc = document.getElementById('modal-obra-desc');
  const modalObraWsLink = document.getElementById('modal-obra-ws-link');

  const projectsData = {
    'oficinas': {
      title: 'Oficinas Administrativas',
      location: 'Puerto Libertad, Misiones',
      area: '120 m²',
      system: 'Steel Frame Completo + Fachada Vidriada',
      desc: 'Construcción integral de oficinas comerciales con perfiles estructurales de acero galvanizado ligero (Light Gauge Steel Framing). Sistema termoacústico de alto rendimiento, cielorraso suspendido y voladizo exterior con detalles en madera y chapa prepintada mate.',
      img: 'assets/images/obra_oficinas.jpg'
    },
    'local': {
      title: 'Local Comercial',
      location: 'Puerto Esperanza, Misiones',
      area: '80 m²',
      system: 'Placas de Yeso & Cielorraso con Garganta LED',
      desc: 'Desarrollo de salón de ventas y showroom comercial. Instalación de tabiquería divisoria de placa de yeso con aislamiento fonoabsorbente de lana de vidrio, cielo raso continuo junta tomada e iluminación perimetral indirecta con perfilería oculta.',
      img: 'assets/images/obra_local_comercial.jpg'
    },
    'tinglado': {
      title: 'Pórtico y Tinglado',
      location: 'Zona Costera, Misiones',
      area: '200 m²',
      system: 'Estructura Metálica Pesada & Cubierta Galvanizada',
      desc: 'Diseño, cálculo y montaje de estructura reticular metálica para tinglado y depósito logístico. Columnas de perfilería pesada, cerchas tubulares galvanizadas y cubierta de chapa trapezoidal cincalum con aislante aluminizado reflectivo.',
      img: 'assets/images/obra_tinglado.jpg'
    },
    'vivienda': {
      title: 'Vivienda Particular',
      location: 'Puerto Libertad, Misiones',
      area: '150 m²',
      system: 'Cielorrasos, Tabiques y Steel Frame Interior',
      desc: 'Ejecución de interiores en residencia de alta gama. Ambientes integrados con cielorrasos decorativos en desniveles, gargantas para luces cálidas LED, paredes con placa ignífuga en cocina e hidrófuga en sanitarios.',
      img: 'assets/images/obra_vivienda.jpg'
    }
  };

  projectCards.forEach(card => {
    card.addEventListener('click', () => {
      const projId = card.getAttribute('data-project-id');
      const data = projectsData[projId];
      if (data) {
        modalObraImg.src = data.img;
        modalObraImg.alt = data.title;
        modalObraTitle.textContent = data.title;
        modalObraLocation.textContent = data.location;
        modalObraArea.textContent = data.area;
        modalObraSystem.textContent = data.system;
        modalObraDesc.textContent = data.desc;
        modalObraWsLink.href = `https://wa.me/5493757679600?text=Hola%20NEXO!%20Me%20interesó%20mucho%20el%20proyecto%20"${encodeURIComponent(data.title)}"%20(${data.location}).%20Quisiera%20consultar%20por%20una%20obra%20similar.`;
        openModal(modalObra);
      }
    });
  });

  // --- Modal Helpers ---
  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.classList.remove('active');
    });
    document.body.style.overflow = '';
  }

  closeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target === btn) {
        closeModal();
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // --- 6. Quick Contact Form Handler ---
  const contactForm = document.getElementById('quick-contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('contact-name').value;
      const phone = document.getElementById('contact-phone').value;
      const message = document.getElementById('contact-msg').value;

      const wsMsg = `Hola NEXO! Mi nombre es ${name} (Tel: ${phone}).%0A%0A${encodeURIComponent(message)}`;
      window.open(`https://wa.me/5493757679600?text=${wsMsg}`, '_blank');
      contactForm.reset();
    });
  }
});
