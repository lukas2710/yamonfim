'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchSubscriptionProfile } from '@/lib/subscription';
import { PLANS, formatEuro, checkoutUrl, expirationDate, nextSundayReset } from './plans';
import styles from './subscription.module.css';
import MemberReviews from './MemberReviews';

const ADMIN_EMAIL = 'lukas.leclerc312@gmail.com';
const FREE_LIMIT = 5;
type IconName = 'crown' | 'play' | 'check' | 'screen' | 'shield' | 'arrow' | 'copy' | 'refresh' | 'help' | 'infinity';
const paths: Record<IconName, React.ReactNode> = {
  crown: <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7Z" />,
  play: <path d="m9 5 11 7-11 7V5Z" />,
  check: <path d="m5 12 4 4L19 6" />,
  screen: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6l-8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H3V3h12v2" /></>,
  refresh: <><path d="M21 10a9 9 0 1 0-2 8M21 3v7h-7" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01" /></>,
  infinity: <path d="M18 8c5 0 5 8 0 8S6 8 4 8c-5 0-5 8 0 8s10-8 14-8Z" />,
};
function Icon({ name }: { name: IconName }) { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>; }
const BENEFITS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'infinity', title: 'Le plaisir sans quota', text: 'Profitez du visionnage illimité pendant votre période VIP.' },
  { icon: 'play', title: 'Tout un univers à explorer', text: 'Retrouvez les films et les séries du catalogue, au même endroit.' },
  { icon: 'screen', title: 'L’écran de votre choix', text: 'Accédez au site sur téléphone, tablette ou ordinateur.' },
  { icon: 'shield', title: 'Un paiement via Stripe', text: 'Finalisez votre choix sur une page de paiement Stripe.' },
];
const FAQ = [
  { q: 'Qu’est-ce qui change avec le VIP ?', a: 'Le VIP enlève le quota de visionnage pendant votre période d’accès. Toutes les formules VIP proposent les mêmes avantages : vous choisissez simplement la durée qui vous convient.' },
  { q: 'Quel montant vais-je payer ?', a: 'Le prix principal de chaque carte est le montant affiché pour la période choisie. Le prix par mois ou par jour est un équivalent indicatif, pas une autre formule de facturation. Vérifiez le montant final et les conditions présentés par Stripe avant de confirmer.' },
  { q: 'Comment le paiement est-il associé à mon compte ?', a: 'Votre adresse email et votre identifiant de compte sont transmis au lien Stripe pour identifier votre compte. Utilisez l’adresse indiquée dans le récapitulatif. Si vous voulez utiliser un autre compte, reconnectez-vous avec celui-ci avant de payer.' },
  { q: 'J’ai payé, mais mon accès n’a pas changé. Que faire ?', a: 'Revenez sur cette page et utilisez « Actualiser mon statut ». Si le problème persiste, contactez-nous via le formulaire d’assistance, avec votre reçu Stripe et votre identifiant client. Évitez de payer une seconde fois pour tenter d’activer votre accès.' },
  { q: 'Comment vérifier la durée restante de mon accès ?', a: 'Votre espace « Mon abonnement » affiche votre statut et, si votre compte possède une date de début et une durée, une estimation de l’échéance. Si ces informations sont absentes, notre assistance peut vérifier votre accès.' },
];
interface Account { id: string; email: string; vip: boolean; admin: boolean; watchCount: number; started?: string; duration?: string; resetAt?: string; resetVerified: boolean }
const formatDate = (value: number) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value);

export default function AbonnementPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState('3m');
  const [redirecting, setRedirecting] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');
  const mounted = useRef(false);
  const activeRequest = useRef(0);
  const paying = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshedQuota = useRef('');
  const selected = PLANS.find(plan => plan.id === selectedId) ?? PLANS[1];
  const end = expirationDate(account?.started, account?.duration);
  const expired = end !== null && now !== null && end <= now;
  const remaining = Math.max(0, FREE_LIMIT - (account?.watchCount ?? 0));
  const resetTime = account?.resetVerified && account.resetAt ? Date.parse(account.resetAt) : now === null ? null : nextSundayReset(now);
  const resetSeconds = now !== null && resetTime !== null && Number.isFinite(resetTime) ? Math.max(0, Math.floor((resetTime - now) / 1000)) : null;
  const loadAccount = useCallback(async (manual = false) => {
    const request = ++activeRequest.current;
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!mounted.current || request !== activeRequest.current) return;
      setRefreshing(true); setError(''); setNotice('');
      if (!session) { setAccount(null); router.replace('/login'); return; }
      const { data: profile, error: profileError, resetVerified } = await fetchSubscriptionProfile(session.user.id);
      if (!mounted.current || request !== activeRequest.current) return;
      if (profileError) throw profileError;
      if (!profile || !session.user.email) throw new Error('Impossible de vérifier votre compte. Reconnectez-vous ou contactez l’assistance.');
      const admin = session.user.email === ADMIN_EMAIL;
      setAccount({ id: session.user.id, email: session.user.email, vip: admin || profile.is_vip === true || profile.is_vip === 'true', admin, watchCount: Math.max(0, Number(profile.watch_count) || 0), started: profile.vip_started_at ?? undefined, duration: profile.vip_duration ?? undefined, resetAt: profile.watch_reset_at, resetVerified });
      setNow(Date.now());
      if (manual) setNotice('Votre statut vient d’être actualisé.');
    } catch (err) { if (mounted.current && request === activeRequest.current) setError(err instanceof Error ? err.message : 'Votre compte n’a pas pu être chargé. Réessayez dans quelques instants.'); }
    finally { if (mounted.current && request === activeRequest.current) { setLoading(false); setRefreshing(false); } }
  }, [router]);
  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize account state with the asynchronous Supabase read on mount.
    void loadAccount();
    return () => { mounted.current = false; if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, [loadAccount]);
  useEffect(() => {
    if (!account) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [account]);
  useEffect(() => {
    if (!account || account.vip || !account.resetVerified || !account.resetAt || now === null || now < Date.parse(account.resetAt) || refreshedQuota.current === account.resetAt) return;
    refreshedQuota.current = account.resetAt;
    void loadAccount(true);
  }, [account, now, loadAccount]);
  useEffect(() => {
    const handleReturn = () => { if (document.visibilityState === 'visible' && !paying.current) void loadAccount(); };
    const handlePageShow = () => { paying.current = false; setRedirecting(false); void loadAccount(); };
    document.addEventListener('visibilitychange', handleReturn);
    window.addEventListener('pageshow', handlePageShow);
    return () => { document.removeEventListener('visibilitychange', handleReturn); window.removeEventListener('pageshow', handlePageShow); };
  }, [loadAccount]);
  const subscribe = async () => {
    if (paying.current || !account || account.vip || refreshing || error) return;
    paying.current = true; setRedirecting(true); setError('');
    let navigating = false;
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!session || session.user.id !== account.id) { router.replace('/login'); return; }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('is_vip').eq('id', session.user.id).single();
      if (profileError) throw profileError;
      if (!profile) throw new Error('Votre compte ne peut pas être vérifié. Réessayez avant de payer.');
      if (profile.is_vip === true || profile.is_vip === 'true') { await loadAccount(true); return; }
      window.location.assign(checkoutUrl(selected, session.user.id, session.user.email ?? ''));
      navigating = true;
    } catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'Le paiement ne peut pas être ouvert. Réessayez.'); }
    finally { if (mounted.current && !navigating) { paying.current = false; setRedirecting(false); } }
  };
  const copyId = async () => {
    if (!account) return;
    try { await navigator.clipboard.writeText(account.id); setCopyState('done'); } catch { setCopyState('error'); }
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => { if (mounted.current) setCopyState('idle'); }, 3000);
  };
  const seconds = end !== null && now !== null ? Math.max(0, Math.floor((end - now) / 1000)) : null;
  const countdown = seconds === null ? [] : [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
  if (loading) return <main className={`yf-page yf-subscription ${styles.page}`}><div className={styles.loading}><span className={styles.loader} /><p>Votre expérience VIP se prépare…</p></div></main>;

  return (
    <main className={`yf-page yf-subscription ${styles.page} ${account && !account.vip ? styles.withMobileBar : ''}`}>
      <header className={styles.header}><div className={styles.headerInner}><Link href="/" className={styles.brand}>YAMON<span>FIM</span><small>YAMONFIM VIP</small></Link><div className={styles.headerLinks}><a href="#aide">Besoin d’aide ?</a><Link href="/">Retour au catalogue <span aria-hidden="true">↗</span></Link></div></div></header>
      <div className={styles.container}>
        {error && <div className={styles.error} role="alert"><p>{error}</p><button onClick={() => void loadAccount(true)} disabled={refreshing}>{refreshing ? 'Vérification…' : 'Réessayer'}</button></div>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        <section className={styles.hero}>
          <div className={styles.heroCopy}><p className={styles.eyebrow}><span /> FILMS, SÉRIES ET ENVIES DE CINÉMA</p><h1>{account?.vip ? <>Tu profites de tout,<br /><em>sans limite.</em></> : <>Regarde sans limite.<br /><em>Passe au VIP.</em></>}</h1><p className={styles.intro}>{account?.vip ? 'Votre espace, votre abonnement et tout un catalogue à retrouver. Le plus difficile, c’est de choisir le prochain film.' : 'Le film qu’on attendait. La série qu’on ne lâche plus. Retrouvez tout le catalogue et profitez de vos envies de cinéma sans quota de visionnage.'}</p><div className={styles.heroActions}>{account?.vip ? <Link className={styles.primary} href="/"><Icon name="play" />Explorer le catalogue</Link> : <a className={styles.primary} href="#formules">Découvrir les formules<Icon name="arrow" /></a>}<a href={account?.vip ? '#mon-abonnement' : '#comparatif'} className={styles.textLink}>{account?.vip ? 'Mon abonnement' : 'Comparer les avantages'} <span aria-hidden="true">↗</span></a></div><p className={styles.heroNote}><Icon name="shield" />{account?.vip ? 'Les informations de votre compte, au même endroit.' : `Trois durées. Les mêmes avantages. À partir de ${formatEuro(PLANS[0].price)}.`}</p></div>
          <div className={styles.ticketScene}><div className={styles.ticketGlow} /><div className={styles.ticket}><div className={styles.ticketTop}><span>YAMONFIM</span><Icon name="crown" /></div><p className={styles.ticketLabel}>VOTRE PASSEPORT POUR</p><p className={styles.ticketTitle}>Ton cinéma.<br />Sans limite.</p><div className={styles.ticketPills}><span>FILMS</span><span>SÉRIES</span><span>ILLIMITÉ</span></div><div className={styles.ticketTear} /><div className={styles.ticketBottom}><div><span>ACCÈS</span><strong>{account?.vip ? 'MEMBRE VIP' : 'YAMONFIM VIP'}</strong></div><div className={styles.ticketBarcode} aria-hidden="true" /><span className={styles.ticketStar} aria-hidden="true">✳</span></div></div><span className={styles.ticketCaption}>POUR CEUX QUI AIMENT LES GÉNÉRIQUES DE FIN.</span></div>
        </section>
        <section className={styles.benefits} aria-label="Les avantages VIP">{BENEFITS.map(b => <article key={b.title}><span className={styles.benefitIcon}><Icon name={b.icon} /></span><h2>{b.title}</h2><p>{b.text}</p></article>)}</section>
        {account?.vip ? (
          <section id="mon-abonnement" className={styles.memberSection}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>VOTRE ESPACE MEMBRE</p><h2>Le VIP, côté coulisses.</h2><p>Gardez un œil sur votre accès, puis retrouvez votre prochaine découverte.</p></div>
            <div className={styles.memberGrid}>
              <div className={styles.memberCard}>
                <div className={styles.cardHeading}><span className={styles.memberBadge}><Icon name="crown" />{account.admin ? 'Administrateur' : expired ? 'Échéance à vérifier' : 'Membre VIP'}</span><button className={styles.smallButton} disabled={refreshing} onClick={() => void loadAccount(true)}><Icon name="refresh" />{refreshing ? 'Vérification…' : 'Actualiser mon statut'}</button></div>
                <h3>{account.admin ? 'Votre accès administrateur' : expired ? 'La période indiquée est terminée.' : 'À vous les séances sans quota.'}</h3><p className={styles.accountEmail}>{account.email}</p>
                {account.admin ? <p className={styles.memberNote}>Votre compte dispose de l’accès administrateur. Aucune échéance VIP n’est nécessaire pour cet accès.</p> : end === null ? <p className={styles.memberNote}>Votre compte est marqué VIP. Aucune échéance exploitable n’est renseignée : contactez l’assistance pour vérifier la durée de votre accès.</p> : <><p className={styles.expiry}>Échéance indiquée : <strong>{formatDate(end)}</strong></p>{expired ? <p className={styles.memberNote}>Votre compte est encore marqué VIP, mais sa date de fin est dépassée. Actualisez votre statut ou contactez l’assistance pour vérifier votre situation.</p> : <div className={styles.countdown} aria-label="Temps restant avant l’échéance indiquée">{countdown.map((value, i) => <div key={i}><strong>{String(value).padStart(2, '0')}</strong><span>{['Jours', 'Heures', 'Minutes', 'Secondes'][i]}</span></div>)}</div>}</>}
                <Link href="/" className={styles.memberContinue}>Retourner au catalogue<Icon name="arrow" /></Link>
              </div>
              <aside className={styles.memberAside}><Icon name="help" /><h3>Un accès à vérifier ?</h3><p>Un paiement récent, une durée manquante ou une question sur votre compte ? Retrouvez les informations à transmettre à l’assistance.</p><a href="#aide" className={styles.textLink}>Consulter l’aide <span aria-hidden="true">↗</span></a></aside>
            </div>
          </section>
        ) : (
          <section id="formules" className={styles.pricing}>
            <div className={styles.sectionHeading}><p className={styles.eyebrow}>TON RYTHME, TON FORFAIT</p><h2>Choisis ton forfait.</h2><p>Les mêmes avantages VIP. Seule la durée change.</p></div>
            {account && <div className={styles.quota}><span className={styles.quotaIcon}><Icon name="play" /></span><div><strong>Votre accès gratuit</strong><p>{remaining > 0 ? `${remaining} vision${remaining > 1 ? 's' : ''} disponible${remaining > 1 ? 's' : ''} selon votre compteur actuel.` : 'Votre quota gratuit est atteint.'}</p></div><div className={styles.quotaMeter}><span>{Math.min(account.watchCount, FREE_LIMIT)} / {FREE_LIMIT} utilisées</span><progress max={FREE_LIMIT} value={Math.min(account.watchCount, FREE_LIMIT)} aria-label="Quota gratuit utilisé" /></div></div>}
            {account && <div className={styles.resetCard}>
              <div><span className={styles.benefitIcon}><Icon name="refresh" /></span><h3>{remaining === 0 ? 'Tu pourras bientôt relancer ta séance.' : 'Tes prochaines visions gratuites arrivent.'}</h3><p>{account.resetVerified ? 'Remise à zéro de ton quota gratuit' : 'Prochaine remise à zéro prévue'} · Dimanche à 00 h, heure de Paris</p></div>
              <div className={styles.resetClock} aria-label="Temps avant la prochaine remise à zéro">{resetSeconds === null ? <p>Calcul en cours…</p> : [Math.floor(resetSeconds / 86400), Math.floor(resetSeconds / 3600) % 24, Math.floor(resetSeconds / 60) % 60, resetSeconds % 60].map((value, i) => <div key={i}><strong>{String(value).padStart(2, '0')}</strong><span>{['Jours', 'Heures', 'Minutes', 'Secondes'][i]}</span></div>)}</div>
              {!account.resetVerified && <p className={styles.resetNotice}>Horaire prévu. Utilise « Actualiser mon statut » pour vérifier tes visions disponibles.</p>}
            </div>}
            <fieldset className={styles.plans}>
              <legend className={styles.srOnly}>Choisissez une durée VIP</legend>
              {PLANS.map((plan, i) => <label key={plan.id} className={`${styles.plan} ${selectedId === plan.id ? styles.selected : ''}`}>
                <input className={styles.planRadio} type="radio" name="vip-plan" value={plan.id} checked={selectedId === plan.id} onChange={() => setSelectedId(plan.id)} disabled={redirecting} />
                {plan.badge && <span className={`${styles.planBadge} ${i === 2 ? styles.savingBadge : ''}`}>{plan.badge}</span>}
                <div className={styles.planHeader}><span className={styles.planNumber}>0{i + 1}</span><span className={styles.radioMark} aria-hidden="true">{selectedId === plan.id && <Icon name="check" />}</span></div>
                <h3>{plan.name}</h3><p className={styles.tagline}>{plan.tagline}</p><p className={styles.price}>{formatEuro(plan.price)}<span>pour {plan.name}</span></p><p className={styles.equivalent}>{plan.months ? `Soit ≈ ${formatEuro(plan.price / plan.months)} / mois` : `Soit ≈ ${formatEuro(plan.price / plan.days)} / jour`}</p>
                <div className={styles.planDivider} /><ul>{['Visionnage sans quota', 'Films et séries du catalogue', `Accès VIP pendant ${plan.name}`].map(text => <li key={text}><Icon name="check" />{text}</li>)}</ul><span className={styles.selectPlan}>{selectedId === plan.id ? 'Votre formule sélectionnée' : 'Sélectionner cette formule'}<Icon name={selectedId === plan.id ? 'check' : 'arrow'} /></span>
              </label>)}
            </fieldset>
            <div className={styles.checkout}><div className={styles.checkoutSummary}><span className={styles.checkoutIcon}><Icon name="shield" /></span><div><p className={styles.overline}>VOTRE SÉLECTION</p><h3>VIP {selected.name}<span>{formatEuro(selected.price)}</span></h3><p>{account ? <>Associé au compte <strong>{account.email}</strong></> : 'Votre compte doit être vérifié avant de continuer.'}</p></div></div><div className={styles.checkoutAction}><button className={styles.primary} onClick={() => void subscribe()} disabled={!account || !!error || refreshing || redirecting}>{redirecting ? 'Ouverture de Stripe…' : 'Continuer vers le paiement'}<Icon name="arrow" /></button><span>Paiement sur Stripe · Vérifiez les conditions avant de confirmer.</span></div></div>
            <p className={styles.pricingNote}>Les équivalents par mois ou par jour sont indicatifs. Le prix principal correspond à la période affichée ; le montant et les conditions de paiement sont confirmés sur Stripe.</p>
          </section>
        )}
        <MemberReviews userId={account?.id} admin={account?.admin ?? false} />
        <section id="comparatif" className={styles.comparison}>
          <div><p className={styles.eyebrow}>LE CHOIX EN UN CLIN D’ŒIL</p><h2>Un peu de cinéma.<br /><em>Ou tout votre cinéma.</em></h2><p>Gardez votre compte et vos repères. Le VIP retire le quota de visionnage pendant votre période d’accès.</p></div>
          <div className={styles.tableWrap}><table><caption className={styles.srOnly}>Comparaison de l’accès gratuit et VIP</caption><thead><tr><th scope="col">Votre expérience</th><th scope="col">Gratuit</th><th scope="col"><Icon name="crown" /> VIP</th></tr></thead><tbody>{[{ label: 'Films et séries', free: 'Catalogue', vip: 'Catalogue' }, { label: 'Visionnage', free: `Quota de ${FREE_LIMIT}`, vip: 'Sans quota' }, { label: 'Reprise de lecture', free: 'Inclus', vip: 'Inclus' }, { label: 'Téléphone et ordinateur', free: 'Inclus', vip: 'Inclus' }, { label: 'Durée VIP', free: '—', vip: 'Selon la formule' }].map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.free}</td><td>{row.vip}</td></tr>)}</tbody></table></div>
        </section>
        <section className={styles.faq}>
          <div><p className={styles.eyebrow}>AVANT LE GÉNÉRIQUE</p><h2>Les réponses<br />à vos questions.</h2><p>Un doute ? Vous pouvez aussi retrouver notre assistance juste en dessous.</p><a href="#aide" className={styles.textLink}>J’ai besoin d’aide <span aria-hidden="true">↗</span></a></div>
          <div className={styles.faqItems}>{FAQ.map((item, i) => <details key={item.q} open={i === 0 ? true : undefined}><summary>{item.q}<span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div>
        </section>
        <section id="aide" className={styles.support}>
          <div className={styles.supportIntro}><span className={styles.benefitIcon}><Icon name="help" /></span><p className={styles.eyebrow}>ON RESTE À VOS CÔTÉS</p><h2>Besoin d’un coup de main ?</h2><p>Si vous avez déjà payé, actualisez votre statut avant de recommencer un paiement. Gardez votre reçu Stripe pour faciliter la vérification.</p><div className={styles.supportActions}><Link href="/report" className={styles.secondary}>Contacter l’assistance<Icon name="arrow" /></Link><button className={styles.smallButton} onClick={() => void loadAccount(true)} disabled={refreshing}><Icon name="refresh" />{refreshing ? 'Vérification…' : 'Actualiser mon statut'}</button></div></div>
          <div className={styles.accountDetails}><p className={styles.overline}>À JOINDRE À VOTRE DEMANDE</p><div className={styles.emailDetail}>Email du compte<span>{account?.email || 'Compte non chargé'}</span></div><label htmlFor="client-id">Identifiant client</label><div className={styles.idField}><input id="client-id" readOnly value={account?.id || ''} placeholder="Compte non chargé" /><button onClick={() => void copyId()} disabled={!account} aria-label="Copier votre identifiant client"><Icon name={copyState === 'done' ? 'check' : 'copy'} /></button></div><p className={styles.copyStatus} role="status">{copyState === 'done' ? 'Identifiant copié.' : copyState === 'error' ? 'Copie indisponible. Sélectionnez l’identifiant pour le copier manuellement.' : 'Cet identifiant permet de retrouver votre compte.'}</p><p className={styles.privateNote}><Icon name="shield" />Ne transmettez jamais votre mot de passe ni vos coordonnées bancaires.</p></div>
        </section>
        <footer className={styles.footer}><Link className={styles.brand} href="/">YAMON<span>FIM</span></Link><span>Les belles histoires commencent par une bonne séance.</span><Link href="/">Retour au catalogue ↗</Link></footer>
      </div>
      {account && !account.vip && <div className={styles.mobileBar}><div><span>VIP {selected.name}</span><strong>{formatEuro(selected.price)}</strong></div><button className={styles.primary} disabled={!!error || refreshing || redirecting} onClick={() => void subscribe()}>{redirecting ? 'Ouverture…' : 'Continuer'}<Icon name="arrow" /></button></div>}
    </main>
  );
}
