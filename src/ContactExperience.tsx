import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Clock3, Headphones, Mail, MapPin, MessageCircle, Plane, Plus } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import './contact-experience.css';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

type ContactExperienceProps = { onExplore: () => void };

export function ContactExperience({ onExplore }: ContactExperienceProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const submitRef = useRef<HTMLButtonElement | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'opening' | 'ready'>('idle');
  const [invalidAttempt, setInvalidAttempt] = useState(false);
  const [whatsAppUrl, setWhatsAppUrl] = useState('');

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const hero = root.querySelector<HTMLElement>('.cx-hero');
      const mediaClip = root.querySelector<HTMLElement>('.cx-hero-media-clip');
      const media = root.querySelector<HTMLElement>('.cx-hero-media');
      const route = root.querySelector<SVGPathElement>('.cx-route-path');
      const plane = root.querySelector<SVGGElement>('.cx-route-plane');

      if (hero && mediaClip && media) {
        const reveal = gsap.timeline({
          scrollTrigger: { trigger: hero, start: 'top 82%', once: true },
        });
        reveal
          .fromTo(mediaClip, { clipPath: 'inset(0 0 68% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.45, ease: 'power3.inOut' }, 0)
          .fromTo(media, { scale: 1.15 }, { scale: 1, duration: 2, ease: 'power3.out' }, 0)
          .fromTo(root.querySelectorAll('.cx-word'), { yPercent: 115, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .82, ease: 'power4.out', stagger: .085 }, .22)
          .fromTo(root.querySelectorAll('.cx-hero-copy, .cx-hero-kicker'), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .72, ease: 'power3.out', stagger: .12 }, .7);

        gsap.to(media, {
          yPercent: 7,
          ease: 'none',
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1.1 },
        });
      }

      if (route && plane) {
        const length = route.getTotalLength();
        gsap.set(route, { strokeDasharray: length, strokeDashoffset: length });
        const routeTimeline = gsap.timeline({
          scrollTrigger: { trigger: hero, start: 'top 75%', once: true },
        });
        routeTimeline
          .to(route, { strokeDashoffset: 0, duration: 2.25, ease: 'power2.inOut' }, 0)
          .to(plane, {
            duration: 2.05,
            ease: 'power1.inOut',
            motionPath: { path: route, align: route, alignOrigin: [.5, .5], autoRotate: true },
          }, .18);
      }

      const contactGrid = root.querySelector<HTMLElement>('.cx-contact-grid');
      if (contactGrid) {
        gsap.fromTo(root.querySelectorAll('.cx-info-item, .cx-office-row'), { y: 24, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: .68, ease: 'power3.out', stagger: .11,
          scrollTrigger: { trigger: contactGrid, start: 'top 76%', once: true },
        });
        gsap.fromTo(root.querySelector('.cx-form-card'), { x: 32, autoAlpha: 0 }, {
          x: 0, autoAlpha: 1, duration: .85, ease: 'power3.out',
          scrollTrigger: { trigger: contactGrid, start: 'top 73%', once: true },
        });
        gsap.fromTo(root.querySelector('.cx-faq'), { y: 18, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: .65, ease: 'power3.out',
          scrollTrigger: { trigger: root.querySelector('.cx-faq'), start: 'top 92%', once: true },
        });
      }

      const cta = root.querySelector<HTMLElement>('.cx-cta');
      const ctaImage = root.querySelector<HTMLElement>('.cx-cta-image');
      if (cta && ctaImage) {
        gsap.fromTo(ctaImage, { scale: 1.13 }, {
          scale: 1,
          ease: 'none',
          scrollTrigger: { trigger: cta, start: 'top bottom', end: 'bottom top', scrub: 1.1 },
        });
        gsap.fromTo(root.querySelectorAll('.cx-cta-copy > *'), { y: 18, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: .65, ease: 'power3.out', stagger: .11,
          scrollTrigger: { trigger: cta, start: 'top 74%', once: true },
        });
      }
    }, root);

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const button = submitRef.current;
    const onPointerMove = (event: PointerEvent) => {
      if (!button || !finePointer.matches) return;
      const rect = button.getBoundingClientRect();
      const dx = (event.clientX - rect.left - rect.width / 2) * .1;
      const dy = (event.clientY - rect.top - rect.height / 2) * .14;
      gsap.to(button, { x: dx, y: dy, duration: .24, ease: 'power3.out', overwrite: true });
    };
    const onPointerLeave = () => {
      if (button) gsap.to(button, { x: 0, y: 0, duration: .42, ease: 'elastic.out(1,.55)', overwrite: true });
    };
    if (finePointer.matches) {
      button?.addEventListener('pointermove', onPointerMove);
      button?.addEventListener('pointerleave', onPointerLeave);
    }

    return () => {
      if (finePointer.matches) {
        button?.removeEventListener('pointermove', onPointerMove);
        button?.removeEventListener('pointerleave', onPointerLeave);
      }
      if (button) { gsap.killTweensOf(button); gsap.set(button, { clearProps: 'transform' }); }
      ctx.revert();
    };
  }, []);

  const sendWhatsAppMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'opening') return;
    const data = new FormData(event.currentTarget);
    const phone = String(data.get('phone') || '').trim();
    const message = [
      'AERORA travel enquiry',
      `Name: ${String(data.get('name') || '').trim()}`,
      `Email: ${String(data.get('email') || '').trim()}`,
      `Phone: ${phone || 'Not provided'}`,
      '',
      'How can we help:',
      String(data.get('message') || '').trim(),
    ].join('\\n');
    const url = `https://wa.me/919999999999?text=${encodeURIComponent(message)}`;
    setWhatsAppUrl(url);
    window.open(url, '_blank', 'noopener,noreferrer');
    setStatus('ready');
  };

  const headline = ['Your', 'Next', 'Journey', 'Starts', 'With', 'A', 'Conversation.'];
  const faqs = [
    ['Does an inquiry confirm my booking?', 'No. An inquiry only starts a conversation; our team reconfirms fare and availability before ticketing.'],
    ['Can I enquire for a large group?', 'Yes. Tell us your passenger count and dates and our group travel specialist will follow up.'],
    ['When do I pay?', 'There is no payment during the inquiry. Payment happens only after you accept a confirmed quote.'],
  ];

  return (
    <section className="contact-experience" id="contact" ref={rootRef} aria-labelledby="cx-heading">
      <div className="cx-hero">
        <div className="cx-hero-media-clip" aria-hidden="true"><div className="cx-hero-media" /></div>
        <div className="cx-hero-wash" aria-hidden="true" />
        <div className="cx-hero-content">
          <div className="cx-hero-kicker"><span /> AERORA · PERSONAL TRAVEL CONCIERGE <span /></div>
          <h2 className="cx-headline" id="cx-heading" aria-label="Your Next Journey Starts With A Conversation.">
            {headline.map((word, index) => <span className="cx-word-clip" key={`${word}-${index}`} aria-hidden="true"><span className="cx-word">{word}</span></span>)}
          </h2>
          <p className="cx-hero-copy">Have a destination in mind? Let our team help you plan your journey.</p>
        </div>
        <div className="cx-route-wrap" aria-hidden="true">
          <span className="cx-route-origin">CHENNAI</span>
          <svg className="cx-route-svg" viewBox="0 0 1200 210" preserveAspectRatio="none">
            <path className="cx-route-path" d="M20 150 C180 20 280 24 430 93 S680 205 815 116 S1030 18 1180 72" />
            <g className="cx-route-plane" transform="translate(20 150)">
              <path d="M-18 1.5 16-1 4 4 1 15 -2 15 -1 5 -12 8 -16 5 -5 2Z" />
            </g>
          </svg>
          <span className="cx-route-destination">WHEREVER YOU’RE GOING</span>
        </div>
        <div className="cx-scroll-mark" aria-hidden="true"><span /> A CONVERSATION IS THE BEGINNING</div>
      </div>

      <div className="cx-contact-grid">
        <div className="cx-info-column">
          <div className="cx-section-index">01 <span>/</span> A HUMAN ON THE OTHER END</div>
          <h3>Talk to Our<br /><i>Travel Experts.</i></h3>
          <p className="cx-info-intro">Thoughtful advice, clear answers, and a real person to help shape the way there.</p>
          <p className="cx-demo-note">Demo contact details: phone and WhatsApp recipient numbers must be replaced before launch. The form currently opens a demo WhatsApp recipient.</p>

          <div className="cx-info-list">
            <a className="cx-info-item" href="mailto:hello@aerora.travel">
              <span className="cx-info-icon"><Mail size={18} /></span><span><small>EMAIL ADDRESS</small><b>hello@aerora.travel</b></span><ArrowRight className="cx-info-arrow" size={15} />
            </a>
            <a className="cx-info-item" href="tel:+914440000101">
              <span className="cx-info-icon"><Headphones size={18} /></span><span><small>PHONE NUMBER</small><b>+91 44 4000 0101</b></span><ArrowRight className="cx-info-arrow" size={15} />
            </a>
            <a className="cx-info-item" href="https://wa.me/919999999999" target="_blank" rel="noreferrer">
              <span className="cx-info-icon"><MessageCircle size={18} /></span><span><small>WHATSAPP</small><b>Message the concierge</b></span><ArrowRight className="cx-info-arrow" size={15} />
            </a>
          </div>

          <div className="cx-office-row">
            <span className="cx-info-icon"><MapPin size={18} /></span>
            <span><small>OUR OFFICE</small><b>Chennai, Tamil Nadu</b><em>India · By appointment</em></span>
            <Clock3 className="cx-office-clock" size={17} />
          </div>
        </div>

        <div className="cx-form-column">
          <form className={`cx-form-card${invalidAttempt ? ' has-validation' : ''}`} onSubmit={sendWhatsAppMessage} onInvalidCapture={() => setInvalidAttempt(true)} aria-busy={status === 'opening'} noValidate={false}>
            <div className="cx-form-topline"><span>02 / YOUR NOTE</span><span>NO COMMITMENT · JUST A CONVERSATION</span></div>
            <h3>Let’s start <i>somewhere.</i></h3>
            <p className="cx-form-lede">Share a little about the journey you have in mind.</p>
            <div className="cx-fields">
              <label className="cx-field"><input name="name" required autoComplete="name" placeholder=" " onChange={() => setInvalidAttempt(false)} /><span>Full name</span><i /></label>
              <label className="cx-field"><input name="email" type="email" required autoComplete="email" placeholder=" " onChange={() => setInvalidAttempt(false)} /><span>Email address</span><i /></label>
              <label className="cx-field"><input name="phone" type="tel" required autoComplete="tel" placeholder=" " onChange={() => setInvalidAttempt(false)} /><span>Phone number</span><i /></label>
              <label className="cx-field cx-field-message"><textarea name="message" required rows={3} placeholder=" " onChange={() => setInvalidAttempt(false)} /><span>How can we help?</span><i /></label>
            </div>
            <AnimatePresence initial={false}>
              {invalidAttempt && <motion.p className="cx-validation" role="status" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>Please add your name, a valid email, phone number, and a short message.</motion.p>}
            </AnimatePresence>
            <motion.button ref={submitRef} className="cx-submit" type="submit" disabled={status === 'opening'} whileTap={{ scale: .985 }}>
              <span>{status === 'opening' ? 'Preparing WhatsApp message' : status === 'ready' ? 'Open WhatsApp again' : 'Send via WhatsApp'}</span>
              {status === 'opening' ? <span className="cx-spinner" aria-hidden="true" /> : <ArrowRight size={17} />}
            </motion.button>
            <div className="cx-form-status" aria-live="polite">
              {status === 'ready' ? <>WhatsApp opened with your name, email, phone, and message filled in. Review it and tap Send in WhatsApp. The current recipient is a demo number.{' '}<a href={whatsAppUrl} target="_blank" rel="noreferrer">Open WhatsApp message</a></> : 'Your details and message will be filled into WhatsApp. You can review them before sending.'}
            </div>
          </form>

          <div className="cx-faq">
            <div className="cx-faq-kicker">A FEW QUICK ANSWERS</div>
            {faqs.map(([question, answer], index) => (
              <div className="cx-faq-item" key={question}>
                <button className="cx-faq-question" type="button" aria-expanded={openFaq === index} aria-controls={`cx-faq-answer-${index}`} onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                  <span>{question}</span><motion.i animate={{ rotate: openFaq === index ? 45 : 0 }} transition={{ duration: .22 }} aria-hidden="true"><Plus size={17} /></motion.i>
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === index && <motion.div id={`cx-faq-answer-${index}`} className="cx-faq-answer" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .28, ease: 'easeInOut' }}><p>{answer}</p></motion.div>}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cx-cta">
        <div className="cx-cta-image" aria-hidden="true" />
        <div className="cx-cta-shade" aria-hidden="true" />
        <div className="cx-cta-copy">
          <span className="cx-cta-kicker">THE WORLD IS WAITING</span>
          <h3>Ready To Take Off?</h3>
          <p>Your next destination is closer than you think.</p>
          <motion.a href="#search-panel" className="cx-explore" onClick={(event) => { event.preventDefault(); onExplore(); }} whileHover={{ y: -3 }} whileTap={{ scale: .98 }}>
            Explore Flights <ArrowRight size={16} />
          </motion.a>
        </div>
      </div>
    </section>
  );
}
