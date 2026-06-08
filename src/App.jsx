import { useState, useEffect, useRef, useCallback } from 'react'

/* ════════════════════════════════════════════════════════════════
   CONFIGURATION — remplacer par les vraies données de la formation
   ════════════════════════════════════════════════════════════════ */
const CONFIG = {
  nomReseau:   "Éminéo Éducation",
  nomAtlas:    "Atlas des compétences",
  annee:       "2026–27",
  campus:      ["Paris", "Bordeaux", "Nantes", "Rennes", "Le Mans"],
  promos:      ["BUT 1", "BUT 2", "BUT 3", "Master 1", "Master 2"],
  groupes:     ["Groupe A", "Groupe B", "Groupe C"],
}

/* ════════════════════════════════════════════════════════════════
   RÔLES — 4 acteurs de la béta
   ════════════════════════════════════════════════════════════════ */
const ROLES = [
  { id: "dir",          icon: "◈", label: "Direction des programmes",   desc: "Vue réseau · Couverture · Alertes" },
  { id: "rp",           icon: "◉", label: "Responsable pédagogique",    desc: "Mon campus · Blocs · Alertes" },
  { id: "intervenant",  icon: "◎", label: "Intervenant",                desc: "Fiche J‑1 · Déclaration post-séance" },
  { id: "etudiant",     icon: "○", label: "Étudiant",                   desc: "Mon parcours · Auto-évaluation" },
]

/* ════════════════════════════════════════════════════════════════
   DONNÉES MOCK — remplacées par l'ingestion réelle post-béta
   Structure générique : blocs / compétences / modules (pas de codes RNCP)
   ════════════════════════════════════════════════════════════════ */
const BLOCS_MOCK = [
  { id: "B1", titre: "Fondamentaux & analyse",
    pct: 68, comp: 5, act: 3, status: "amber",
    detail: ["Méthodes d'analyse", "Environnement et veille", "Outils de diagnostic", "Interprétation des données", "Rapport de synthèse"],
    alert: "Notion «veille» couverte par 2 intervenants sans coordination formalisée." },
  { id: "B2", titre: "Conception & stratégie",
    pct: 55, comp: 6, act: 2, status: "blue",
    detail: ["Définition des objectifs", "Ciblage et segmentation", "Architecture de solution", "Gestion de projet", "Planification", "Budget et ressources"],
    alert: null },
  { id: "B3", titre: "Déploiement & pilotage",
    pct: 38, comp: 7, act: 3, status: "red",
    detail: ["Cahier des charges", "Méthodes agiles", "Coordination d'équipe", "Gestion des parties prenantes", "Mesure d'impact", "Indicateurs de performance", "Corrections et itérations"],
    alert: "Méthodes agiles abordées en parallèle par 3 intervenants — chevauchement non coordonné." },
  { id: "B4", titre: "Innovation & transversal",
    pct: 42, comp: 4, act: 2, status: "gray",
    detail: ["Veille technologique", "Innovation de processus", "Durabilité & RSE", "Éthique professionnelle"],
    alert: null },
]

const CAMPUS_STATS_MOCK = {
  "Paris":    { coverage: 72, alertes: 2, syllabi: "18/18", groupes: ["Groupe A", "Groupe B"] },
  "Bordeaux": { coverage: 55, alertes: 3, syllabi: "16/18", groupes: ["Groupe A"] },
  "Nantes":   { coverage: 65, alertes: 1, syllabi: "17/18", groupes: ["Groupe A", "Groupe B"] },
  "Rennes":   { coverage: 68, alertes: 1, syllabi: "18/18", groupes: ["Groupe A", "Groupe B"] },
  "Le Mans":  { coverage: 48, alertes: 2, syllabi: "14/18", groupes: ["Groupe A"] },
}

const ALERTES_MOCK = [
  { id: "A1", niveau: 2, concept: "Veille stratégique", campus: "Paris",
    modules: ["Environnement & tendances", "Outils de veille"],
    intervenants: ["Sophie Martin", "David Leroy"],
    message: "Deux intervenants couvrent la veille sans articulation — une coordination enrichirait les deux séquences." },
  { id: "A2", niveau: 2, concept: "Méthodes agiles", campus: "Bordeaux",
    modules: ["Gestion de projet agile", "Sprint & itération", "Design thinking"],
    intervenants: ["Romain Blanc", "Claire Dubois", "Eva Petit"],
    message: "3 intervenants abordent les méthodes agiles en parallèle sans séquençage pédagogique défini." },
  { id: "A3", niveau: 3, concept: "IA & automatisation", campus: "Nantes",
    modules: ["Outils numériques", "Optimisation des processus"],
    intervenants: ["Marc Faure", "Pierre Garnier"],
    message: "Signal doux — l'IA générative mentionnée dans 2 modules sans articulation explicite." },
  { id: "A4", niveau: 2, concept: "Mesure d'impact", campus: "Rennes",
    modules: ["Indicateurs de performance", "Rapport de synthèse"],
    intervenants: ["Lucie Bernard", "Antoine Morel"],
    message: "La mesure d'impact est abordée sous deux angles différents — une coordination clarifierait la progression." },
]

const SEANCES_MOCK = [
  { n:1, titre:"Introduction & cadrage",          concepts:["Environnement","Enjeux"],        date:"15/09", fait:true  },
  { n:2, titre:"Méthodes d'analyse",              concepts:["Diagnostic","SWOT"],             date:"22/09", fait:true  },
  { n:3, titre:"Cartographie des acteurs",        concepts:["Parties prenantes","Mapping"],   date:"29/09", fait:true  },
  { n:4, titre:"Analyse des besoins",             concepts:["Utilisateur","Données"],         date:"06/10", fait:true  },
  { n:5, titre:"Restitution et recommandations",  concepts:["Synthèse","Pitch"],              date:"13/10", fait:false },
  { n:6, titre:"Cas pratique & évaluation",       concepts:["Application","Livrable"],        date:"20/10", fait:false },
]

const COMP_ETUDIANT_MOCK = [
  { id:"C1.1", libelle:"Conduire une analyse de l'environnement",     bloc:"B1", module:"Environnement & tendances",   statut:null, retex:"" },
  { id:"C1.2", libelle:"Utiliser les outils de veille informationnelle", bloc:"B1", module:"Outils de veille",          statut:null, retex:"" },
  { id:"C1.3", libelle:"Rédiger un rapport de diagnostic",            bloc:"B1", module:"Méthodes de diagnostic",      statut:null, retex:"" },
  { id:"C2.1", libelle:"Fixer des objectifs opérationnels",           bloc:"B2", module:"Conception de projet",        statut:null, retex:"" },
  { id:"C2.2", libelle:"Élaborer une stratégie adaptée au contexte",  bloc:"B2", module:"Stratégie & planification",   statut:null, retex:"" },
  { id:"C3.1", libelle:"Rédiger un cahier des charges",               bloc:"B3", module:"Management de projet",        statut:null, retex:"" },
  { id:"C3.2", libelle:"Piloter un projet en méthode agile",          bloc:"B3", module:"Méthodes agiles",             statut:null, retex:"" },
]

const MODULES_TUTEUR_MOCK = [
  { id:"M1", titre:"Environnement & tendances",    comp:"C1.1", pct:85, etudiantStatut:"acquis",    etudiantRetex:"Bonne maîtrise de l'analyse. Veille encore perfectible." },
  { id:"M2", titre:"Outils de veille",             comp:"C1.2", pct:100,etudiantStatut:"acquis",    etudiantRetex:"" },
  { id:"M3", titre:"Conception de projet",         comp:"C2.1", pct:72, etudiantStatut:"voie",      etudiantRetex:"Je comprends les objectifs mais j'ai du mal à les formuler de façon opérationnelle." },
  { id:"M4", titre:"Méthodes agiles",              comp:"C3.2", pct:33, etudiantStatut:null,         etudiantRetex:"" },
  { id:"M5", titre:"Stratégie & planification",    comp:"C2.2", pct:50, etudiantStatut:"nonacquis", etudiantRetex:"Séance trop dense, j'ai décroché sur la partie planification." },
  { id:"M6", titre:"Management de projet",         comp:"C3.1", pct:0,  etudiantStatut:null,         etudiantRetex:"" },
]

/* ════════════════════════════════════════════════════════════════
   GRAPHE — nœuds et liens
   ════════════════════════════════════════════════════════════════ */
const GNODES = [
  { id:"B1", label:"B1\nFondamentaux\n& analyse",    x:.18, y:.25, comp:5, act:3, status:"amber",
    alert:"Veille (C1.2) couverte sans coordination inter-intervenants.",
    detail:["Méthodes d'analyse","Veille","Diagnostic","Interprétation","Synthèse"] },
  { id:"B2", label:"B2\nConception\n& stratégie",    x:.65, y:.18, comp:6, act:2, status:"blue", alert:null,
    detail:["Objectifs","Ciblage","Architecture","Gestion de projet","Planification","Budget"] },
  { id:"B3", label:"B3\nDéploiement\n& pilotage",    x:.75, y:.65, comp:7, act:3, status:"red",
    alert:"Méthodes agiles : 3 intervenants en parallèle — chevauchement non coordonné.",
    detail:["CDC","Agile","Équipe","Parties prenantes","Mesure","KPI","Corrections"] },
  { id:"B4", label:"B4\nInnovation\n& transversal",  x:.38, y:.75, comp:4, act:2, status:"gray", alert:null,
    detail:["Veille techno","Innovation","RSE","Éthique"] },
  { id:"RSE", label:"RSE\ntransversal", x:.46, y:.44, comp:0, act:0, status:"teal",
    alert:"RSE présent dans plusieurs compétences des 3 blocs.",
    detail:["B1 → éthique données","B2 → durabilité","B3 → impact social","B4 → RSE opérationnel"] },
  { id:"VEI", label:"Veille &\nintelligence", x:.10, y:.55, comp:0, act:0, status:"teal", alert:null,
    detail:["Veille stratégique","Tendances marché","Outils numériques","Indicateurs"] },
]
const GLINKS = [
  {a:"B1",b:"B2",w:3},{a:"B2",b:"B3",w:3},{a:"B1",b:"B3",w:1},
  {a:"B3",b:"B4",w:2},{a:"B2",b:"B4",w:1},
  {a:"RSE",b:"B1",w:2},{a:"RSE",b:"B2",w:2},{a:"RSE",b:"B3",w:3},{a:"RSE",b:"B4",w:2},
  {a:"VEI",b:"B1",w:3},{a:"VEI",b:"B2",w:1},{a:"VEI",b:"B3",w:1},
]

/* ════════════════════════════════════════════════════════════════
   MOTEUR CLAUDE — via Vercel serverless proxy (clé protégée)
   ════════════════════════════════════════════════════════════════ */
async function callClaude(messages, onToken) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    // Mode demo : fiche simulée
    await new Promise(r => setTimeout(r, 900))
    return null
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 900,
      stream: true,
      messages,
    }),
  })
  if (!res.ok) throw new Error("Claude HTTP " + res.status)
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split("\n"); buf = lines.pop()
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const d = line.slice(6).trim()
      if (d === "[DONE]") return
      try {
        const evt = JSON.parse(d)
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          onToken && onToken(evt.delta.text)
        }
      } catch (e) {}
    }
  }
}

async function genererFicheJ1(contexte, onToken) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) {
    await new Promise(r => setTimeout(r, 1100))
    return {
      ancrage: "Cette séance s'inscrit dans la continuité des analyses précédentes et prépare la mise en pratique sur cas réel.",
      dejavu: [
        { intervenant:"David Leroy",  module:"Outils de veille",         concepts:["Veille","Sources"],              lien:"Les étudiants ont cartographié les sources d'information — appuyez-vous sur cette base." },
        { intervenant:"Claire Dubois",module:"Méthodes de diagnostic",   concepts:["SWOT","Positionnement"],         lien:"Le cadre d'analyse a été posé — les étudiants sont prêts pour l'approfondissement." },
      ],
      apres: [
        { date:"27/10", intervenant:"Marc Faure",   module:"Conception de projet",   concepts:["Objectifs","Cahier des charges"] },
        { date:"03/11", intervenant:"Lucie Bernard", module:"Méthodes agiles",        concepts:["Sprint","Itération"] },
      ],
    }
  }
  const prompt = `Tu es un assistant pédagogique spécialisé dans la coordination inter-intervenants.
Génère une fiche contexte J-1 pour cet intervenant en tenant compte du corpus pédagogique disponible.
Contexte : ${JSON.stringify(contexte)}
Réponds UNIQUEMENT avec ce JSON (sans markdown ni backticks) :
{"ancrage":"phrase contextuelle 2 lignes max","dejavu":[{"intervenant":"...","module":"...","concepts":["..."],"lien":"conseil concret"}],"apres":[{"date":"JJ/MM","intervenant":"...","module":"...","concepts":["..."]}]}`

  let full = ""
  await callClaude([{ role: "user", content: prompt }], tok => {
    full += tok
    onToken && onToken(full)
  })
  try {
    return JSON.parse(full.replace(/```json|```/g, "").trim())
  } catch {
    return { ancrage: full.slice(0, 120), dejavu: [], apres: [] }
  }
}

/* ════════════════════════════════════════════════════════════════
   UTILITAIRES UI
   ════════════════════════════════════════════════════════════════ */
const P = {
  // Charte Éminéo
  abysse:  "#0B2B2D", petrole:  "#134547",
  menthe:  "#5DE298", givre:    "#E3FFF0",
  eau:     "#9DF0C4", saumon:   "#E89B77",
  // Sémantique
  surface: "#FFFFFF", surface2: "#F5FDF8",
  border:  "rgba(19,69,71,0.12)", borderM: "rgba(93,226,152,0.25)",
  textM:   "#4A706E", textL:    "rgba(11,43,45,0.45)",
  // Alertes
  amber:   "#EF9F27", amberBg:  "#FFF8ED",
  red:     "#E24B4A", redBg:    "#FEF2F2",
}

// Status → couleurs nœud graphe
const SCOL = { blue: "#5DE298", amber: "#EF9F27", red: "#E24B4A", gray: "#8EADA8", teal: "#9DF0C4" }
const SFIL = { blue: "rgba(93,226,152,0.12)", amber: "rgba(239,159,39,0.12)", red: "rgba(226,75,74,0.10)", gray: "rgba(19,69,71,0.06)", teal: "rgba(157,240,196,0.18)" }

function Tag({ label, color = "blue", small }) {
  const styles = {
    blue:  { bg: "rgba(93,226,152,0.15)",  fg: P.petrole },
    amber: { bg: P.amberBg,               fg: "#7A4A00" },
    teal:  { bg: "rgba(157,240,196,0.25)", fg: P.abysse  },
    red:   { bg: P.redBg,                 fg: "#8B1A1A"  },
    gray:  { bg: "rgba(19,69,71,0.08)",   fg: P.textM   },
  }
  const s = styles[color] || styles.gray
  return (
    <span style={{
      background: s.bg, color: s.fg,
      fontSize: small ? 10 : 12, fontWeight: 500,
      padding: small ? "2px 7px" : "3px 10px",
      borderRadius: 20, display: "inline-block", lineHeight: 1.6, whiteSpace: "nowrap",
    }}>{label}</span>
  )
}

function Avatar({ name, size = 32 }) {
  const ini = (name || "?").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()
  const cols = [
    ["rgba(93,226,152,0.2)",  P.petrole],
    ["rgba(157,240,196,0.3)", P.abysse],
    ["rgba(232,155,119,0.2)", "#6B3A20"],
  ]
  const [bg, fg] = cols[(name || "").charCodeAt(0) % 3]
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 600, flexShrink: 0,
      border: `1px solid ${P.borderM}`,
    }}>{ini}</div>
  )
}

function Bar({ pct, color = "blue", h = 4 }) {
  const fills = { blue: P.menthe, teal: P.eau, red: P.red, amber: P.amber }
  return (
    <div style={{ background: "rgba(19,69,71,0.10)", borderRadius: 99, height: h, overflow: "hidden", width: "100%" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: fills[color] || P.menthe, borderRadius: 99, transition: "width 0.6s ease" }} />
    </div>
  )
}

function Spinner() {
  return <div style={{ width: 20, height: 20, border: `2px solid ${P.borderM}`, borderTopColor: P.menthe, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
}

function card(x = {}) {
  return {
    background: P.surface, borderRadius: 12, border: `1px solid ${P.border}`,
    padding: "1.25rem 1.4rem", marginBottom: "0.8rem",
    boxShadow: "0 1px 6px rgba(11,43,45,0.06)", ...x,
  }
}

function baseR(n) { return n.comp === 0 ? 22 : 26 + n.comp * 4.5 + n.act * 3 }

/* ════════════════════════════════════════════════════════════════
   GRAPHE CANVAS
   ════════════════════════════════════════════════════════════════ */
function GrapheCanvas({ onBabouchka, showAllAlerts = true }) {
  const cvRef = useRef(null)
  const [panel, setPanel] = useState(null)

  const draw = useCallback(() => {
    const cv = cvRef.current; if (!cv) return
    const w = cv.width  = cv.parentElement.clientWidth
    const h = cv.height = 460
    const ctx = cv.getContext("2d")
    ctx.clearRect(0, 0, w, h)

    GLINKS.forEach(l => {
      const a = GNODES.find(n => n.id === l.a), b = GNODES.find(n => n.id === l.b)
      if (!a || !b) return
      ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h)
      ctx.strokeStyle = "rgba(93,226,152,0.20)"; ctx.lineWidth = l.w * 0.7; ctx.stroke()
    })

    GNODES.forEach(n => {
      const x = n.x * w, y = n.y * h, r = baseR(n)
      if (n.status === "red") {
        ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2)
        ctx.strokeStyle = "rgba(226,75,74,0.25)"; ctx.lineWidth = 4; ctx.stroke()
      }
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = SFIL[n.status] || SFIL.gray; ctx.fill()
      ctx.strokeStyle = SCOL[n.status] || "#8EADA8"; ctx.lineWidth = n.status === "red" ? 2.5 : 1.5; ctx.stroke()

      ctx.fillStyle = P.abysse
      const fs = Math.max(9, r * 0.19)
      ctx.font = `500 ${fs}px 'Inter',system-ui`
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      const lines = n.label.split("\n"); const lh = fs * 1.35
      lines.forEach((ln, i) => ctx.fillText(ln, x, y + (i - (lines.length - 1) / 2) * lh))
      if (n.comp > 0) {
        ctx.font = `400 ${Math.max(8, r * 0.155)}px 'Inter',system-ui`
        ctx.fillStyle = SCOL[n.status] || P.textM
        ctx.fillText(`${n.comp}C · ${n.act}A`, x, y + (lines.length / 2) * lh + 3)
      }
    })
  }, [])

  useEffect(() => {
    draw()
    window.addEventListener("resize", draw)
    return () => window.removeEventListener("resize", draw)
  }, [draw])

  function getHit(e) {
    const cv = cvRef.current; if (!cv) return null
    const rect = cv.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (cv.width / rect.width)
    const my = (e.clientY - rect.top)  * (cv.height / rect.height)
    return GNODES.find(n => {
      const dx = mx - n.x * cv.width, dy = my - n.y * cv.height
      return Math.sqrt(dx*dx + dy*dy) <= baseR(n)
    })
  }

  return (
    <div style={{ position: "relative", borderRadius: 12, border: `1px solid ${P.border}`, overflow: "hidden", background: "rgba(227,255,240,0.35)" }}>
      <canvas ref={cvRef} style={{ display: "block", cursor: "default" }}
        onMouseMove={e => {
          const n = getHit(e)
          const tip = document.getElementById("gtip")
          if (n && tip) {
            e.currentTarget.style.cursor = "pointer"
            tip.style.opacity = "1"
            tip.style.left = (e.clientX + 14) + "px"
            tip.style.top  = Math.max(8, e.clientY - 12) + "px"
            tip.innerHTML = `<strong style="color:${SCOL[n.status]}">${n.id}</strong>${n.comp ? ` · ${n.comp}C · ${n.act}A` : " · transversal"}<br><span style="color:rgba(227,255,240,0.6);font-size:11px">${n.label.split("\n").join(" ")}</span>${n.alert && showAllAlerts ? `<div style="margin-top:5px;color:#EF9F27;font-size:11px">⚠ ${n.alert}</div>` : ""}`
          } else {
            e.currentTarget.style.cursor = "default"
            if (tip) tip.style.opacity = "0"
          }
        }}
        onMouseLeave={() => { const tip = document.getElementById("gtip"); if (tip) tip.style.opacity = "0" }}
        onClick={e => {
          const tip = document.getElementById("gtip"); if (tip) tip.style.opacity = "0"
          const n = getHit(e)
          if (!n) { setPanel(null); return }
          if (n.status === "red" && onBabouchka) { onBabouchka(n); return }
          setPanel(prev => prev && prev.id === n.id ? null : n)
        }}
      />
      {/* Légende */}
      <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(11,43,45,0.88)", borderRadius: 8, padding: "7px 11px", border: `1px solid ${P.borderM}`, fontSize: 10, color: P.givre, backdropFilter: "blur(6px)" }}>
        {[["#5DE298","Nominal"],["#EF9F27","Coordination"],["#E24B4A","Incohérence → Zoom"],["#9DF0C4","Transversal"],["#8EADA8","Non déclaré"]].map(([c,l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", marginBottom: 3 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block", marginRight: 5, flexShrink: 0 }} />{l}
          </div>
        ))}
        <div style={{ marginTop: 4, color: "rgba(227,255,240,0.4)", borderTop: "1px solid rgba(93,226,152,0.15)", paddingTop: 4 }}>Taille = C×A · Épaisseur = fréquence</div>
      </div>
      {/* Panel latéral */}
      {panel && (
        <div style={{ position: "absolute", right: 0, top: 0, width: 240, height: "100%", background: "rgba(11,43,45,0.96)", borderLeft: `1px solid ${P.borderM}`, padding: "0.9rem", overflowY: "auto", backdropFilter: "blur(6px)", animation: "fadeIn 0.2s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
            <span style={{ fontFamily: "var(--font-titre)", fontSize: 13, color: P.givre, lineHeight: 1.3, flex: 1 }}>{panel.label.split("\n").join(" ")}</span>
            <button onClick={() => setPanel(null)} style={{ color: P.textM, fontSize: 16, padding: "0 0 0 6px", flexShrink: 0 }}>×</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: "0.5rem" }}>
            {panel.detail.map(d => <span key={d} style={{ background: "rgba(93,226,152,0.12)", color: P.givre, fontSize: 10, fontWeight: 500, padding: "2px 6px", borderRadius: 20 }}>{d}</span>)}
          </div>
          {panel.alert && showAllAlerts && (
            <div style={{ padding: "0.5rem 0.65rem", background: "rgba(239,159,39,0.15)", borderLeft: `3px solid ${P.amber}`, borderRadius: "0 6px 6px 0", fontSize: 11, color: "#FFD580", lineHeight: 1.5 }}>{panel.alert}</div>
          )}
        </div>
      )}
      <div style={{ position: "absolute", bottom: 8, left: 10, fontSize: 10, color: "rgba(227,255,240,0.35)" }}>Survol = détail · Clic rouge → zoom</div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   BABOUCHKA — drill-down
   ════════════════════════════════════════════════════════════════ */
function Babouchka({ node, onBack, showRedFlags = false }) {
  const [niv, setNiv] = useState("comp")
  const [comp, setComp] = useState(null)
  const comps = node.detail || []
  const pcts  = [45, 68, 35, 72, 55, 40, 80]

  return (
    <div style={{ background: P.surface, borderRadius: 12, border: `1px solid ${P.red}`, overflow: "hidden", marginTop: "0.75rem", animation: "fadeUp 0.3s ease" }}>
      <div style={{ background: P.abysse, padding: "8px 14px", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button onClick={onBack} style={{ background: "rgba(93,226,152,0.12)", border: `1px solid ${P.borderM}`, color: P.givre, borderRadius: 6, padding: "2px 9px", fontSize: 11 }}>← Retour</button>
        <span style={{ color: "rgba(227,255,240,0.4)", fontSize: 11 }}>Investigation :</span>
        <span style={{ color: P.givre, fontSize: 13, fontWeight: 500 }}>{node.id} — {node.label.split("\n").slice(1).join(" ")}</span>
        {node.alert && <span style={{ marginLeft: "auto", background: "rgba(226,75,74,0.2)", color: "#FFB8B8", fontSize: 10, padding: "2px 7px", borderRadius: 20 }}>⚠ Incohérence</span>}
      </div>
      {node.alert && (
        <div style={{ margin: "0.75rem 1rem 0", padding: "0.55rem 0.8rem", background: P.redBg, borderLeft: `3px solid ${P.red}`, borderRadius: "0 6px 6px 0", fontSize: 12, color: "#8B1A1A", lineHeight: 1.5 }}>{node.alert}</div>
      )}
      <div style={{ padding: "0.9rem 1rem" }}>
        <div style={{ display: "flex", gap: "0.4rem", fontSize: 12, color: P.textM, marginBottom: "0.75rem" }}>
          <span onClick={() => { setNiv("comp"); setComp(null) }} style={{ cursor: "pointer", color: niv === "comp" ? P.abysse : P.petrole, fontWeight: niv === "comp" ? 600 : 400 }}>Compétences</span>
          {comp && <><span>›</span><span style={{ color: P.textM }}>{comp.slice(0, 30)}…</span></>}
        </div>
        {niv === "comp" && comps.map((c, i) => {
          const p = pcts[i] || 50
          const col = p < 40 ? P.red : p < 65 ? P.amber : P.menthe
          return (
            <div key={c} onClick={() => { setComp(c); setNiv("mod") }}
              style={{ background: P.surface, borderRadius: 8, border: `1px solid ${P.border}`, padding: "0.6rem 0.8rem", marginBottom: "0.4rem", cursor: "pointer", borderLeft: `3px solid ${col}` }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 3px 10px rgba(11,43,45,0.08)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: P.abysse }}>{c}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: col }}>{p}%</span>
              </div>
              <Bar pct={p} color={p < 40 ? "red" : p < 65 ? "amber" : "blue"} />
              {showRedFlags && p < 40 && <div style={{ fontSize: 10, color: P.red, marginTop: "0.25rem" }}>🚩 Couverture insuffisante — action requise</div>}
            </div>
          )
        })}
        {niv === "mod" && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 500, color: P.abysse, marginBottom: "0.6rem" }}>{comp}</p>
            {SEANCES_MOCK.slice(0, 4).map(s => (
              <div key={s.n} style={{ background: P.surface, borderRadius: 8, border: `1px solid ${P.border}`, padding: "0.55rem 0.8rem", marginBottom: "0.35rem", borderLeft: `3px solid ${s.fait ? P.menthe : P.border}`, opacity: s.fait ? 1 : 0.65 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", background: s.fait ? "rgba(93,226,152,0.15)" : "rgba(19,69,71,0.06)", color: s.fait ? P.petrole : P.textM, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, flexShrink: 0 }}>{s.n}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: P.abysse }}>{s.titre}</span>
                  {s.fait && <Tag label="✓" color="blue" small />}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", paddingLeft: 24 }}>
                  {s.concepts.map(c => <Tag key={c} label={c} small />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ padding: "0 1rem 0.9rem" }}>
        <div style={{ padding: "0.55rem 0.8rem", background: "rgba(93,226,152,0.08)", borderRadius: 6, fontSize: 11, color: P.petrole, border: `1px solid ${P.borderM}` }}>Action suggérée : réunion de coordination des intervenants concernés.</div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   TOPBAR commune
   ════════════════════════════════════════════════════════════════ */
function Topbar({ role, campus, onBack, onglet, setOnglet, onglets }) {
  const roleLabel = ROLES.find(r => r.id === role)?.label || ""
  return (
    <div style={{ height: 52, display: "flex", alignItems: "center", gap: "0.65rem", padding: "0 1.25rem", position: "sticky", top: 0, zIndex: 100, background: P.surface, borderBottom: `1px solid ${P.border}`, boxShadow: "0 1px 8px rgba(11,43,45,0.06)" }}>
      <button onClick={onBack} style={{ color: P.textM, fontSize: 18, lineHeight: 1, padding: "0 4px" }}>←</button>
      {/* Logo Éminéo simplifié */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 10, borderRight: `1px solid ${P.border}` }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: P.petrole, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: P.menthe, fontSize: 11, fontWeight: 700, fontFamily: "var(--font-titre)", fontStyle: "italic" }}>e</span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, color: P.petrole, letterSpacing: "0.06em", textTransform: "uppercase" }}>Éminéo</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: P.abysse, lineHeight: 1.2 }}>{roleLabel}{campus ? ` · ${campus}` : ""}</div>
        <div style={{ fontSize: 10, color: P.textL }}>Atlas des compétences · {CONFIG.annee}</div>
      </div>
      <div style={{ display: "flex", gap: "0.3rem" }}>
        {onglets.map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)} style={{
            borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 500,
            background: onglet === t.id ? "rgba(93,226,152,0.15)" : "transparent",
            border: `1px solid ${onglet === t.id ? P.borderM : "transparent"}`,
            color: onglet === t.id ? P.petrole : P.textM,
            transition: "all 0.15s",
          }}>{t.label}</button>
        ))}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   LANDING — charte Éminéo
   ════════════════════════════════════════════════════════════════ */
function Landing({ onEnter }) {
  const [role, setRole] = useState(null)
  const [campus, setCampus] = useState(null)
  const [promo, setPromo] = useState(null)
  const [groupe, setGroupe] = useState(null)

  const needsCampus = role && role !== "dir"
  const needsPromo  = role === "etudiant"
  const needsGroupe = role === "etudiant"

  const canEnter = () => {
    if (!role) return false
    if (needsCampus && !campus) return false
    if (needsPromo && !promo) return false
    return true
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--grad-fond)", display: "flex", alignItems: "stretch", position: "relative", overflow: "hidden" }}>
      {/* Grain texture */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: "180px" }} />
      {/* Motif géométrique Éminéo */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.07 }} viewBox="0 0 1200 800" fill="none" stroke="white">
          <circle cx="950" cy="150" r="350" strokeWidth="0.6" />
          <circle cx="950" cy="150" r="220" strokeWidth="0.4" />
          <circle cx="950" cy="150" r="110" strokeWidth="0.3" />
          <line x1="0" y1="200" x2="400" y2="800" strokeWidth="0.4" />
          <line x1="100" y1="0" x2="500" y2="800" strokeWidth="0.3" />
        </svg>
      </div>
      {/* Orbes flottants Éminéo — verts */}
      {[
        { sz:260, bottom:-50, right:-30, anim:"floatA 7s ease-in-out infinite", color:"rgba(93,226,152,0.12)" },
        { sz:140, top:"12%",  right:"10%",anim:"floatB 9s ease-in-out infinite", color:"rgba(157,240,196,0.10)" },
        { sz:80,  top:"62%",  right:"28%",anim:"floatC 5.5s ease-in-out infinite",color:"rgba(93,226,152,0.08)" },
      ].map((o,i) => (
        <div key={i} style={{ position:"absolute", width:o.sz, height:o.sz, borderRadius:"50%", border:`1px solid rgba(93,226,152,0.18)`, background:`radial-gradient(circle at 40% 40%,${o.color},transparent 65%)`, pointerEvents:"none", ...o, animation:o.anim }} />
      ))}

      {/* Colonne gauche — éditoriale */}
      <div style={{ width: "45%", flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "4rem 3.5rem 3rem 4rem", position: "relative", animation: "fadeUp 0.5s ease both" }}>
        {/* Logo Éminéo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "2.5rem" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: P.givre, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: P.abysse, fontSize: 20, fontWeight: 700, fontFamily: "var(--font-titre)", fontStyle: "italic", lineHeight: 1 }}>e</span>
          </div>
          <div>
            <div style={{ color: P.givre, fontSize: 18, fontFamily: "var(--font-titre)", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1 }}>emineo</div>
            <div style={{ color: P.menthe, fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 1 }}>ÉDUCATION</div>
          </div>
        </div>

        {/* Badge béta */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid rgba(93,226,152,0.25)`, borderRadius: 6, padding: "4px 12px", fontSize: 10, fontWeight: 500, color: "rgba(227,255,240,0.45)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1.5rem", width: "fit-content" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: P.menthe, display: "inline-block" }} />
          Bêta-test · {CONFIG.annee}
        </div>

        <h1 style={{ fontFamily: "var(--font-titre)", color: P.givre, fontSize: "clamp(2.4rem,4vw,3.4rem)", fontWeight: 400, lineHeight: 1.08, letterSpacing: "-0.01em", marginBottom: "1.25rem" }}>
          Atlas des<br />
          <em style={{ fontStyle: "italic", color: P.menthe }}>compétences</em>
        </h1>
        <p style={{ fontSize: 14, color: "rgba(227,255,240,0.45)", lineHeight: 1.8, maxWidth: 340, marginBottom: "2.5rem", fontWeight: 300 }}>
          Outil de coordination pédagogique inter-intervenants. Chaque acteur voit sa position dans le parcours — et ce que les autres ont couvert.
        </p>
        <div style={{ display: "flex", gap: "2rem" }}>
          {[["4","rôles"],["3+","blocs"],["0","silo"]].map(([v, l]) => (
            <div key={l}>
              <div style={{ fontSize: 22, fontWeight: 700, color: P.givre, lineHeight: 1, fontFamily: "var(--font-titre)" }}>{v}</div>
              <div style={{ fontSize: 11, color: "rgba(227,255,240,0.35)", marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
        {/* Séparateur vertical */}
        <div style={{ position: "absolute", right: 0, top: "10%", bottom: "10%", width: 1, background: "rgba(93,226,152,0.10)" }} />
      </div>

      {/* Colonne droite — funnel */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 3.5rem 3rem 3rem", animation: "fadeUp 0.5s 0.12s ease both" }}>
        <div style={{ width: "100%", maxWidth: 400, background: "rgba(227,255,240,0.04)", border: "1px solid rgba(93,226,152,0.12)", borderRadius: 20, padding: "2rem", backdropFilter: "blur(12px)" }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(227,255,240,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Qui êtes-vous ?</p>
          {ROLES.map(r => (
            <button key={r.id}
              onClick={() => { setRole(r.id); setCampus(null); setPromo(null); setGroupe(null) }}
              style={{
                width: "100%", textAlign: "left", padding: "0.75rem 0.9rem", borderRadius: 10,
                border: `1px solid ${role === r.id ? "rgba(93,226,152,0.45)" : "rgba(93,226,152,0.10)"}`,
                background: role === r.id ? "rgba(93,226,152,0.12)" : "rgba(93,226,152,0.03)",
                color: role === r.id ? P.givre : "rgba(227,255,240,0.65)",
                fontSize: 13, display: "flex", alignItems: "center", gap: "0.65rem",
                marginBottom: "0.35rem", transition: "all 0.18s ease", cursor: "pointer",
              }}>
              <span style={{ fontSize: 15, width: 22, textAlign: "center", opacity: 0.7, flexShrink: 0 }}>{r.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>{r.label}</div>
                <div style={{ fontSize: 10, color: "rgba(227,255,240,0.35)", marginTop: 1 }}>{r.desc}</div>
              </div>
            </button>
          ))}

          {/* Campus */}
          {role && role !== "dir" && (
            <div style={{ marginTop: "1.25rem", animation: "fadeUp 0.28s ease both" }}>
              <hr style={{ border: "none", borderTop: "1px solid rgba(93,226,152,0.10)", marginBottom: "0.75rem" }} />
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(227,255,240,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.6rem" }}>Campus</p>
              <div style={{ display: "flex", flexWrap: "wrap", margin: "-0.2rem" }}>
                {CONFIG.campus.map(c => (
                  <button key={c} onClick={() => setCampus(c)} style={{
                    padding: "0.45rem 0.9rem", borderRadius: 8, fontSize: 12, margin: "0.2rem", cursor: "pointer",
                    border: `1px solid ${campus === c ? "rgba(93,226,152,0.5)" : "rgba(93,226,152,0.12)"}`,
                    background: campus === c ? "rgba(93,226,152,0.18)" : "rgba(93,226,152,0.04)",
                    color: campus === c ? P.givre : "rgba(227,255,240,0.6)", transition: "all 0.15s",
                  }}>{c}</button>
                ))}
              </div>
            </div>
          )}

          {/* Promo (étudiant) */}
          {campus && needsPromo && (
            <div style={{ marginTop: "0.75rem", animation: "fadeUp 0.28s ease both" }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(227,255,240,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.6rem" }}>Promotion</p>
              <div style={{ display: "flex", flexWrap: "wrap", margin: "-0.2rem" }}>
                {CONFIG.promos.map(p => (
                  <button key={p} onClick={() => setPromo(p)} style={{
                    padding: "0.45rem 0.9rem", borderRadius: 8, fontSize: 12, margin: "0.2rem", cursor: "pointer",
                    border: `1px solid ${promo === p ? "rgba(93,226,152,0.5)" : "rgba(93,226,152,0.12)"}`,
                    background: promo === p ? "rgba(93,226,152,0.18)" : "rgba(93,226,152,0.04)",
                    color: promo === p ? P.givre : "rgba(227,255,240,0.6)", transition: "all 0.15s",
                  }}>{p}</button>
                ))}
              </div>
            </div>
          )}

          {/* Groupe (étudiant) */}
          {promo && needsGroupe && (
            <div style={{ marginTop: "0.75rem", animation: "fadeUp 0.28s ease both" }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(227,255,240,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.6rem" }}>Groupe</p>
              <div style={{ display: "flex", flexWrap: "wrap", margin: "-0.2rem" }}>
                {CONFIG.groupes.map(g => (
                  <button key={g} onClick={() => setGroupe(g)} style={{
                    padding: "0.45rem 0.9rem", borderRadius: 8, fontSize: 12, margin: "0.2rem", cursor: "pointer",
                    border: `1px solid ${groupe === g ? "rgba(93,226,152,0.5)" : "rgba(93,226,152,0.12)"}`,
                    background: groupe === g ? "rgba(93,226,152,0.18)" : "rgba(93,226,152,0.04)",
                    color: groupe === g ? P.givre : "rgba(227,255,240,0.6)", transition: "all 0.15s",
                  }}>{g}</button>
                ))}
              </div>
            </div>
          )}

          <button disabled={!canEnter()} onClick={() => canEnter() && onEnter({ role, campus, promo, groupe })}
            style={{
              width: "100%", padding: "0.85rem", borderRadius: 10, fontSize: 14, fontWeight: 500,
              background: canEnter() ? `linear-gradient(135deg, ${P.petrole}, ${P.menthe})` : "rgba(93,226,152,0.08)",
              color: canEnter() ? P.abysse : "rgba(227,255,240,0.3)",
              border: "none", marginTop: "1.25rem", transition: "all 0.2s ease", cursor: canEnter() ? "pointer" : "not-allowed",
              boxShadow: canEnter() ? "0 4px 20px rgba(93,226,152,0.25)" : "none",
              letterSpacing: "0.01em",
            }}>
            Accéder à l'Atlas →
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   VUE DIRECTION DES PROGRAMMES
   ════════════════════════════════════════════════════════════════ */
function VueDir({ onBack }) {
  const [onglet, setOnglet] = useState("cartographie")
  const [bab, setBab] = useState(null)

  return (
    <div style={{ minHeight: "100vh", background: P.givre }}>
      <Topbar role="dir" onBack={onBack} onglet={onglet} setOnglet={setOnglet}
        onglets={[{ id:"cartographie",label:"Cartographie" },{ id:"campus",label:"Par campus" },{ id:"alertes",label:`Alertes (${ALERTES_MOCK.length})` }]} />
      <div style={{ maxWidth: 1150, margin: "0 auto", padding: "1.5rem", display: "flex", gap: "1.25rem" }}>
        {/* Sidebar */}
        <div style={{ width: 210, flexShrink: 0 }}>
          <div style={card({ padding: "1rem", marginBottom: "0.75rem" })}>
            <div style={{ fontSize: 10, fontWeight: 600, color: P.textM, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.6rem" }}>Réseau</div>
            {CONFIG.campus.map(c => {
              const s = CAMPUS_STATS_MOCK[c] || { coverage: 60, alertes: 0 }
              const col = s.coverage < 55 ? P.red : s.coverage < 70 ? P.amber : P.menthe
              return (
                <div key={c} style={{ padding: "6px 0", borderBottom: `1px solid rgba(19,69,71,0.06)` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                    <span style={{ fontSize: 12, color: P.textM }}>{c}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: col }}>{s.coverage}%</span>
                  </div>
                  <Bar pct={s.coverage} color={s.coverage < 55 ? "red" : s.coverage < 70 ? "amber" : "blue"} h={3} />
                  {s.alertes > 0 && <div style={{ fontSize: 10, color: P.amber, marginTop: 2 }}>{s.alertes} alerte{s.alertes > 1 ? "s" : ""}</div>}
                </div>
              )
            })}
          </div>
          <div style={card({ padding: "1rem" })}>
            <div style={{ fontSize: 10, fontWeight: 600, color: P.textM, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.6rem" }}>Global</div>
            {[["Syllabi","90/90"],["Taux moyen","62%"],["Alertes",ALERTES_MOCK.length],["Campus",5]].map(([l,v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid rgba(19,69,71,0.06)` }}>
                <span style={{ fontSize: 11, color: P.textM }}>{l}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: P.petrole }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contenu principal */}
        <div style={{ flex: 1, minWidth: 0 }} className="fi">
          {onglet === "cartographie" && (
            <>
              <h2 style={{ fontFamily: "var(--font-titre)", fontWeight: 400, color: P.abysse, marginTop: 0, fontSize: 22, marginBottom: "1rem" }}>Cartographie réseau</h2>
              <GrapheCanvas showAllAlerts onBabouchka={n => setBab(bab && bab.id === n.id ? null : n)} />
              {bab && <Babouchka node={bab} onBack={() => setBab(null)} showRedFlags />}
            </>
          )}
          {onglet === "campus" && (
            <>
              <h2 style={{ fontFamily: "var(--font-titre)", fontWeight: 400, color: P.abysse, marginTop: 0, fontSize: 22, marginBottom: "1rem" }}>Couverture par campus</h2>
              {CONFIG.campus.map(c => {
                const s = CAMPUS_STATS_MOCK[c] || { coverage: 60, alertes: 0, syllabi: "—", groupes: [] }
                const col = s.coverage < 55 ? P.red : s.coverage < 70 ? P.amber : P.menthe
                return (
                  <div key={c} style={card({ borderLeft: `3px solid ${col}`, marginBottom: "0.6rem" })}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
                      <div>
                        <span style={{ fontSize: 15, fontWeight: 600, color: P.abysse }}>{c}</span>
                        <div style={{ fontSize: 11, color: P.textM, marginTop: 2 }}>{s.syllabi} syllabi · {(s.groupes || []).length} groupe{(s.groupes || []).length > 1 ? "s" : ""}</div>
                      </div>
                      <span style={{ fontSize: 22, fontWeight: 700, color: col }}>{s.coverage}%</span>
                    </div>
                    <Bar pct={s.coverage} color={s.coverage < 55 ? "red" : s.coverage < 70 ? "amber" : "blue"} />
                    {s.coverage < 55 && <div style={{ marginTop: "0.4rem", fontSize: 11, color: P.red }}>🚩 Couverture insuffisante — signaler au RP</div>}
                  </div>
                )
              })}
            </>
          )}
          {onglet === "alertes" && (
            <>
              <h2 style={{ fontFamily: "var(--font-titre)", fontWeight: 400, color: P.abysse, marginTop: 0, fontSize: 22, marginBottom: "0.5rem" }}>Alertes réseau</h2>
              <p style={{ fontSize: 12, color: P.textM, marginBottom: "1.25rem", lineHeight: 1.6 }}>Signaux de coordination identifiés par analyse sémantique — opportunités pédagogiques, pas des sanctions.</p>
              {ALERTES_MOCK.map(a => (
                <div key={a.id} style={card({ borderLeft: `3px solid ${a.niveau === 2 ? P.amber : P.menthe}` })}>
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                    <Tag label={`Niveau ${a.niveau}`} color={a.niveau === 2 ? "amber" : "blue"} small />
                    <span style={{ fontSize: 13, fontWeight: 600, color: P.abysse }}>{a.concept}</span>
                    <Tag label={a.campus} color="teal" small />
                  </div>
                  <p style={{ fontSize: 12, color: P.textM, margin: "0 0 0.5rem", lineHeight: 1.6 }}>{a.message}</p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {(a.intervenants || []).map(i => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Avatar name={i} size={18} />
                        <span style={{ fontSize: 11, color: P.textM }}>{i}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   VUE RESPONSABLE PÉDAGOGIQUE
   ════════════════════════════════════════════════════════════════ */
function VueRP({ campus, onBack }) {
  const [onglet, setOnglet] = useState("cartographie")
  const [bab, setBab] = useState(null)
  const [niveau, setNiveau] = useState("blocs")
  const [bloc, setBloc] = useState(null)
  const alertesCampus = ALERTES_MOCK.filter(a => a.campus === campus)
  const stats = CAMPUS_STATS_MOCK[campus] || { coverage: 60, alertes: 0, syllabi: "—", groupes: [] }

  return (
    <div style={{ minHeight: "100vh", background: P.givre }}>
      <Topbar role="rp" campus={campus} onBack={onBack} onglet={onglet} setOnglet={setOnglet}
        onglets={[{ id:"cartographie",label:"Cartographie" },{ id:"progression",label:"Progression" },{ id:"alertes",label:`Alertes (${alertesCampus.length})` }]} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem", display: "flex", gap: "1.25rem" }}>
        {/* Sidebar */}
        <div style={{ width: 210, flexShrink: 0 }}>
          <div style={card({ padding: "1rem", marginBottom: "0.75rem" })}>
            <div style={{ fontSize: 10, fontWeight: 600, color: P.textM, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Campus {campus}</div>
            {[["Couverture", `${stats.coverage}%`], ["Syllabi", stats.syllabi], ["Alertes", alertesCampus.length], ["Groupes", (stats.groupes || []).length || "—"]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid rgba(19,69,71,0.06)` }}>
                <span style={{ fontSize: 12, color: P.textM }}>{l}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: P.petrole }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={card({ padding: "1rem" })}>
            <div style={{ fontSize: 10, fontWeight: 600, color: P.textM, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Groupes</div>
            {(stats.groupes || []).map(g => (
              <div key={g} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid rgba(19,69,71,0.06)` }}>
                <span style={{ fontSize: 12, color: P.textM }}>{g}</span>
                <Tag label="Actif" color="blue" small />
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }} className="fi">
          {onglet === "cartographie" && (
            <>
              <h2 style={{ fontFamily: "var(--font-titre)", fontWeight: 400, color: P.abysse, marginTop: 0, fontSize: 22, marginBottom: "1rem" }}>Cartographie — {campus}</h2>
              <GrapheCanvas showAllAlerts onBabouchka={n => setBab(bab && bab.id === n.id ? null : n)} />
              {bab && <Babouchka node={bab} onBack={() => setBab(null)} showRedFlags />}
            </>
          )}
          {onglet === "progression" && (
            <div>
              {niveau === "blocs" && (
                <>
                  <h2 style={{ fontFamily: "var(--font-titre)", fontWeight: 400, color: P.abysse, marginTop: 0, fontSize: 22, marginBottom: "1rem" }}>Blocs — {campus}</h2>
                  {BLOCS_MOCK.map(b => {
                    const col = b.status === "red" ? P.red : b.status === "amber" ? P.amber : b.status === "gray" ? P.textM : P.menthe
                    return (
                      <div key={b.id} onClick={() => { setBloc(b); setNiveau("comp") }}
                        style={card({ cursor: "pointer", borderLeft: `3px solid ${col}` })}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(11,43,45,0.10)"}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 6px rgba(11,43,45,0.06)"}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                          <div>
                            <Tag label={b.id} small />
                            <span style={{ marginLeft: "0.4rem", fontSize: 14, fontWeight: 600, color: P.abysse }}>{b.titre}</span>
                            {b.status === "red"   && <div style={{ fontSize: 11, color: P.red,   marginTop: 2 }}>🚩 Incohérence détectée — investigation requise</div>}
                            {b.status === "amber" && <div style={{ fontSize: 11, color: P.amber, marginTop: 2 }}>⚠ Coordination à établir</div>}
                          </div>
                          <span style={{ fontSize: 20, fontWeight: 700, color: col, flexShrink: 0 }}>{b.pct}%</span>
                        </div>
                        <Bar pct={b.pct} color={b.status === "red" ? "red" : b.status === "amber" ? "amber" : "blue"} />
                        <div style={{ fontSize: 11, color: P.textM, marginTop: "0.3rem" }}>{b.comp}C · {b.act}A · Explorer →</div>
                      </div>
                    )
                  })}
                </>
              )}
              {niveau === "comp" && bloc && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                    <button onClick={() => { setNiveau("blocs"); setBloc(null) }} style={{ fontSize: 12, color: P.petrole }}>← Blocs</button>
                    <span style={{ fontSize: 12, color: P.textM }}>›</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: P.abysse }}>{bloc.titre}</span>
                  </div>
                  {(bloc.detail || []).map((d, i) => {
                    const p = [80, 68, 55, 62, 48, 60, 44, 35][i] || 50
                    const col = p < 40 ? P.red : p < 65 ? P.amber : P.menthe
                    return (
                      <div key={d} style={card({ borderLeft: `3px solid ${col}`, marginBottom: "0.45rem" })}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                          <span style={{ fontSize: 13, color: P.abysse }}>{d}</span>
                          <span style={{ fontSize: 16, fontWeight: 700, color: col, flexShrink: 0, marginLeft: "0.5rem" }}>{p}%</span>
                        </div>
                        <Bar pct={p} color={p < 40 ? "red" : p < 65 ? "amber" : "blue"} />
                        {p < 40 && <div style={{ fontSize: 10, color: P.red, marginTop: "0.25rem" }}>🚩 Couverture insuffisante</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {onglet === "alertes" && (
            <>
              <h2 style={{ fontFamily: "var(--font-titre)", fontWeight: 400, color: P.abysse, marginTop: 0, fontSize: 22, marginBottom: "0.5rem" }}>Alertes — {campus}</h2>
              {alertesCampus.length === 0 && <div style={{ textAlign: "center", padding: "2rem", color: P.textM, fontSize: 14 }}>Aucune alerte sur ce campus.</div>}
              {alertesCampus.map(a => (
                <div key={a.id} style={card({ borderLeft: `3px solid ${a.niveau === 2 ? P.amber : P.menthe}` })}>
                  <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                    <Tag label={`Niveau ${a.niveau} — ${a.niveau === 2 ? "Coordination" : "Signal doux"}`} color={a.niveau === 2 ? "amber" : "blue"} small />
                    <Tag label={a.concept} small />
                  </div>
                  <p style={{ fontSize: 12, color: P.textM, margin: "0 0 0.5rem", lineHeight: 1.6 }}>{a.message}</p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {(a.intervenants || []).map(i => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <Avatar name={i} size={18} />
                        <span style={{ fontSize: 11, color: P.textM }}>{i}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: P.textL, marginTop: "0.4rem" }}>{a.modules.join(" · ")}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   VUE INTERVENANT
   ════════════════════════════════════════════════════════════════ */
function VueIntervenant({ campus, onBack }) {
  const [onglet, setOnglet]     = useState("avant")
  const [loading, setLoading]   = useState(true)
  const [fiche, setFiche]       = useState(null)
  const [streamText, setStream] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [concepts, setConcepts] = useState(["Synthèse", "Pitch", "Recommandations"])
  const [ecart, setEcart]       = useState("")
  const [signal, setSignal]     = useState("bien")
  const [termine, setTermine]   = useState(false)
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const seance = SEANCES_MOCK[4]

  useEffect(() => {
    const ctx = {
      module: "Méthodes d'analyse & diagnostic", seance: 5, total: 6,
      date: "13/10/2026", campus,
      competence: "C1.1 — Conduire une analyse de l'environnement", bloc: "B1",
      corpus_dejavu: ["Outils de veille (David Leroy)", "Méthodes de diagnostic (Claire Dubois)"],
      corpus_apres:  ["Conception de projet (Marc Faure, 27/10)", "Méthodes agiles (Lucie Bernard, 03/11)"],
    }
    setStreaming(true)
    genererFicheJ1(ctx, partial => setStream(partial))
      .then(result => { setFiche(result); setLoading(false); setStreaming(false) })
      .catch(() => setLoading(false))
  }, [campus])

  const toggle = c => setConcepts(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])

  return (
    <div style={{ minHeight: "100vh", background: P.givre }}>
      <Topbar role="intervenant" campus={campus} onBack={onBack} onglet={onglet} setOnglet={setOnglet}
        onglets={[{ id:"avant",label:"Avant la séance" },{ id:"declaration",label:"Déclaration" },{ id:"graphe",label:"Vue d'ensemble" }]} />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "2rem 1.5rem" }}>

        {onglet === "avant" && (
          <div className="fi">
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                <h1 style={{ fontFamily: "var(--font-titre)", fontWeight: 400, fontSize: 23, color: P.abysse, lineHeight: 1.2 }}>{seance.titre}</h1>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0, marginLeft: "1rem", marginTop: 4 }}>
                  <span style={{ position: "relative", display: "inline-block", width: 8, height: 8 }}>
                    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: P.menthe, animation: "pulse 2s ease-in-out infinite" }} />
                    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: P.menthe }} />
                  </span>
                  <span style={{ fontSize: 11, color: P.textM }}>Générée automatiquement</span>
                </div>
              </div>
              <p style={{ fontSize: 12, color: P.textM }}>Séance 5/6 · Lundi 13 octobre 2026 · 9h00 · {campus}</p>
            </div>

            {loading ? (
              <div style={{ padding: "1.25rem", background: P.abysse, borderRadius: 12, border: `1px solid ${P.borderM}` }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(93,226,152,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Spinner /> Claude génère la fiche…
                </div>
                <div style={{ fontSize: 11, color: P.eau, fontFamily: "monospace", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word", minHeight: 60 }}>
                  {streamText}{streaming && <span className="stream-cursor" />}
                </div>
              </div>
            ) : (
              <>
                <div style={card()}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: P.textM, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Ancrage compétence</div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                    <Tag label="C1.1" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: P.abysse }}>Conduire une analyse de l'environnement</div>
                      <div style={{ fontSize: 11, color: P.textM, marginTop: 2 }}>Bloc B1 · Fondamentaux & analyse</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: P.textM, margin: "0.5rem 0 0", lineHeight: 1.6, fontStyle: "italic" }}>{fiche?.ancrage}</p>
                </div>

                <div style={card()}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: P.textM, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Objectifs de séance</div>
                  {["Maîtriser les méthodes d'analyse comparative", "Identifier les leviers différenciateurs", "Rédiger une synthèse opérationnelle orientée recommandation"].map((o, i) => (
                    <div key={i} style={{ display: "flex", gap: "0.5rem", padding: "0.3rem 0", alignItems: "flex-start" }}>
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(93,226,152,0.12)", color: P.petrole, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ fontSize: 13, color: P.textM, lineHeight: 1.5 }}>{o}</span>
                    </div>
                  ))}
                </div>

                <div style={card()}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: P.textM, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Ce que vos étudiants ont déjà vu</div>
                  {(fiche?.dejavu || []).map((item, i) => (
                    <div key={i} style={{ background: P.surface2, borderRadius: 8, padding: "0.55rem 0.8rem", marginBottom: "0.4rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.3rem" }}>
                        <Avatar name={item.intervenant} size={20} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: P.abysse }}>{item.intervenant}</span>
                        <span style={{ fontSize: 11, color: P.textM }}>· {item.module}</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginBottom: "0.3rem" }}>
                        {item.concepts.map(c => <Tag key={c} label={c} small />)}
                      </div>
                      <p style={{ fontSize: 11, color: P.textM, margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>{item.lien}</p>
                    </div>
                  ))}
                </div>

                <div style={{ ...card(), border: `1px solid rgba(239,159,39,0.25)`, borderLeft: `3px solid ${P.amber}` }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#7A4A00", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.4rem" }}>Alerte de coordination</div>
                  <p style={{ fontSize: 12, color: P.textM, margin: 0, lineHeight: 1.6 }}><strong>David Leroy</strong> (Outils de veille) couvre également l'analyse d'environnement. Une coordination préalable enrichirait les deux séquences.</p>
                </div>

                {fiche?.apres && fiche.apres.length > 0 && (
                  <div style={card()}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: P.textM, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Ce qui arrive après</div>
                    {fiche.apres.map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.6rem", padding: "0.4rem 0", borderBottom: i < fiche.apres.length - 1 ? `1px solid rgba(19,69,71,0.06)` : "none", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 11, color: P.textL, flexShrink: 0, width: 48 }}>{item.date}</div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: P.abysse }}>{item.module}</span>
                          <span style={{ fontSize: 11, color: P.textM }}> · {item.intervenant}</span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.25rem" }}>
                            {item.concepts.map(c => <Tag key={c} label={c} small />)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {onglet === "declaration" && (
          <div className="fi">
            {sent ? (
              <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
                <div style={{ fontSize: 48, color: P.menthe, marginBottom: "0.6rem" }}>✓</div>
                <h2 style={{ fontFamily: "var(--font-titre)", fontWeight: 400, color: P.abysse, fontSize: 21, marginBottom: "0.4rem" }}>Déclaration enregistrée</h2>
                <p style={{ color: P.textM, fontSize: 13, lineHeight: 1.6 }}>Le graphe de compétences est mis à jour en arrière-plan.</p>
                <button onClick={() => setSent(false)} style={{ marginTop: "1.25rem", border: `1px solid ${P.border}`, color: P.textM, borderRadius: 6, padding: "6px 16px", fontSize: 12, background: P.surface }}>Nouvelle déclaration</button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: "1.25rem" }}>
                  <h1 style={{ fontFamily: "var(--font-titre)", fontWeight: 400, fontSize: 21, color: P.abysse, margin: 0 }}>Déclaration post-séance</h1>
                  <p style={{ fontSize: 12, color: P.textM, marginTop: "0.2rem" }}>Séance 5 · 13 octobre 2026 · ~90 secondes</p>
                </div>

                <div style={card()}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: P.abysse, marginBottom: "0.5rem" }}><span style={{ color: P.menthe, marginRight: "0.35rem" }}>01</span>Notions couvertes</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {seance.concepts.concat(["Analyse comparative", "Forces concurrentielles", "Recommandations"]).map(c => (
                      <button key={c} onClick={() => toggle(c)} style={{
                        background: concepts.includes(c) ? P.petrole : "rgba(19,69,71,0.06)",
                        color: concepts.includes(c) ? P.givre : P.textM,
                        border: `1px solid ${concepts.includes(c) ? P.petrole : P.border}`,
                        borderRadius: 20, padding: "4px 12px", fontSize: 12, transition: "all 0.15s",
                      }}>{c}</button>
                    ))}
                  </div>
                </div>

                <div style={card()}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: P.abysse, marginBottom: "0.4rem" }}><span style={{ color: P.menthe, marginRight: "0.35rem" }}>02</span>Écart syllabus <span style={{ color: P.textM, fontWeight: 400 }}>(facultatif)</span></div>
                  <textarea value={ecart} onChange={e => setEcart(e.target.value)} placeholder="Ex : reporté la partie sur les KPI à la séance 6…"
                    style={{ width: "100%", border: `1px solid ${P.border}`, borderRadius: 8, padding: "0.55rem", fontSize: 12, resize: "vertical", minHeight: 70, color: P.abysse, outline: "none", lineHeight: 1.6 }} />
                </div>

                <div style={card()}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: P.abysse, marginBottom: "0.5rem" }}><span style={{ color: P.menthe, marginRight: "0.35rem" }}>03</span>Signal pédagogique</div>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {[
                      { v:"bien",       l:"✓ Bien assimilé",   bg:"rgba(93,226,152,0.12)",  fg:P.petrole,  bd:P.borderM },
                      { v:"consolider", l:"↻ À consolider",    bg:P.amberBg,                fg:"#7A4A00",  bd:P.amber  },
                      { v:"reporte",    l:"→ Reporté",         bg:"rgba(19,69,71,0.06)",    fg:P.textM,    bd:P.border },
                      { v:"alerte",     l:"⚠ Alerte",          bg:P.redBg,                  fg:"#8B1A1A",  bd:P.red    },
                    ].map(({ v, l, bg, fg, bd }) => (
                      <button key={v} onClick={() => setSignal(v)} style={{
                        background: signal === v ? bg : "rgba(19,69,71,0.05)",
                        color: signal === v ? fg : P.textM,
                        border: `1px solid ${signal === v ? bd : P.border}`,
                        borderRadius: 8, padding: "5px 12px", fontSize: 12, transition: "all 0.15s",
                      }}>{l}</button>
                    ))}
                  </div>
                </div>

                <div style={card()}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: P.abysse, marginBottom: "0.5rem" }}><span style={{ color: P.menthe, marginRight: "0.35rem" }}>04</span>Module terminé ?</div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {[{ v:false,l:"Non, il reste des séances" },{ v:true,l:"Oui, module terminé" }].map(({ v, l }) => (
                      <button key={String(v)} onClick={() => setTermine(v)} style={{
                        background: termine === v ? "rgba(93,226,152,0.12)" : "rgba(19,69,71,0.05)",
                        color: termine === v ? P.petrole : P.textM,
                        border: `1px solid ${termine === v ? P.borderM : P.border}`,
                        borderRadius: 8, padding: "5px 12px", fontSize: 12,
                      }}>{l}</button>
                    ))}
                  </div>
                </div>

                <button onClick={async () => { setSending(true); await new Promise(r => setTimeout(r, 800)); setSending(false); setSent(true) }}
                  disabled={sending} style={{
                    width: "100%", background: P.petrole, color: P.givre, border: "none", borderRadius: 10,
                    padding: "12px", fontSize: 14, fontWeight: 500, opacity: sending ? 0.7 : 1, transition: "opacity 0.2s",
                  }}>
                  {sending ? "Envoi en cours…" : "Envoyer la déclaration"}
                </button>
              </>
            )}
          </div>
        )}

        {onglet === "graphe" && (
          <div className="fi">
            <h2 style={{ fontFamily: "var(--font-titre)", fontWeight: 400, color: P.abysse, marginTop: 0, fontSize: 22, marginBottom: "0.5rem" }}>Vue d'ensemble de la formation</h2>
            <p style={{ fontSize: 12, color: P.textM, marginBottom: "1rem", lineHeight: 1.6 }}>Votre position dans le parcours de compétences — lecture seule, sans alertes opérationnelles.</p>
            <GrapheCanvas showAllAlerts={false} />
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   VUE ÉTUDIANT
   ════════════════════════════════════════════════════════════════ */
function VueEtudiant({ campus, promo, groupe, onBack }) {
  const [comps, setComps] = useState(COMP_ETUDIANT_MOCK.map(c => ({ ...c })))
  const [saved, setSaved]   = useState(false)

  const updateComp = (id, field, val) => {
    setComps(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c))
    setSaved(false)
  }

  const pctDeclare = Math.round(comps.filter(c => c.statut).length / comps.length * 100)
  const statutCol  = { acquis: P.menthe, voie: P.amber, nonacquis: P.red }
  const statutBg   = { acquis: "rgba(93,226,152,0.12)", voie: P.amberBg, nonacquis: P.redBg }
  const statutFg   = { acquis: P.petrole, voie: "#7A4A00", nonacquis: "#8B1A1A" }

  return (
    <div style={{ minHeight: "100vh", background: P.givre }}>
      <div style={{ height: 52, background: P.surface, borderBottom: `1px solid ${P.border}`, padding: "0 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 8px rgba(11,43,45,0.06)" }}>
        <button onClick={onBack} style={{ color: P.textM, fontSize: 18, lineHeight: 1, padding: "0 4px" }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: P.abysse }}>Mon parcours de compétences</div>
          <div style={{ fontSize: 11, color: P.textM }}>{promo} · {campus}{groupe ? ` · ${groupe}` : ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: 11, color: P.textM }}>{pctDeclare}% renseigné</span>
          <div style={{ width: 60, height: 4, background: "rgba(19,69,71,0.10)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${pctDeclare}%`, height: "100%", background: P.menthe, borderRadius: 99, transition: "width 0.4s" }} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem" }}>
        <div style={{ ...card({ marginBottom: "1.25rem" }), background: "rgba(93,226,152,0.08)", border: `1px solid ${P.borderM}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: P.petrole, marginBottom: "0.3rem" }}>Comment ça marche ?</div>
          <p style={{ fontSize: 12, color: P.petrole, margin: 0, lineHeight: 1.6, opacity: 0.8 }}>Pour chaque module, indique si tu as acquis la compétence. Ton retex est confidentiel — visible de ton tuteur uniquement.</p>
        </div>

        {["B1", "B2", "B3"].map(bid => {
          const blocComps = comps.filter(c => c.bloc === bid)
          if (!blocComps.length) return null
          const titreBloc = BLOCS_MOCK.find(b => b.id === bid)?.titre || bid
          return (
            <div key={bid} style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <Tag label={bid} small />
                <span style={{ fontSize: 14, fontWeight: 600, color: P.abysse }}>{titreBloc}</span>
              </div>
              {blocComps.map(c => (
                <div key={c.id} style={card()}>
                  <div style={{ marginBottom: "0.6rem" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.2rem" }}>
                      <Tag label={c.id} small />
                      <span style={{ fontSize: 13, color: P.abysse, lineHeight: 1.4, fontWeight: 500 }}>{c.libelle}</span>
                    </div>
                    <div style={{ fontSize: 11, color: P.textM }}>Module : {c.module}</div>
                  </div>
                  <div style={{ background: P.surface2, borderRadius: 8, padding: "0.45rem 0.75rem", marginBottom: "0.6rem", fontSize: 11, color: P.textM }}>
                    <span style={{ fontWeight: 600 }}>Déclaré couvert par l'intervenant</span> — voir fiche séance pour le détail.
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: P.textM, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "0.4rem" }}>Ton auto-évaluation</div>
                  <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                    {[{ v:"acquis",l:"✓ Acquis" },{ v:"voie",l:"↗ En voie" },{ v:"nonacquis",l:"✗ Pas encore" }].map(({ v, l }) => (
                      <button key={v} onClick={() => updateComp(c.id, "statut", c.statut === v ? null : v)}
                        style={{
                          background: c.statut === v ? (statutBg[v] || "rgba(19,69,71,0.06)") : "rgba(19,69,71,0.05)",
                          color: c.statut === v ? (statutFg[v] || P.textM) : P.textM,
                          border: `1px solid ${c.statut === v ? (statutCol[v] || P.border) : P.border}`,
                          borderRadius: 20, padding: "4px 12px", fontSize: 12, transition: "all 0.15s",
                        }}>{l}</button>
                    ))}
                  </div>
                  <textarea value={c.retex} onChange={e => updateComp(c.id, "retex", e.target.value)}
                    placeholder="Commentaire libre — qu'est-ce qui t'a bloqué ? qu'est-ce qui t'a aidé ? (optionnel)"
                    style={{ width: "100%", border: `1px solid ${P.border}`, borderRadius: 8, padding: "0.5rem", fontSize: 12, resize: "vertical", minHeight: 55, color: P.abysse, outline: "none", lineHeight: 1.5, background: c.retex ? P.surface : P.surface2 }} />
                </div>
              ))}
            </div>
          )
        })}

        <button onClick={() => setSaved(true)} style={{ width: "100%", background: P.petrole, color: P.givre, border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 500 }}>
          {saved ? "✓ Enregistré" : "Enregistrer mon auto-évaluation"}
        </button>
        {saved && <p style={{ textAlign: "center", fontSize: 12, color: P.petrole, marginTop: "0.6rem" }}>Ton retex est visible de ton tuteur / maître d'apprentissage.</p>}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   APP ROOT
   ════════════════════════════════════════════════════════════════ */
export default function App() {
  const [ctx, setCtx] = useState(null)

  if (!ctx) return <Landing onEnter={c => setCtx(c)} />

  const back = () => setCtx(null)
  const { role, campus, promo, groupe } = ctx

  if (role === "dir")         return <VueDir onBack={back} />
  if (role === "rp")          return <VueRP campus={campus} onBack={back} />
  if (role === "intervenant") return <VueIntervenant campus={campus} onBack={back} />
  if (role === "etudiant")    return <VueEtudiant campus={campus} promo={promo} groupe={groupe} onBack={back} />
  return null
}
