import { useState } from 'react'
import { ingererDocuments, sauvegarderFormation } from './api.js'

const CAMPUS_LIST = ['Paris', 'Nantes', 'Bordeaux', 'Rennes', 'Le Mans', 'Vannes', 'Poitiers', 'La Rochelle']

const P = {
  abysse: '#0B2B2D', petrole: '#0d3d2e', menthe: '#5DE298', givre: '#E3FFF0',
  saumon: '#E89B77', textm: '#3d5a50', textl: '#7a9e91', borderm: '#b5dfc9',
  blanc: '#fff', rouge: '#dc2626', rougeClair: '#fef2f2', orange: '#d97706', orangeClair: '#fffbeb',
}

function card(extra = {}) {
  return {
    background: P.blanc, borderRadius: 12,
    border: `1px solid ${P.borderm}`,
    padding: '1.25rem 1.5rem', marginBottom: '0.75rem', ...extra,
  }
}

export default function IngestForm({ onSuccess, userCampus }) {
  const [textes, setTextes]     = useState([''])   // array de textareas (multi-doc)
  const [campus, setCampus]     = useState(userCampus ? [userCampus] : [])
  const [status, setStatus]     = useState(null)   // null | 'loading' | 'error' | 'success'
  const [message, setMessage]   = useState('')
  const [lastData, setLastData] = useState(null)   // debug : données parsées

  const toggleCampus = (c) => {
    setCampus(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    )
  }

  const addDoc = () => setTextes(prev => [...prev, ''])
  const removeDoc = (i) => setTextes(prev => prev.filter((_, j) => j !== i))
  const setDoc = (i, val) => setTextes(prev => prev.map((t, j) => j === i ? val : t))

  const handleSubmit = async () => {
    const docs = textes.filter(t => t.trim().length > 50)
    if (docs.length === 0) {
      setMessage('Colle au moins un document (min. 50 caractères).')
      setStatus('error')
      return
    }
    if (campus.length === 0) {
      setMessage('Sélectionne au moins un campus.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setMessage('Envoi à Claude…')
    setLastData(null)

    try {
      const data = await ingererDocuments(docs, campus, msg => setMessage(msg))
      setLastData(data)
      setMessage('Sauvegarde en base…')
      await sauvegarderFormation(data, campus.length === 1 ? campus[0] : campus)
      setStatus('success')
      setMessage(`✓ Formation "${data.formation?.titre || 'Sans titre'}" ingérée — ${(data.blocs || []).length} bloc(s), ${(data.blocs || []).flatMap(b => b.modules || []).length} module(s)`)
      if (onSuccess) onSuccess(data)
    } catch (e) {
      setStatus('error')
      setMessage(e.message || 'Erreur inconnue')
    }
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 400, color: P.abysse, fontSize: 22, marginTop: 0, marginBottom: '1.5rem' }}>
        Ingestion de formation
      </h2>

      {/* Campus */}
      <div style={card()}>
        <div style={{ fontSize: 11, fontWeight: 600, color: P.textm, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.65rem' }}>
          Campus concerné(s)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {CAMPUS_LIST.map(c => (
            <button
              key={c}
              onClick={() => toggleCampus(c)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 13,
                border: `1px solid ${campus.includes(c) ? P.menthe : P.borderm}`,
                background: campus.includes(c) ? P.givre : P.blanc,
                color: campus.includes(c) ? P.abysse : P.textm,
                fontWeight: campus.includes(c) ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >{c}</button>
          ))}
        </div>
        {campus.length > 1 && (
          <div style={{ fontSize: 11, color: P.textm, marginTop: '0.5rem' }}>
            ℹ️ Cette formation sera visible par les RP de : {campus.join(', ')}
          </div>
        )}
      </div>

      {/* Documents */}
      <div style={card()}>
        <div style={{ fontSize: 11, fontWeight: 600, color: P.textm, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.65rem' }}>
          Documents (Markdown, texte brut, ou contenu copié-collé)
        </div>
        <div style={{ fontSize: 12, color: P.textl, marginBottom: '0.75rem', lineHeight: 1.6 }}>
          Colle ici le contenu de tes documents : syllabus M1, syllabus M2, plan de formation, RACE. Tu peux ajouter plusieurs documents séparément.
        </div>
        {textes.map((t, i) => (
          <div key={i} style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: P.textm }}>Document {i + 1}</span>
              {textes.length > 1 && (
                <button onClick={() => removeDoc(i)} style={{ fontSize: 11, color: P.rouge, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Supprimer
                </button>
              )}
            </div>
            <textarea
              value={t}
              onChange={e => setDoc(i, e.target.value)}
              placeholder="Colle ton document ici…"
              style={{
                width: '100%', minHeight: 160, border: `1px solid ${P.borderm}`,
                borderRadius: 8, padding: '0.65rem', fontSize: 12, color: P.abysse,
                resize: 'vertical', lineHeight: 1.6, outline: 'none', fontFamily: 'monospace',
                background: t.trim() ? P.blanc : P.givre,
              }}
            />
            <div style={{ fontSize: 11, color: P.textl, marginTop: '0.2rem', textAlign: 'right' }}>
              {t.trim().length.toLocaleString()} caractères
            </div>
          </div>
        ))}
        <button
          onClick={addDoc}
          style={{
            border: `1px dashed ${P.borderm}`, background: 'none', color: P.textm,
            borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', width: '100%',
          }}
        >
          + Ajouter un document
        </button>
      </div>

      {/* Message de status */}
      {status === 'error' && (
        <div style={{ background: P.rougeClair, border: `1px solid #fca5a5`, borderRadius: 8, padding: '0.75rem 1rem', fontSize: 13, color: P.rouge, marginBottom: '0.75rem' }}>
          ⚠ {message}
        </div>
      )}
      {status === 'loading' && (
        <div style={{ background: P.givre, border: `1px solid ${P.borderm}`, borderRadius: 8, padding: '0.75rem 1rem', fontSize: 13, color: P.textm, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: `2px solid ${P.borderm}`, borderTopColor: P.menthe, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
          {message}
        </div>
      )}
      {status === 'success' && (
        <div style={{ background: P.givre, border: `1px solid ${P.menthe}`, borderRadius: 8, padding: '0.75rem 1rem', fontSize: 13, color: P.petrole, marginBottom: '0.75rem' }}>
          {message}
        </div>
      )}

      {/* Debug : aperçu JSON si parsing OK */}
      {lastData && (
        <details style={{ marginBottom: '0.75rem' }}>
          <summary style={{ fontSize: 11, color: P.textl, cursor: 'pointer' }}>
            Aperçu JSON parsé ({(lastData.blocs || []).length} blocs · {(lastData.blocs || []).flatMap(b => b.modules || []).length} modules · {(lastData.alertes_detectees || []).length} alertes)
          </summary>
          <pre style={{ fontSize: 10, background: '#f8fffe', border: `1px solid ${P.borderm}`, borderRadius: 6, padding: '0.5rem', overflow: 'auto', maxHeight: 220, color: P.abysse, marginTop: '0.4rem' }}>
            {JSON.stringify(lastData, null, 2).slice(0, 2000)}…
          </pre>
        </details>
      )}

      <button
        onClick={handleSubmit}
        disabled={status === 'loading'}
        style={{
          width: '100%', padding: '12px', borderRadius: 10,
          background: status === 'loading' ? P.textl : P.abysse,
          color: P.blanc, border: 'none', fontSize: 15, fontWeight: 500,
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s',
        }}
      >
        {status === 'loading' ? 'Traitement en cours…' : 'Lancer l\'ingestion'}
      </button>
    </div>
  )
}
