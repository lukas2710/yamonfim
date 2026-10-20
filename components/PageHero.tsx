import type { ReactNode } from 'react';
import styles from './PageHero.module.css';

interface Props {
  eyebrow: string;
  title: string;
  accent: string;
  description: string;
  cardLabel: string;
  cardTitle: string;
  cardDetail: string;
  variant?: 'play' | 'collection' | 'signal' | 'chart';
  children?: ReactNode;
}

export default function PageHero({ eyebrow, title, accent, description, cardLabel, cardTitle, cardDetail, variant = 'play', children }: Props) {
  return <section className={styles.hero}>
    <div className={styles.copy}><p className={styles.eyebrow}><span />{eyebrow}</p><h1>{title}<br /><em>{accent}</em></h1><p className={styles.description}>{description}</p>{children && <div className={styles.actions}>{children}</div>}<p className={styles.signature}>YAMONFIM <span>LE CINÉMA, À TA FAÇON.</span></p></div>
    <div className={styles.scene} aria-hidden="true"><div className={styles.glow} /><div className={styles.card}><div className={styles.cardTop}><span>YAMONFIM</span><span className={styles.dot} /></div><p className={styles.cardLabel}>{cardLabel}</p><div className={styles.symbol}>{variant === 'chart' ? <div className={styles.bars}>{[28, 48, 35, 70, 55, 90, 76].map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}</div> : variant === 'collection' ? <div className={styles.collection}><i /><i /><i /></div> : variant === 'signal' ? <div className={styles.signal}><i /><i /><i /><i /></div> : <svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="29" stroke="currentColor" /><path d="m26 20 19 12-19 12V20Z" fill="currentColor" /></svg>}</div><p className={styles.cardTitle}>{cardTitle}</p><div className={styles.cardFooter}><span>{cardDetail}</span><span>↗</span></div></div><span className={styles.sceneCaption}>LE PROCHAIN CHAPITRE COMMENCE ICI.</span></div>
  </section>;
}
