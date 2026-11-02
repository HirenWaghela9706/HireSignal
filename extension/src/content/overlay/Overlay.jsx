import React from 'react';
import { createRoot } from 'react-dom/client';
import { ScoreBadge } from './ScoreBadge';
import { SignalTags } from './SignalTags';
import { ExpandedPanel } from './ExpandedPanel';
import styles from './overlay.module.css';

// ── i18n translations ──────────────────────────────────────────────────────
// Keyed by 2-letter IETF language code. Falls back to 'en' for anything
// not listed. navigator.language returns e.g. "de-DE" so we slice to [0,2].
const TRANSLATIONS = {
  en: {
    highIntent:        'High Intent',
    moderateIntent:    'Moderate Intent',
    lowIntent:         'Low Intent',
    ghostRisk:         'High Ghost Job Risk',
    lowConfidence:     'Low confidence — limited signal data',
    notEnoughData:     'Not enough data to score this listing',
    platformIssue:     'Platform not fully supported yet',
    hideDetails:       'Hide details',
    showBreakdown:     'Show signal breakdown',
  },
  de: {
    highIntent:        'Hohe Einstellungsabsicht',
    moderateIntent:    'Moderate Einstellungsabsicht',
    lowIntent:         'Geringe Einstellungsabsicht',
    ghostRisk:         'Hohes Risiko: Geisterstelle',
    lowConfidence:     'Niedrige Konfidenz — wenig Signaldaten',
    notEnoughData:     'Nicht genug Daten für eine Bewertung',
    platformIssue:     'Plattform noch nicht vollständig unterstützt',
    hideDetails:       'Details ausblenden',
    showBreakdown:     'Signalübersicht anzeigen',
  },
  fr: {
    highIntent:        'Forte intention de recrutement',
    moderateIntent:    'Intention modérée',
    lowIntent:         'Faible intention de recrutement',
    ghostRisk:         'Risque élevé : offre fantôme',
    lowConfidence:     'Faible confiance — données limitées',
    notEnoughData:     'Données insuffisantes pour noter cette offre',
    platformIssue:     'Plateforme pas encore entièrement supportée',
    hideDetails:       'Masquer les détails',
    showBreakdown:     'Afficher l\'analyse des signaux',
  },
  es: {
    highIntent:        'Alta intención de contratación',
    moderateIntent:    'Intención moderada',
    lowIntent:         'Baja intención de contratación',
    ghostRisk:         'Alto riesgo: oferta fantasma',
    lowConfidence:     'Baja confianza — datos de señal limitados',
    notEnoughData:     'Datos insuficientes para valorar esta oferta',
    platformIssue:     'Plataforma aún no totalmente compatible',
    hideDetails:       'Ocultar detalles',
    showBreakdown:     'Mostrar desglose de señales',
  },
  it: {
    highIntent:        'Alta intenzione di assunzione',
    moderateIntent:    'Intenzione moderata',
    lowIntent:         'Bassa intenzione di assunzione',
    ghostRisk:         'Alto rischio: offerta fantasma',
    lowConfidence:     'Bassa confidenza — dati limitati',
    notEnoughData:     'Dati insufficienti per valutare questa offerta',
    platformIssue:     'Piattaforma non ancora completamente supportata',
    hideDetails:       'Nascondi dettagli',
    showBreakdown:     'Mostra analisi dei segnali',
  },
  nl: {
    highIntent:        'Hoge wervingsintentie',
    moderateIntent:    'Matige wervingsintentie',
    lowIntent:         'Lage wervingsintentie',
    ghostRisk:         'Hoog risico: spookvacature',
    lowConfidence:     'Lage betrouwbaarheid — beperkte signaaldata',
    notEnoughData:     'Onvoldoende data om deze vacature te beoordelen',
    platformIssue:     'Platform nog niet volledig ondersteund',
    hideDetails:       'Details verbergen',
    showBreakdown:     'Signaloverzicht tonen',
  },
  pt: {
    highIntent:        'Alta intenção de contratação',
    moderateIntent:    'Intenção moderada',
    lowIntent:         'Baixa intenção de contratação',
    ghostRisk:         'Alto risco: oferta fantasma',
    lowConfidence:     'Baixa confiança — dados de sinal limitados',
    notEnoughData:     'Dados insuficientes para avaliar esta oferta',
    platformIssue:     'Plataforma ainda não totalmente suportada',
    hideDetails:       'Ocultar detalhes',
    showBreakdown:     'Mostrar análise de sinais',
  },
  pl: {
    highIntent:        'Wysoka intencja zatrudnienia',
    moderateIntent:    'Umiarkowana intencja',
    lowIntent:         'Niska intencja zatrudnienia',
    ghostRisk:         'Wysokie ryzyko: oferta-widmo',
    lowConfidence:     'Niska pewność — ograniczone dane sygnałów',
    notEnoughData:     'Niewystarczające dane, aby ocenić tę ofertę',
    platformIssue:     'Platforma nie jest jeszcze w pełni obsługiwana',
    hideDetails:       'Ukryj szczegóły',
    showBreakdown:     'Pokaż analizę sygnałów',
  },
  sv: {
    highIntent:        'Hög rekryteringsavsikt',
    moderateIntent:    'Måttlig rekryteringsavsikt',
    lowIntent:         'Låg rekryteringsavsikt',
    ghostRisk:         'Hög risk: spökjobb',
    lowConfidence:     'Låg tillförlitlighet — begränsade signaldata',
    notEnoughData:     'Otillräckliga data för att bedöma denna annons',
    platformIssue:     'Plattformen stöds inte helt ännu',
    hideDetails:       'Dölj detaljer',
    showBreakdown:     'Visa signalanalys',
  },
};

// Resolve translations for the browser UI language.
function useT() {
  const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return TRANSLATIONS[lang] || TRANSLATIONS.en;
}
// ──────────────────────────────────────────────────────────────────────────────

// Shown at the top of every overlay state so the user always sees what job
// is being analysed, even while the score is still loading (Fix 2).
function JobHeader({ metadata }) {
  if (!metadata) return null;
  const company = metadata.companyName || 'Unknown company';
  const role    = metadata.roleTitle   || 'Unknown role';
  return (
    <div className={styles.jobHeader}>
      <div className={styles.jobCompany}>{company}</div>
      <div className={styles.jobTitle}>{role}</div>
    </div>
  );
}

function Overlay({ data, onDismiss }) {
  const [expanded, setExpanded] = React.useState(false);
  const t = useT();

  if (!data) return null;

  const { loading, error, scoreData, metadata } = data;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <JobHeader metadata={metadata} />
          <button className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">×</button>
        </div>
        <div className={styles.skeleton} />
        <div className={styles.skeletonBar} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <JobHeader metadata={metadata} />
            <span className={styles.error}>{error}</span>
          </div>
          <button className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">×</button>
        </div>
      </div>
    );
  }

  if (!scoreData || scoreData.confidence === 'insufficient') {
    const insufficientMsg = scoreData?.platformIssue
      ? t.platformIssue
      : t.notEnoughData;
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <JobHeader metadata={metadata} />
            <span className={styles.noData}>{insufficientMsg}</span>
          </div>
          <button className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">×</button>
        </div>
      </div>
    );
  }

  const { score, band, confidence, ghostRiskFlag, signals } = scoreData;
  const bandClass = band === 'high' ? styles.high : band === 'medium' ? styles.medium : styles.low;
  const intentLabel = ghostRiskFlag ? t.ghostRisk
    : band === 'high'   ? t.highIntent
    : band === 'medium' ? t.moderateIntent
    : t.lowIntent;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <JobHeader metadata={metadata} />
          <ScoreBadge score={score} band={band} />
          <div className={styles.label}>{intentLabel}</div>
        </div>
        <button className={styles.dismiss} onClick={onDismiss} aria-label="Dismiss">×</button>
      </div>
      <div className={styles.progressBar}>
        <div className={`${styles.progressFill} ${bandClass}`} style={{ width: `${score}%` }} />
      </div>
      <SignalTags signals={signals} />
      {confidence === 'low' && (
        <div className={styles.lowConfidence}>{t.lowConfidence}</div>
      )}
      <button className={styles.expandBtn} onClick={() => setExpanded(!expanded)}>
        {expanded ? t.hideDetails : t.showBreakdown}
      </button>
      {expanded && <ExpandedPanel signals={signals} />}
    </div>
  );
}

export default Overlay;
export { Overlay };
export function renderOverlay(container, props) {
  const root = createRoot(container);
  root.render(<Overlay {...props} />);
  return () => root.unmount();
}
