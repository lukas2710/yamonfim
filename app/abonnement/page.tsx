'use client';

import { getPersistentSession } from '@/lib/auth-session';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchSubscriptionProfile } from '@/lib/subscription';
import { fetchCatalogueCards } from '@/lib/client-catalogue';
import { PLANS, RECOMMENDED_PLAN, formatEuro, perMonth, perWeek, savingPercent, checkoutUrl, expirationDate, nextSundayReset, type Plan } from './plans';
import styles from './subscription.module.css';
import sales from './sales.module.css';
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
  { q: 'Qu’est-ce que je gagne avec le VIP ?', a: 'Tu regardes autant de films et d’épisodes que tu veux, sans quota et sans attendre la remise à zéro du dimanche. Les trois offres donnent exactement les mêmes avantages : seule la durée change.' },
  { q: 'Le paiement est-il sécurisé ?', a: 'Oui. Le paiement se fait sur Stripe, une plateforme de paiement utilisée par des millions de sites. Tes coordonnées bancaires ne passent jamais par YAMONFIM. Le montant exact est affiché par Stripe avant que tu confirmes.' },
  { q: 'Comment mon VIP est-il relié à mon compte ?', a: 'Ton email et ton identifiant de compte sont transmis automatiquement à Stripe. Paie avec le compte sur lequel tu es connecté, celui affiché sous les offres.' },
  { q: 'J’ai payé mais je ne suis pas encore VIP ?', a: 'Reviens sur cette page et appuie sur « Actualiser mon statut ». Si rien ne change, contacte l’assistance avec ton reçu Stripe et ton identifiant client (en bas de page). Ne repaie pas une deuxième fois.' },
  { q: 'Quelle offre choisir ?', a: '2 semaines pour essayer. 3 mois si tu regardes régulièrement : c’est 42 % moins cher par jour. 1 an si tu ne veux plus y penser : c’est le prix le plus bas, moins de 1 € par semaine.' },
];
const durationLabel = (seconds: number) => { const d = Math.floor(seconds / 86400), h = Math.floor(seconds / 3600) % 24, m = Math.floor(seconds / 60) % 60; return d ? `${d} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`; };
interface Poster { id: string | number; title?: string; poster?: string; type?: string }
interface Account { id: string; email: string; vip: boolean; admin: boolean; watchCount: number; started?: string; duration?: string; resetAt?: string; resetVerified: boolean }
const formatDate = (value: number) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value);

export default function AbonnementPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState(RECOMMENDED_PLAN);
  const [catalogue, setCatalogue] = useState<Poster[]>([]);
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
      const { data: { session }, error: authError } = await getPersistentSession();
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
    let active = true;
    fetchCatalogueCards<Poster>(supabase).then(rows => { if (active) setCatalogue(rows); }).catch(() => {});
    return () => { active = false; };
  }, []);
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
  const subscribe = async (plan: Plan = selected) => {
    setSelectedId(plan.id);
    if (paying.current || !account || account.vip || refreshing || error) return;
    paying.current = true; setRedirecting(true); setError('');
    let navigating = false;
    try {
      const { data: { session }, error: authError } = await getPersistentSession();
      if (authError) throw authError;
      if (!session || session.user.id !== account.id) { router.replace('/login'); return; }
      const { data: profile, error: profileError } = await supabase.from('profiles').select('is_vip').eq('id', session.user.id).single();
      if (profileError) throw profileError;
      if (!profile) throw new Error('Votre compte ne peut pas être vérifié. Réessayez avant de payer.');
      if (profile.is_vip === true || profile.is_vip === 'true') { await loadAccount(true); return; }
      window.location.assign(checkoutUrl(plan, session.user.id, session.user.email ?? ''));
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
  const posters = catalogue.filter(m => m.poster).slice(0, 32);
  const movies = catalogue.filter(m => m.type === 'movie').length;
  const series = catalogue.filter(m => m.type === 'series').length;
  const cheapestWeek = Math.min(...PLANS.map(perWeek));
  const quotaReached = !!account && !account.vip && remaining === 0;
  const showSales = !account?.vip || account.admin;
  const payDisabled = !account || account.vip || !!error || refreshing || redirecting;
  if (loading) return <main className={`yf-page yf-subscription ${styles.page}`}><div className={styles.loading}><span className={styles.loader} /><p>Votre expérience VIP se prépare…</p></div></main>;

  return (
    <main className={`yf-page yf-subscription ${styles.page} ${account && !account.vip ? styles.withMobileBar : ''}`}>
      <header className={styles.header}><div className={styles.headerInner}><Link href="/" className={styles.brand}>YAMON<span>FIM</span><small>YAMONFIM VIP</small></Link><div className={styles.headerLinks}><a href="#aide">Besoin d’aide ?</a><Link href="/">Retour au catalogue <span aria-hidden="true">↗</span></Link></div></div></header>
      <div className={styles.container}>
        {error && <div className={styles.error} role="alert"><p>{error}</p><button onClick={() => void loadAccount(true)} disabled={refreshing}>{refreshing ? 'Vérification…' : 'Réessayer'}</button></div>}
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {account?.vip && <>
          <section className={styles.hero}>
            <div className={styles.heroCopy}><p className={styles.eyebrow}><span /> FILMS, SÉRIES ET ENVIES DE CINÉMA</p><h1>Tu profites de tout,<br /><em>sans limite.</em></h1><p className={styles.intro}>Votre espace, votre abonnement et tout un catalogue à retrouver. Le plus difficile, c’est de choisir le prochain film.</p><div className={styles.heroActions}><Link className={styles.primary} href="/"><Icon name="play" />Explorer le catalogue</Link><a href="#mon-abonnement" className={styles.textLink}>Mon abonnement <span aria-hidden="true">↗</span></a></div><p className={styles.heroNote}><Icon name="shield" />Les informations de votre compte, au même endroit.</p></div>
            <div className={styles.ticketScene}><div className={styles.ticketGlow} /><div className={styles.ticket}><div className={styles.ticketTop}><span>YAMONFIM</span><Icon name="crown" /></div><p className={styles.ticketLabel}>VOTRE PASSEPORT POUR</p><p className={styles.ticketTitle}>Ton cinéma.<br />Sans limite.</p><div className={styles.ticketPills}><span>FILMS</span><span>SÉRIES</span><span>ILLIMITÉ</span></div><div className={styles.ticketTear} /><div className={styles.ticketBottom}><div><span>ACCÈS</span><strong>MEMBRE VIP</strong></div><div className={styles.ticketBarcode} aria-hidden="true" /><span className={styles.ticketStar} aria-hidden="true">✳</span></div></div><span className={styles.ticketCaption}>POUR CEUX QUI AIMENT LES GÉNÉRIQUES DE FIN.</span></div>
          </section>
          <section className={styles.benefits} aria-label="Les avantages VIP">{BENEFITS.map(b => <article key={b.title}><span className={styles.benefitIcon}><Icon name={b.icon} /></span><h2>{b.title}</h2><p>{b.text}</p></article>)}</section>
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
        </>}
        {showSales && <>
          {account?.admin && <p className={sales.preview}>Aperçu admin : voici la page de vente telle que la voient les membres gratuits. Le paiement est désactivé pour ton compte.</p>}
          <section className={sales.hero}>
            {posters.length > 0 && <div className={sales.wall} aria-hidden="true">{posters.map(m => <img key={m.id} src={m.poster} alt="" loading="lazy" />)}</div>}
            <div className={sales.heroInner}>
              {quotaReached ? <p className={`${sales.status} ${sales.urgent}`}><Icon name="play" />Tes {FREE_LIMIT} visions gratuites sont utilisées. Continue tout de suite avec le VIP.</p>
                : account && !account.vip ? <p className={sales.status}><Icon name="play" />Il te reste {remaining} vision{remaining > 1 ? 's' : ''} gratuite{remaining > 1 ? 's' : ''} cette semaine</p> : null}
              <h1>Regarde tout.<br /><em>Sans limite.</em></h1>
              <p className={sales.lead}>{movies && series ? <><strong>{movies.toLocaleString('fr-FR')} films</strong> et <strong>{series.toLocaleString('fr-FR')} séries</strong></> : 'Tout le catalogue'}, sans quota et sans attendre, sur téléphone, ordinateur et TV. Dès <strong>{formatEuro(cheapestWeek)} par semaine</strong>.</p>
              <a className={`${styles.primary} ${sales.cta}`} href="#formules">Voir les offres VIP<Icon name="arrow" /></a>
              <ul className={sales.trust}><li><Icon name="shield" />Paiement sécurisé Stripe</li><li><Icon name="check" />Activé sur ton compte</li><li><Icon name="screen" />Téléphone, PC & TV</li></ul>
            </div>
          </section>
          <section id="formules" className={sales.offers}>
            <div className={sales.heading}><h2>Choisis ton offre</h2><p>Mêmes avantages partout. Plus c’est long, moins c’est cher.</p></div>
            <div className={sales.plans}>
              {PLANS.map(plan => {
                const featured = plan.id === RECOMMENDED_PLAN;
                const saving = savingPercent(plan);
                return <article key={plan.id} className={`${sales.plan} ${featured ? sales.featured : ''} ${selectedId === plan.id ? sales.active : ''}`} onClick={() => setSelectedId(plan.id)}>
                  {plan.badge && <span className={`${sales.badge} ${featured ? '' : sales.alt}`}>{featured ? 'Recommandé' : 'Le moins cher'}</span>}
                  <h3>{plan.name}</h3><p className={sales.tagline}>{plan.tagline}</p>
                  <p className={sales.price}><strong>{formatEuro(plan.price)}</strong><span>pour {plan.name}</span></p>
                  <p className={sales.equiv}>soit {formatEuro(plan.months ? perMonth(plan) : perWeek(plan))} / {plan.months ? 'mois' : 'semaine'}{saving > 0 && <span className={sales.saving}>−{saving} %</span>}</p>
                  <ul>{['Films et séries en illimité', 'Aucune attente le dimanche', 'Téléphone, ordinateur et TV', `VIP pendant ${plan.name}`].map(text => <li key={text}><Icon name="check" />{text}</li>)}</ul>
                  <button className={`${styles.primary} ${sales.choose} ${featured ? '' : sales.ghost}`} disabled={payDisabled} onClick={e => { e.stopPropagation(); void subscribe(plan); }}>{redirecting && selectedId === plan.id ? 'Ouverture du paiement…' : `Choisir ${plan.name}`}<Icon name="arrow" /></button>
                </article>;
              })}
            </div>
            <p className={sales.secure}><span><Icon name="shield" />Paiement 100 % sécurisé par Stripe</span><span><Icon name="check" />Montant confirmé avant de payer</span>{account && <span><Icon name="crown" />VIP activé sur {account.email}</span>}</p>
          </section>
          <section id="comparatif" className={sales.versus}>
            <div className={sales.heading}><h2>Gratuit ou VIP ?</h2><p>Le VIP, c’est la fin de l’attente.</p></div>
            <div className={sales.vsGrid}>
              <div className={sales.vsCard}><h3>Gratuit</h3><ul><li className={sales.yes}><Icon name="check" />Accès au catalogue</li><li className={sales.no}><Icon name="arrow" />{FREE_LIMIT} visions par semaine seulement</li><li className={sales.no}><Icon name="arrow" />Ensuite, attendre dimanche</li></ul>{account && !account.vip && resetSeconds !== null && <p className={sales.wait}>Sans VIP, prochaines visions gratuites dans <strong>{durationLabel(resetSeconds)}</strong></p>}</div>
              <div className={`${sales.vsCard} ${sales.vip}`}><h3><Icon name="crown" />VIP</h3><ul><li className={sales.yes}><Icon name="check" />Accès au catalogue</li><li className={sales.yes}><Icon name="infinity" />Films et épisodes en illimité</li><li className={sales.yes}><Icon name="check" />Aucune attente, tout de suite</li><li className={sales.yes}><Icon name="screen" />Téléphone, ordinateur et TV</li></ul></div>
            </div>
          </section>
        </>}
        <MemberReviews userId={account?.id} admin={account?.admin ?? false} />
        <section className={styles.faq}>
          <div><p className={styles.eyebrow}>AVANT LE GÉNÉRIQUE</p><h2>Tes questions,<br />nos réponses.</h2><p>Un doute avant de passer VIP ? L’assistance est juste en dessous.</p><a href="#aide" className={styles.textLink}>J’ai besoin d’aide <span aria-hidden="true">↗</span></a></div>
          <div className={styles.faqItems}>{FAQ.map((item, i) => <details key={item.q} open={i === 0 ? true : undefined}><summary>{item.q}<span aria-hidden="true">+</span></summary><p>{item.a}</p></details>)}</div>
        </section>
        {showSales && <section className={sales.final}><h2>Ta prochaine séance t’attend.</h2><p>VIP {PLANS.find(p => p.id === RECOMMENDED_PLAN)!.name} pour {formatEuro(PLANS.find(p => p.id === RECOMMENDED_PLAN)!.price)}, soit {formatEuro(perMonth(PLANS.find(p => p.id === RECOMMENDED_PLAN)!))} par mois.</p><button className={`${styles.primary} ${sales.cta}`} disabled={payDisabled} onClick={() => void subscribe(PLANS.find(p => p.id === RECOMMENDED_PLAN)!)}>{redirecting ? "Ouverture du paiement…" : "Je passe VIP"}<Icon name="arrow" /></button></section>}
        <section id="aide" className={styles.support}>
          <div className={styles.supportIntro}><span className={styles.benefitIcon}><Icon name="help" /></span><p className={styles.eyebrow}>ON RESTE À VOS CÔTÉS</p><h2>Besoin d’un coup de main ?</h2><p>Si vous avez déjà payé, actualisez votre statut avant de recommencer un paiement. Gardez votre reçu Stripe pour faciliter la vérification.</p><div className={styles.supportActions}><Link href="/report" className={styles.secondary}>Contacter l’assistance<Icon name="arrow" /></Link><button className={styles.smallButton} onClick={() => void loadAccount(true)} disabled={refreshing}><Icon name="refresh" />{refreshing ? 'Vérification…' : 'Actualiser mon statut'}</button></div></div>
          <div className={styles.accountDetails}><p className={styles.overline}>À JOINDRE À VOTRE DEMANDE</p><div className={styles.emailDetail}>Email du compte<span>{account?.email || 'Compte non chargé'}</span></div><label htmlFor="client-id">Identifiant client</label><div className={styles.idField}><input id="client-id" readOnly value={account?.id || ''} placeholder="Compte non chargé" /><button onClick={() => void copyId()} disabled={!account} aria-label="Copier votre identifiant client"><Icon name={copyState === 'done' ? 'check' : 'copy'} /></button></div><p className={styles.copyStatus} role="status">{copyState === 'done' ? 'Identifiant copié.' : copyState === 'error' ? 'Copie indisponible. Sélectionnez l’identifiant pour le copier manuellement.' : 'Cet identifiant permet de retrouver votre compte.'}</p><p className={styles.privateNote}><Icon name="shield" />Ne transmettez jamais votre mot de passe ni vos coordonnées bancaires.</p></div>
        </section>
        <footer className={styles.footer}><Link className={styles.brand} href="/">YAMON<span>FIM</span></Link><span>Les belles histoires commencent par une bonne séance.</span><Link href="/">Retour au catalogue ↗</Link></footer>
      </div>
      {account && !account.vip && <div className={styles.mobileBar}><div><span>VIP {selected.name}</span><strong>{formatEuro(selected.price)}</strong></div><button className={styles.primary} disabled={payDisabled} onClick={() => void subscribe()}>{redirecting ? 'Ouverture…' : 'Choisir'}<Icon name="arrow" /></button></div>}
    </main>
  );
}
