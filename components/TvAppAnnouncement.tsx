'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'yf_tv_app_announced_v2';
// Les applications YAMONFILM qui affichent le site dans une vue web Android (« ; wv ») ne montrent pas l'annonce.
// PC, mobiles et navigateurs des télévisions la voient.
const IN_APP = /; wv\)/i;

export default function TvAppAnnouncement() {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [launcher, setLauncher] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (IN_APP.test(navigator.userAgent)) return;
    // La petite télé sur le côté reste disponible pour rouvrir l'annonce à tout moment.
    const show = window.setTimeout(() => setLauncher(true), 0);
    let seen = false;
    try { seen = !!localStorage.getItem(STORAGE_KEY); } catch { /* stockage indisponible : on affiche quand même */ }
    if (seen) return () => window.clearTimeout(show);
    const timer = window.setTimeout(() => setOpen(true), 1200);
    return () => { window.clearTimeout(show); window.clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 1600);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open]);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignoré */ }
    setClosing(true);
    window.setTimeout(() => { setOpen(false); setClosing(false); }, 380);
  }

  if (!open) {
    if (!launcher) return null;
    return (
      <button type="button" className="yf-tvl" onClick={() => setOpen(true)} aria-label="Découvrir l’application TV YAMONFILM">
        <style>{CSS}</style>
        <span className="yf-tvl-tv" aria-hidden="true">
          <span className="yf-tvl-ant yf-tvl-ant-l" /><span className="yf-tvl-ant yf-tvl-ant-r" />
          <span className="yf-tvl-screen"><span className="yf-tvl-scan" /><span className="yf-tvl-play" /></span>
          <span className="yf-tvl-foot" />
        </span>
        <span className="yf-tvl-label">App TV</span>
        <span className="yf-tvl-dot" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className={`yf-tva-backdrop${closing ? ' yf-tva-out' : ''}`} onClick={dismiss}>
      <style>{CSS}</style>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="yf-tva-title"
        aria-describedby="yf-tva-text"
        className="yf-tva-card"
        onClick={event => event.stopPropagation()}
      >
        <button ref={closeRef} onClick={dismiss} className="yf-tva-close" aria-label="Fermer l’annonce">×</button>

        <div className="yf-tva-stage" aria-hidden="true">
          <span className="yf-tva-wave yf-tva-w1" />
          <span className="yf-tva-wave yf-tva-w2" />
          <span className="yf-tva-wave yf-tva-w3" />
          {Array.from({ length: 10 }, (_, i) => <span key={i} className={`yf-tva-spark yf-tva-s${i}`} />)}
          <div className="yf-tva-tv">
            <div className="yf-tva-screen">
              <div className="yf-tva-on">
                <div className="yf-tva-glow" />
                <div className="yf-tva-logo"><span>YAMON</span>FILM</div>
                <div className="yf-tva-rows">
                  <i /><i /><i /><i />
                </div>
              </div>
              <div className="yf-tva-line" />
            </div>
            <div className="yf-tva-led" />
          </div>
          <div className="yf-tva-foot" />
        </div>

        <p className="yf-tva-kicker yf-tva-up" style={{ animationDelay: '1.35s' }}>NOUVEAU</p>
        <h2 id="yf-tva-title" className="yf-tva-title yf-tva-up" style={{ animationDelay: '1.5s' }}>
          YAMONFILM arrive sur ta télé
        </h2>
        <p id="yf-tva-text" className="yf-tva-text yf-tva-up" style={{ animationDelay: '1.65s' }}>
          L’application TV est disponible : tes films et séries sur grand écran, à la télécommande, avec ton compte, tes profils et ton historique.
        </p>
        <div className="yf-tva-chips yf-tva-up" style={{ animationDelay: '1.8s' }}>
          <span>Android TV</span><span>Google TV</span><span>Fire TV Stick</span><span>Bbox 4K</span>
        </div>
        <div className="yf-tva-actions yf-tva-up" style={{ animationDelay: '1.95s' }}>
          <Link href="/app" onClick={() => { try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignoré */ } }} className="yf-tva-cta">
            Découvrir l’application TV
          </Link>
          <button onClick={dismiss} className="yf-tva-later">Plus tard</button>
        </div>
      </section>
    </div>
  );
}

const CSS = `
.yf-tva-backdrop{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,5,8,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:yfTvaFade .45s ease both;overflow-y:auto}
.yf-tva-out{animation:yfTvaFadeOut .38s ease both}
.yf-tva-out .yf-tva-card{animation:yfTvaCardOut .38s ease both}
.yf-tva-card{position:relative;width:100%;max-width:470px;margin:auto;border-radius:28px;padding:28px 26px 24px;text-align:center;color:#fff;background:radial-gradient(120% 80% at 50% 0%,#2a0b10 0%,#121219 55%,#0d0d12 100%);border:1px solid rgba(255,255,255,.09);box-shadow:0 30px 90px -20px rgba(229,9,20,.45),0 0 0 1px rgba(229,9,20,.08);animation:yfTvaCard .7s cubic-bezier(.2,.9,.25,1.15) both}
.yf-tva-close{position:absolute;top:12px;right:12px;width:38px;height:38px;border-radius:999px;background:rgba(255,255,255,.06);color:#a1a1aa;font-size:22px;line-height:1;cursor:pointer;transition:background .2s,color .2s}
.yf-tva-close:hover,.yf-tva-close:focus-visible{background:rgba(255,255,255,.14);color:#fff;outline:none}
.yf-tva-stage{position:relative;height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;margin-bottom:6px}
.yf-tva-tv{position:relative;z-index:2;width:250px;height:150px;border-radius:16px;padding:9px;background:linear-gradient(160deg,#2b2b33,#15151b);box-shadow:0 18px 40px -12px rgba(0,0,0,.8),inset 0 1px 0 rgba(255,255,255,.08);animation:yfTvaDrop .8s cubic-bezier(.2,.9,.3,1.25) .2s both}
.yf-tva-screen{position:relative;width:100%;height:100%;border-radius:9px;overflow:hidden;background:#050507}
.yf-tva-line{position:absolute;left:50%;top:50%;width:0;height:2px;background:#fff;box-shadow:0 0 16px 4px rgba(255,255,255,.9);transform:translate(-50%,-50%);animation:yfTvaLine .55s ease-out .75s both}
.yf-tva-on{position:absolute;inset:0;background:linear-gradient(135deg,#3a0d12,#120a14 55%,#0a1222);transform-origin:center;animation:yfTvaPower .6s cubic-bezier(.3,1.4,.4,1) 1.05s both}
.yf-tva-glow{position:absolute;inset:-40%;background:radial-gradient(circle at 50% 45%,rgba(229,9,20,.55),transparent 55%);animation:yfTvaPulse 2.6s ease-in-out 1.6s infinite}
.yf-tva-logo{position:absolute;left:0;right:0;top:38px;font-weight:900;font-size:25px;letter-spacing:.02em;color:#fff;animation:yfTvaLogo .7s cubic-bezier(.2,.9,.3,1.3) 1.35s both}
.yf-tva-logo span{color:#e50914}
.yf-tva-rows{position:absolute;left:14px;right:14px;bottom:14px;display:flex;gap:7px}
.yf-tva-rows i{flex:1;height:30px;border-radius:5px;background:linear-gradient(160deg,rgba(255,255,255,.22),rgba(255,255,255,.06));animation:yfTvaRow .5s ease both}
.yf-tva-rows i:nth-child(1){animation-delay:1.55s;outline:2px solid #fff;outline-offset:1px}
.yf-tva-rows i:nth-child(2){animation-delay:1.63s}
.yf-tva-rows i:nth-child(3){animation-delay:1.71s}
.yf-tva-rows i:nth-child(4){animation-delay:1.79s}
.yf-tva-led{position:absolute;bottom:3px;left:50%;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:#e50914;box-shadow:0 0 8px #e50914;animation:yfTvaBlink 1.2s ease-in-out .9s infinite}
.yf-tva-foot{position:relative;z-index:1;width:70px;height:12px;margin-top:-1px;border-radius:0 0 10px 10px;background:linear-gradient(#22222a,#15151b);animation:yfTvaDrop .8s cubic-bezier(.2,.9,.3,1.25) .25s both}
.yf-tva-wave{position:absolute;z-index:1;top:50%;left:50%;width:250px;height:150px;margin:-82px 0 0 -125px;border-radius:24px;border:2px solid rgba(229,9,20,.55);opacity:0;animation:yfTvaWave 2.4s ease-out infinite}
.yf-tva-w1{animation-delay:1.3s}.yf-tva-w2{animation-delay:2.1s}.yf-tva-w3{animation-delay:2.9s}
.yf-tva-spark{position:absolute;z-index:3;top:50%;left:50%;width:6px;height:6px;border-radius:50%;background:#ffd36b;box-shadow:0 0 10px #ffb020;opacity:0;animation:yfTvaSpark 1.1s ease-out 1.25s both}
.yf-tva-s0{--x:-150px;--y:-60px}.yf-tva-s1{--x:150px;--y:-55px}.yf-tva-s2{--x:-160px;--y:30px}.yf-tva-s3{--x:165px;--y:35px}.yf-tva-s4{--x:-95px;--y:-95px}.yf-tva-s5{--x:100px;--y:-92px;background:#e50914;box-shadow:0 0 10px #e50914}.yf-tva-s6{--x:-60px;--y:95px;background:#fff}.yf-tva-s7{--x:70px;--y:92px}.yf-tva-s8{--x:-185px;--y:-10px;background:#e50914;box-shadow:0 0 10px #e50914}.yf-tva-s9{--x:190px;--y:-8px;background:#fff}
.yf-tva-up{opacity:0;animation:yfTvaUp .6s cubic-bezier(.2,.8,.2,1) both}
.yf-tva-kicker{font-size:11px;font-weight:700;letter-spacing:.3em;color:#ff4d57}
.yf-tva-title{margin-top:8px;font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-.01em}
.yf-tva-text{margin-top:10px;font-size:14px;line-height:1.6;color:#b4b4bf}
.yf-tva-chips{margin-top:16px;display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
.yf-tva-chips span{font-size:12px;padding:5px 11px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);color:#e4e4ea}
.yf-tva-actions{margin-top:22px;display:flex;flex-direction:column;gap:8px}
.yf-tva-cta{position:relative;display:block;border-radius:999px;padding:15px 22px;font-weight:800;font-size:15px;color:#fff;background:linear-gradient(90deg,#e50914,#ff3b47);overflow:hidden;box-shadow:0 12px 30px -10px rgba(229,9,20,.8);animation:yfTvaGlowBtn 2.2s ease-in-out 2.6s infinite;transition:transform .2s}
.yf-tva-cta:hover{transform:translateY(-2px)}
.yf-tva-cta:focus-visible{outline:3px solid #fff;outline-offset:3px}
.yf-tva-cta::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-20deg);animation:yfTvaShine 2.8s ease-in-out 2.2s infinite}
.yf-tva-later{min-height:44px;border-radius:999px;font-size:14px;color:#a1a1aa;cursor:pointer;transition:color .2s,background .2s}
.yf-tva-later:hover,.yf-tva-later:focus-visible{color:#fff;background:rgba(255,255,255,.06);outline:none}
@keyframes yfTvaFade{from{opacity:0}to{opacity:1}}
@keyframes yfTvaFadeOut{to{opacity:0}}
@keyframes yfTvaCard{from{opacity:0;transform:translateY(40px) scale(.92)}to{opacity:1;transform:none}}
@keyframes yfTvaCardOut{to{opacity:0;transform:translateY(20px) scale(.96)}}
@keyframes yfTvaDrop{from{opacity:0;transform:translateY(-36px) rotate(-4deg)}to{opacity:1;transform:none}}
@keyframes yfTvaLine{0%{width:0;opacity:1}80%{width:100%;opacity:1}100%{width:100%;opacity:0}}
@keyframes yfTvaPower{from{transform:scaleY(.01);opacity:0;filter:brightness(3)}to{transform:scaleY(1);opacity:1;filter:none}}
@keyframes yfTvaLogo{from{opacity:0;transform:scale(.6);letter-spacing:.4em}to{opacity:1;transform:none}}
@keyframes yfTvaRow{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes yfTvaPulse{0%,100%{opacity:.7}50%{opacity:1}}
@keyframes yfTvaBlink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes yfTvaWave{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(1.55)}}
@keyframes yfTvaSpark{0%{opacity:0;transform:translate(0,0) scale(.3)}25%{opacity:1}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(1)}}
@keyframes yfTvaUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes yfTvaShine{0%{left:-60%}60%,100%{left:130%}}
@keyframes yfTvaGlowBtn{0%,100%{box-shadow:0 12px 30px -10px rgba(229,9,20,.8)}50%{box-shadow:0 12px 40px -6px rgba(255,59,71,1)}}
@media (max-width:420px){.yf-tva-card{padding:24px 18px 18px}.yf-tva-title{font-size:22px}.yf-tva-tv{width:220px;height:132px}.yf-tva-wave{width:220px;height:132px;margin:-73px 0 0 -110px}.yf-tva-logo{font-size:21px;top:32px}}
@media (prefers-reduced-motion:reduce){.yf-tva-backdrop *,.yf-tva-backdrop{animation-duration:.01ms!important;animation-delay:0s!important;animation-iteration-count:1!important}.yf-tva-wave,.yf-tva-spark{display:none}}
.yf-tvl{position:fixed;right:0;top:58%;z-index:60;display:flex;align-items:center;gap:8px;padding:9px 12px 9px 10px;border-radius:16px 0 0 16px;background:linear-gradient(135deg,#1c1c24,#121218);border:1px solid rgba(255,255,255,.1);border-right:0;box-shadow:0 10px 30px -10px rgba(0,0,0,.8),0 0 0 1px rgba(229,9,20,.12);transform:translateX(calc(100% - 52px));transition:transform .45s cubic-bezier(.2,.9,.25,1.15),box-shadow .3s;cursor:pointer;animation:yfTvlIn .8s cubic-bezier(.2,.9,.3,1.3) .6s both,yfTvlNudge 6s ease-in-out 3s infinite}
.yf-tvl:hover,.yf-tvl:focus-visible{transform:translateX(0);box-shadow:0 14px 34px -10px rgba(229,9,20,.6),0 0 0 1px rgba(229,9,20,.35);outline:none;animation-play-state:paused}
.yf-tvl-tv{position:relative;display:block;width:32px;height:26px;flex:none}
.yf-tvl-screen{position:absolute;left:0;right:0;top:5px;height:17px;border-radius:5px;overflow:hidden;background:linear-gradient(135deg,#e50914,#7a0610);box-shadow:0 0 12px rgba(229,9,20,.7),inset 0 0 0 2px #2a2a33}
.yf-tvl-scan{position:absolute;left:0;right:0;height:5px;background:linear-gradient(transparent,rgba(255,255,255,.45),transparent);animation:yfTvlScan 2.2s linear infinite}
.yf-tvl-play{position:absolute;left:50%;top:50%;margin:-4px 0 0 -2px;border-left:6px solid #fff;border-top:4px solid transparent;border-bottom:4px solid transparent}
.yf-tvl-ant{position:absolute;top:0;left:50%;width:2px;height:7px;background:#9a9aa6;border-radius:2px;transform-origin:bottom center}
.yf-tvl-ant-l{transform:translateX(-4px) rotate(-30deg);animation:yfTvlAntL 2.6s ease-in-out infinite}
.yf-tvl-ant-r{transform:translateX(2px) rotate(30deg);animation:yfTvlAntR 2.6s ease-in-out infinite}
.yf-tvl-foot{position:absolute;bottom:0;left:50%;width:12px;height:3px;margin-left:-6px;border-radius:2px;background:#3a3a44}
.yf-tvl-label{font-size:12px;font-weight:800;color:#fff;white-space:nowrap;letter-spacing:.02em}
.yf-tvl-dot{position:absolute;top:6px;left:6px;width:8px;height:8px;border-radius:50%;background:#e50914;box-shadow:0 0 0 0 rgba(229,9,20,.7);animation:yfTvlPing 1.8s ease-out infinite}
@keyframes yfTvlIn{from{transform:translateX(110%)}to{transform:translateX(calc(100% - 52px))}}
@keyframes yfTvlNudge{0%,86%,100%{transform:translateX(calc(100% - 52px))}90%{transform:translateX(calc(100% - 64px))}94%{transform:translateX(calc(100% - 50px))}}
@keyframes yfTvlScan{from{top:-5px}to{top:17px}}
@keyframes yfTvlAntL{0%,100%{transform:translateX(-4px) rotate(-30deg)}50%{transform:translateX(-4px) rotate(-18deg)}}
@keyframes yfTvlAntR{0%,100%{transform:translateX(2px) rotate(30deg)}50%{transform:translateX(2px) rotate(42deg)}}
@keyframes yfTvlPing{0%{box-shadow:0 0 0 0 rgba(229,9,20,.7)}80%,100%{box-shadow:0 0 0 8px rgba(229,9,20,0)}}
@media (max-width:640px){.yf-tvl{top:30%}}
@media (prefers-reduced-motion:reduce){.yf-tvl,.yf-tvl *{animation:none!important}}
`;
