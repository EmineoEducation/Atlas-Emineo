// src/IngestionPanel.jsx — Atlas Éminéo
// Remplace le bloc d'ingestion dans VueDir (et optionnellement VueRP).
// Gère deux modes : texte Markdown existant + upload PDF/docx/xlsx.
// Appelle /api/ingest côté serveur — aucune clé dans le front.

import { useState, useRef } from 'react'
import { ingestMarkdown, ingestFiles } from './api.js'

const CAMPUS_LIST = ['Paris', 'Nantes', 'Bordeaux', 'Rennes', 'Le Mans', 'Vannes', 'Poitiers', 'La Rochelle']

const ACCEPT = '.pdf,.docx,.xlsx,.xls,.md,.txt'
const ACCEPT_LABEL = 'PDF, Word (.docx), Excel (.xlsx), Markdown'

const P = {
  abysse: '#0B2B2D',
  menthe: '#5DE298',
  givre: '#E3FFF0',
  saumon: '#E89B77',
  petrole: '#134345',
  textm: '#4A6366',
  textl: '#7A9EA0',
  borderm: 'rgba(93,226,152,0.3)',
  redbg: '#FFF0F0',
  red: '#D94F4F',
  amberbg: '#FFFBF0',
  amber: '#D4880A',
}

function card(extra = {}) {
  return {
    background: '#fff',
    borderRadius: 12,
    border: `1px solid rgba(93,226,152,0.2)`,
    padding: '1.25rem 1.5rem',
    marginBottom: '0.75rem',
    ...extra,
  }
}

function Spinner({ size = 18 }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid ${P.givre}`,
      borderTopColor: P.menthe,
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      display: 'inline-block',
      flexShrink: 0,
    }} />
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function IngestionPanel({ onSuccess }) {
  const [mode, setMode] = useState('file')   // 'file' | 'text'
  const [campus, setCampus] = useState('')
  const [files, setFiles] = useState([])     // File[]
  const [mdText, setMdText] = useState('')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileRef = useRef(null)

  const canSubmit = campus.trim() &&
    (mode === 'file' ? files.length > 0 : mdText.trim().length > 50) &&
    !loading

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    setFiles(prev => dedupe([...prev, ...dropped]))
  }

  function dedupe(arr) {
    const seen = new Set()
    return arr.filter(f => {
      const key = f.name + f.size
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  function fileIcon(name) {
    const ext = name.split('.').pop().toLowerCase()
    if (ext === 'pdf') return '📄'
    if (ext === 'docx' || ext === 'doc') return '📝'
    if (ext === 'xlsx' || ext === 'xls') return '📊'
    return '📃'
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' o'
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' Ko'
    return (bytes / (1024 * 1024)).toFixed(1) + ' Mo'
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    setSuccess('')
    setProgress('')

    try {
      let result
      if (mode === 'file') {
        result = await ingestFiles(campus.trim(), files, setProgress)
      } else {
        result = await ingestMarkdown(campus.trim(), mdText, setProgress)
      }

      const msg = `✓ "${result.titre}" chargée sur ${result.campus} — ${result.blocs} bloc(s) détecté(s).`
      setSuccess(msg)
      setFiles([])
      setMdText('')
      setCampus('')
      onSuccess?.()
    } catch (e) {
      setError(e.message || 'Erreur inconnue.')
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  return (
    <div>
      {/* Mode switch */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem' }}>
        {[
          { id: 'file', label: '📎 Upload fichier(s)' },
          { id: 'text', label: '✏️ Coller du Markdown' },
        ].map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setError(''); setSuccess('') }}
            style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.15s',
              background: mode === m.id ? P.menthe : 'rgba(93,226,152,0.08)',
              color: mode === m.id ? P.abysse : P.textm,
              border: `1px solid ${mode === m.id ? P.menthe : P.borderm}`,
              fontWeight: mode === m.id ? 600 : 400,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Campus — liste + saisie libre */}
      <div style={card()}>
        <label style={{ fontSize: 11, fontWeight: 600, color: P.textm, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
          Campus concerné
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.6rem' }}>
          {CAMPUS_LIST.map(c => (
            <button
              key={c}
              onClick={() => setCampus(c)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                transition: 'all 0.15s',
                background: campus === c ? P.menthe : 'rgba(93,226,152,0.06)',
                color: campus === c ? P.abysse : P.textm,
                border: `1px solid ${campus === c ? P.menthe : P.borderm}`,
                fontWeight: campus === c ? 600 : 400,
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={campus}
          onChange={e => setCampus(e.target.value)}
          placeholder="Ou saisir un campus manuellement…"
          style={{
            width: '100%', border: `1px solid ${P.borderm}`, borderRadius: 8,
            padding: '0.5rem 0.75rem', fontSize: 13, color: P.abysse,
            background: 'rgba(93,226,152,0.03)', outline: 'none',
          }}
        />
      </div>

      {/* Upload fichiers */}
      {mode === 'file' && (
        <div style={card()}>
          <label style={{ fontSize: 11, fontWeight: 600, color: P.textm, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
            Documents pédagogiques
          </label>
          <p style={{ fontSize: 11, color: P.textl, marginBottom: '0.75rem', lineHeight: 1.6 }}>
            {ACCEPT_LABEL} — syllabi, plans de formation, RACE, référentiels.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? P.menthe : P.borderm}`,
              borderRadius: 10,
              padding: '2rem 1rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'rgba(93,226,152,0.06)' : 'rgba(93,226,152,0.02)',
              transition: 'all 0.15s',
              marginBottom: files.length ? '0.75rem' : 0,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: '0.5rem' }}>📂</div>
            <div style={{ fontSize: 13, color: P.textm, fontWeight: 500 }}>
              Glisser-déposer ici ou <span style={{ color: P.petrole, textDecoration: 'underline' }}>parcourir</span>
            </div>
            <div style={{ fontSize: 11, color: P.textl, marginTop: '0.25rem' }}>
              PDF · Word · Excel · Markdown
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT}
            style={{ display: 'none' }}
            onChange={e => setFiles(prev => dedupe([...prev, ...Array.from(e.target.files)]))}
          />

          {/* Liste fichiers */}
          {files.length > 0 && (
            <div>
              {files.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.45rem 0.65rem', borderRadius: 8,
                  background: 'rgba(93,226,152,0.06)',
                  border: `1px solid ${P.borderm}`,
                  marginBottom: '0.3rem',
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{fileIcon(f.name)}</span>
                  <span style={{ fontSize: 12, color: P.abysse, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: P.textl, flexShrink: 0 }}>{formatSize(f.size)}</span>
                  <button onClick={() => removeFile(i)} style={{ color: P.textl, fontSize: 16, flexShrink: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Textarea Markdown */}
      {mode === 'text' && (
        <div style={card()}>
          <label style={{ fontSize: 11, fontWeight: 600, color: P.textm, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
            Contenu Markdown
          </label>
          <p style={{ fontSize: 11, color: P.textl, marginBottom: '0.6rem', lineHeight: 1.6 }}>
            Collez le texte de vos syllabi ou plans de formation déjà convertis en Markdown.
          </p>
          <textarea
            value={mdText}
            onChange={e => setMdText(e.target.value)}
            placeholder={`# Syllabus — Module : Benchmark & analyse concurrentielle\n\n## Bloc B1 — Diagnostic & positionnement\n### Compétence C.1 — Organiser un système de veille stratégique\n...`}
            style={{
              width: '100%', minHeight: 200,
              border: `1px solid ${P.borderm}`, borderRadius: 8,
              padding: '0.75rem', fontSize: 12, lineHeight: 1.7,
              color: P.abysse, background: 'rgba(93,226,152,0.02)',
              resize: 'vertical', outline: 'none', fontFamily: 'monospace',
            }}
          />
          <div style={{ textAlign: 'right', fontSize: 11, color: P.textl, marginTop: '0.25rem' }}>
            {mdText.length} caractères
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: P.redbg, border: `1px solid ${P.red}`, borderRadius: 8, fontSize: 12, color: '#8B1A1A', marginBottom: '0.75rem', lineHeight: 1.6 }}>
          ⚠ {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(93,226,152,0.12)', border: `1px solid ${P.menthe}`, borderRadius: 8, fontSize: 13, color: P.petrole, marginBottom: '0.75rem', fontWeight: 500 }}>
          {success}
        </div>
      )}

      {/* Bouton */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          width: '100%', padding: '0.85rem',
          borderRadius: 10, fontSize: 14, fontWeight: 600,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          background: canSubmit
            ? `linear-gradient(135deg, ${P.petrole}, #1D6B6F)`
            : 'rgba(19,67,69,0.12)',
          color: canSubmit ? P.menthe : P.textl,
          border: 'none',
          transition: 'all 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        }}
      >
        {loading ? (
          <>
            <Spinner size={16} />
            <span>{progress || 'Analyse en cours…'}</span>
          </>
        ) : (
          'Analyser avec Claude →'
        )}
      </button>

      {loading && (
        <p style={{ textAlign: 'center', fontSize: 11, color: P.textl, marginTop: '0.5rem' }}>
          Le traitement peut prendre 15 à 45 secondes selon le volume de documents.
        </p>
      )}
    </div>
  )
}
