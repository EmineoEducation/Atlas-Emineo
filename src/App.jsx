import { useState, useEffect, useRef, useCallback } from 'react'

/* ═══════════════════════════════════════════════════════════════
   CONSTANTES
═══════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'atlas_formations_v2'
const API_KEY     = import.meta.env.VITE_ANTHROPIC_API_KEY || ''
const MODEL       = 'claude-haiku-4-5-20251001'

const ROLES = [
  { id:'dir',         icon:'◈', label:'Direction des programmes', desc:'Toutes formations · Ingestion · Supervision' },
  { id:'rp',          icon:'◉', label:'Responsable pédagogique',  desc:'Mon campus · Mes formations · Alertes' },
  { id:'intervenant', icon:'◎', label:'Intervenant',              desc:'Mes modules · Fiche J‑1 · Déclaration' },
  { id:'etudiant',    icon:'○', label:'Étudiant',                 desc:'Ma formation · Mon parcours' },
]

const SCOL = { nominal:'#5DE298', coordination:'#EF9F27', incoherence:'#E24B4A', transversal:'#9DF0C4', vide:'#8EADA8' }
const SFIL = { nominal:'rgba(93,226,152,0.12)', coordination:'rgba(239,159,39,0.10)', incoherence:'rgba(226,75,74,0.08)', transversal:'rgba(157,240,196,0.15)', vide:'rgba(19,69,71,0.04)' }

/* ═══════════════════════════════════════════════════════════════
   MOTEUR CLAUDE
═══════════════════════════════════════════════════════════════ */
async function streamClaude(messages, onToken) {
  if (!API_KEY) throw new Error('NO_KEY')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 16000, stream: true, messages }),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n'); buf = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const d = line.slice(6).trim()
      if (d === '[DONE]') return
      try {
        const evt = JSON.parse(d)
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') onToken(evt.delta.text)
      } catch (_) {}
    }
  }
}

async function ingererDocuments(textes, campus, onProgress) {
  const corpus = textes.map((t, i) => `--- DOCUMENT ${i+1} ---\n${t.slice(0, 20000)}`).join('\n\n')
  const prompt = `Tu es un expert en ingénierie pédagogique. Analyse ces documents et extrais la structure pédagogique complète.

${corpus}

Retourne UNIQUEMENT ce JSON (sans markdown) :
{
  "formation": { "titre": "...", "etablissement": "...", "annee": "..." },
  "blocs": [{
    "id": "B1",
    "titre": "...",
    "competences": [{ "id": "C1.1", "libelle": "..." }],
    "modules": [{
      "id": "M1", "titre": "...", "intervenant": "nom si mentionné",
      "competences_liees": ["C1.1"], "notions_cles": ["notion1"], "volume": "Xh si mentionné"
    }]
  }],
  "intervenants": ["liste des noms d'intervenants trouvés dans les documents"],
  "notions_transversales": ["notion présente dans plusieurs blocs"],
  "alertes_detectees": [{
    "niveau": 2,
    "notion": "...",
    "modules": ["M1","M2"],
    "message": "description courte de la redondance"
  }]
}`
  onProgress('Analyse du corpus…')
  let full = ''
  await streamClaude([{ role: 'user', content: prompt }], tok => { full += tok })
  onProgress('Structuration…')
  try {
    // Nettoyage robuste : retire ```json, ```, et tout texte autour
    let cleaned = full.trim()
    // Retire les fences markdown
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
    // Trouve le premier { et le dernier } pour extraire le JSON
    const firstBrace = cleaned.indexOf('{')
    const lastBrace  = cleaned.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('Aucun JSON trouvé')
    }
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
    const json = JSON.parse(cleaned)
    json._campus = campus
    json._id = 'f_' + Date.now()
    return json
  } catch (e) {
    throw new Error('Parsing échoué : ' + e.message + ' — Début réponse : ' + full.slice(0, 150))
  }
}

async function genererFicheJ1(formation, module_, onToken) {
  if (!API_KEY) {
    await new Promise(r => setTimeout(r, 900))
    return {
      ancrage: `Cette séance s'inscrit dans le bloc "${module_.bloc_titre||''}" et prépare les étudiants aux compétences visées.`,
      dejavu: [], apres: [],
    }
  }
  const autresModules = (formation.blocs||[])
    .flatMap(b => (b.modules||[]).map(m => ({ titre: m.titre, notions: m.notions_cles })))
    .filter(m => m.titre !== module_.titre)
  const prompt = `Tu es un assistant pédagogique. Génère une fiche contexte J-1 pour cet intervenant.
Formation : ${formation.formation?.titre||''}
Module : ${module_.titre}
Notions clés : ${(module_.notions_cles||[]).join(', ')}
Autres modules : ${JSON.stringify(autresModules.slice(0,10))}
Retourne UNIQUEMENT ce JSON :
{"ancrage":"phrase contextuelle 2 lignes max","dejavu":[{"intervenant":"...","module":"...","concepts":["..."],"lien":"conseil concret"}],"apres":[{"date":"à venir","intervenant":"...","module":"...","concepts":["..."]}]}`
  let full = ''
  await streamClaude([{ role: 'user', content: prompt }], tok => { full += tok; onToken(full) })
  try { return JSON.parse(full.replace(/```json|```/g, '').trim()) }
  catch (_) { return { ancrage: full.slice(0, 120), dejavu: [], apres: [] } }
}

/* ═══════════════════════════════════════════════════════════════
   UTILITAIRES UI
═══════════════════════════════════════════════════════════════ */
const P = {
  abysse:'#0B2B2D', petrole:'#134547', menthe:'#5DE298',
  givre:'#E3FFF0',  eau:'#9DF0C4',     saumon:'#E89B77',
  surface:'#FFFFFF', surface2:'#F5FDF8',
  border:'rgba(19,69,71,0.12)', borderm:'rgba(93,226,152,0.28)',
  textm:'#4A706E', textl:'rgba(11,43,45,0.40)',
  amber:'#EF9F27', amberbg:'#FFF8ED',
  red:'#E24B4A',   redbg:'#FEF2F2',
}

function Tag({ label, color='blue', small }) {
  const map = { blue:{bg:'rgba(93,226,152,0.15)',fg:P.petrole}, amber:{bg:P.amberbg,fg:'#7A4A00'}, teal:{bg:'rgba(157,240,196,0.25)',fg:P.abysse}, red:{bg:P.redbg,fg:'#8B1A1A'}, gray:{bg:'rgba(19,69,71,0.07)',fg:P.textm} }
  const s = map[color]||map.gray
  return <span style={{ background:s.bg, color:s.fg, fontSize:small?10:12, fontWeight:500, padding:small?'2px 7px':'3px 10px', borderRadius:20, display:'inline-block', lineHeight:1.6, whiteSpace:'nowrap' }}>{label}</span>
}

function Avatar({ name, size=32 }) {
  const ini = (name||'?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()
  const cols = [['rgba(93,226,152,0.2)',P.petrole],['rgba(157,240,196,0.3)',P.abysse],['rgba(232,155,119,0.2)','#6B3A20']]
  const [bg,fg] = cols[(name||'').charCodeAt(0)%3]
  return <div style={{ width:size, height:size, borderRadius:'50%', background:bg, color:fg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.35, fontWeight:600, flexShrink:0, border:`1px solid ${P.borderm}` }}>{ini}</div>
}

function Bar({ pct, color='blue', h=4 }) {
  const fills = { blue:P.menthe, teal:P.eau, red:P.red, amber:P.amber }
  return <div style={{ background:'rgba(19,69,71,0.10)', borderRadius:99, height:h, overflow:'hidden', width:'100%' }}>
    <div style={{ width:`${pct}%`, height:'100%', background:fills[color]||P.menthe, borderRadius:99, transition:'width 0.6s ease' }}/>
  </div>
}

function Spinner({ size=20 }) {
  return <div style={{ width:size, height:size, border:`2px solid ${P.borderm}`, borderTopColor:P.menthe, borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 }}/>
}

function card(x={}) {
  return { background:P.surface, borderRadius:12, border:`1px solid ${P.border}`, padding:'1.25rem 1.4rem', marginBottom:'0.8rem', boxShadow:'0 1px 6px rgba(11,43,45,0.06)', ...x }
}

function EmptyState({ icon, titre, message, action, onAction }) {
  return (
    <div style={{ padding:'4rem 2rem', textAlign:'center' }}>
      <div style={{ fontSize:40, opacity:0.35, marginBottom:'0.75rem' }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:600, color:P.petrole, marginBottom:'0.3rem' }}>{titre}</div>
      <div style={{ fontSize:13, color:P.textm, lineHeight:1.6, maxWidth:320, margin:'0 auto' }}>{message}</div>
      {action && <button onClick={onAction} style={{ marginTop:'1.25rem', background:P.petrole, color:P.givre, border:'none', borderRadius:8, padding:'8px 20px', fontSize:13 }}>{action}</button>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   GRAPHE CANVAS
═══════════════════════════════════════════════════════════════ */
function GrapheCanvas({ blocs, alertes, onClickBloc, showAlerts=true }) {
  const cvRef = useRef(null)
  const [panel, setPanel] = useState(null)

  const nodes = (blocs||[]).map((b, i, arr) => {
    const angle = (2*Math.PI*i/Math.max(arr.length,1)) - Math.PI/2
    const r = arr.length <= 3 ? 0.28 : 0.30
    const ids = (b.modules||[]).map(m=>m.id)
    const hasAlert2 = (alertes||[]).some(a => a.niveau===2 && (a.modules||[]).some(m=>ids.includes(m)))
    const hasAlert3 = (alertes||[]).some(a => a.niveau===3 && (a.modules||[]).some(m=>ids.includes(m)))
    return { ...b, x:0.5+r*Math.cos(angle), y:0.45+r*0.75*Math.sin(angle),
      status: hasAlert2?'incoherence':hasAlert3?'coordination':'nominal',
      comp:(b.competences||[]).length, mc:(b.modules||[]).length }
  })

  const links = nodes.map((n,i) => ({ a:n.id, b:nodes[(i+1)%nodes.length].id, w:2 }))

  const draw = useCallback(() => {
    const cv = cvRef.current; if (!cv) return
    const w = cv.width = cv.parentElement.clientWidth
    const h = cv.height = 420
    const ctx = cv.getContext('2d')
    ctx.clearRect(0,0,w,h)

    if (!nodes.length) {
      ctx.fillStyle = 'rgba(19,69,71,0.25)'
      ctx.font = "400 14px 'Inter',system-ui"; ctx.textAlign = 'center'
      ctx.fillText('Aucune formation chargée', w/2, h/2-8)
      ctx.font = "300 12px 'Inter',system-ui"; ctx.fillStyle = 'rgba(19,69,71,0.18)'
      ctx.fillText('Déposez des documents pour faire apparaître le graphe', w/2, h/2+14)
      return
    }

    links.forEach(l => {
      const a = nodes.find(n=>n.id===l.a), b = nodes.find(n=>n.id===l.b)
      if (!a||!b) return
      ctx.beginPath(); ctx.moveTo(a.x*w,a.y*h); ctx.lineTo(b.x*w,b.y*h)
      ctx.strokeStyle='rgba(93,226,152,0.18)'; ctx.lineWidth=l.w; ctx.stroke()
    })

    nodes.forEach(n => {
      const x=n.x*w, y=n.y*h, r=28+n.comp*3.5+n.mc*1.5
      if (n.status==='incoherence') {
        ctx.beginPath(); ctx.arc(x,y,r+7,0,Math.PI*2)
        ctx.strokeStyle='rgba(226,75,74,0.22)'; ctx.lineWidth=4; ctx.stroke()
      }
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2)
      ctx.fillStyle=SFIL[n.status]||SFIL.vide; ctx.fill()
      ctx.strokeStyle=SCOL[n.status]||SCOL.vide; ctx.lineWidth=n.status==='incoherence'?2.5:1.5; ctx.stroke()
      const fs=Math.max(9,r*0.20)
      ctx.fillStyle=P.abysse; ctx.font=`600 ${fs}px 'Inter',system-ui`
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(n.id, x, y-fs*0.6)
      ctx.font=`400 ${Math.max(8,r*0.165)}px 'Inter',system-ui`
      ctx.fillText(n.titre.length>18?n.titre.slice(0,16)+'…':n.titre, x, y+fs*0.5)
      ctx.fillStyle=SCOL[n.status]||SCOL.vide; ctx.font=`400 ${Math.max(7,r*0.155)}px 'Inter',system-ui`
      ctx.fillText(`${n.comp}C · ${n.mc}M`, x, y+fs*0.5+Math.max(8,r*0.165)*1.3)
    })
  }, [nodes])

  useEffect(() => { draw(); window.addEventListener('resize',draw); return ()=>window.removeEventListener('resize',draw) }, [draw])

  function getHit(e) {
    const cv=cvRef.current; if(!cv) return null
    const rect=cv.getBoundingClientRect()
    const mx=(e.clientX-rect.left)*(cv.width/rect.width)
    const my=(e.clientY-rect.top)*(cv.height/rect.height)
    return nodes.find(n=>{ const r=28+n.comp*3.5+n.mc*1.5; const dx=mx-n.x*cv.width,dy=my-n.y*cv.height; return Math.sqrt(dx*dx+dy*dy)<=r })
  }

  return (
    <div style={{ position:'relative', borderRadius:12, border:`1px solid ${P.border}`, overflow:'hidden', background:'rgba(227,255,240,0.30)' }}>
      <canvas ref={cvRef} style={{ display:'block', cursor:'default' }}
        onMouseMove={e=>{
          const n=getHit(e), tip=document.getElementById('gtip')
          if(n&&tip){ e.currentTarget.style.cursor='pointer'; tip.style.opacity='1'; tip.style.left=(e.clientX+14)+'px'; tip.style.top=Math.max(8,e.clientY-12)+'px'
            const al=(alertes||[]).filter(a=>(a.modules||[]).some(m=>(n.modules||[]).map(x=>x.id).includes(m)))
            tip.innerHTML=`<strong style="color:${SCOL[n.status]}">${n.id}</strong> · ${n.comp}C · ${n.mc}M<br><span style="opacity:.6;font-size:11px">${n.titre}</span>${al.length&&showAlerts?`<div style="margin-top:5px;color:#EF9F27;font-size:11px">⚠ ${al[0].message}</div>`:''}`
          } else { e.currentTarget.style.cursor='default'; if(tip) tip.style.opacity='0' }
        }}
        onMouseLeave={()=>{ const tip=document.getElementById('gtip'); if(tip) tip.style.opacity='0' }}
        onClick={e=>{
          const tip=document.getElementById('gtip'); if(tip) tip.style.opacity='0'
          const n=getHit(e)
          if(!n){ setPanel(null); return }
          if(n.status==='incoherence'&&onClickBloc){ onClickBloc(n); return }
          setPanel(prev=>prev?.id===n.id?null:n)
        }}
      />
      {nodes.length>0&&(
        <div style={{ position:'absolute', top:10, left:10, background:'rgba(11,43,45,0.88)', borderRadius:8, padding:'7px 11px', border:`1px solid ${P.borderm}`, fontSize:10, color:P.givre, backdropFilter:'blur(6px)' }}>
          {[['#5DE298','Nominal'],['#EF9F27','Coordination'],['#E24B4A','Incohérence'],['#8EADA8','Non déclaré']].map(([c,l])=>(
            <div key={l} style={{ display:'flex', alignItems:'center', marginBottom:3 }}>
              <span style={{ width:8,height:8,borderRadius:'50%',background:c,display:'inline-block',marginRight:5,flexShrink:0 }}/>{l}
            </div>
          ))}
          <div style={{ marginTop:4,color:'rgba(227,255,240,0.35)',borderTop:'1px solid rgba(93,226,152,0.15)',paddingTop:4 }}>Clic = détail · Rouge = zoom</div>
        </div>
      )}
      {panel&&(
        <div style={{ position:'absolute',right:0,top:0,width:250,height:'100%',background:'rgba(11,43,45,0.96)',borderLeft:`1px solid ${P.borderm}`,padding:'0.9rem',overflowY:'auto',backdropFilter:'blur(6px)',animation:'fadeIn 0.2s ease' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'0.75rem' }}>
            <div><div style={{ fontFamily:'var(--font-t)',fontSize:14,color:P.givre,lineHeight:1.3 }}>{panel.titre}</div><div style={{ fontSize:10,color:'rgba(227,255,240,0.4)',marginTop:3 }}>{panel.comp}C · {panel.mc}M</div></div>
            <button onClick={()=>setPanel(null)} style={{ color:P.textm,fontSize:16,padding:'0 0 0 6px',flexShrink:0 }}>×</button>
          </div>
          <div style={{ marginBottom:'0.6rem' }}>
            <div style={{ fontSize:10,fontWeight:600,color:'rgba(93,226,152,0.6)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.4rem' }}>Compétences</div>
            {(panel.competences||[]).map(c=>(
              <div key={c.id} style={{ fontSize:11,color:P.givre,padding:'3px 0',borderBottom:'1px solid rgba(93,226,152,0.08)',lineHeight:1.5 }}><span style={{ color:P.menthe,fontWeight:600,marginRight:5 }}>{c.id}</span>{c.libelle}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize:10,fontWeight:600,color:'rgba(93,226,152,0.6)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.4rem' }}>Modules</div>
            {(panel.modules||[]).map(m=>(
              <div key={m.id} style={{ fontSize:11,color:'rgba(227,255,240,0.7)',padding:'3px 0',borderBottom:'1px solid rgba(93,226,152,0.08)' }}>{m.titre}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TOPBAR
═══════════════════════════════════════════════════════════════ */
function Topbar({ role, campus, formationTitre, onBack, onglet, setOnglet, onglets }) {
  const roleLabel = ROLES.find(r=>r.id===role)?.label||''
  return (
    <div style={{ height:52, display:'flex', alignItems:'center', gap:'0.65rem', padding:'0 1.25rem', position:'sticky', top:0, zIndex:100, background:P.surface, borderBottom:`1px solid ${P.border}`, boxShadow:'0 1px 8px rgba(11,43,45,0.06)' }}>
      <button onClick={onBack} style={{ color:P.textm, fontSize:18, lineHeight:1, padding:'0 4px' }}>←</button>
      <div style={{ display:'flex', alignItems:'center', gap:6, paddingRight:10, borderRight:`1px solid ${P.border}` }}>
        <div style={{ width:24, height:24, borderRadius:'50%', background:P.petrole, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ color:P.menthe, fontSize:11, fontWeight:700, fontFamily:'var(--font-t)', fontStyle:'italic' }}>e</span>
        </div>
        <span style={{ fontSize:10, fontWeight:600, color:P.petrole, letterSpacing:'0.06em', textTransform:'uppercase' }}>Éminéo</span>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:600, color:P.abysse, lineHeight:1.2 }}>{roleLabel}{campus?` · ${campus}`:''}</div>
        <div style={{ fontSize:10, color:P.textl }}>{formationTitre||'Atlas des compétences'}</div>
      </div>
      <div style={{ display:'flex', gap:'0.3rem' }}>
        {onglets.map(t=>(
          <button key={t.id} onClick={()=>setOnglet(t.id)} style={{ borderRadius:6, padding:'4px 12px', fontSize:12, fontWeight:500, background:onglet===t.id?'rgba(93,226,152,0.15)':'transparent', border:`1px solid ${onglet===t.id?P.borderm:'transparent'}`, color:onglet===t.id?P.petrole:P.textm, transition:'all 0.15s' }}>{t.label}</button>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   BADGE FORMATION — carte réutilisable
═══════════════════════════════════════════════════════════════ */
function FormationCard({ f, onClick, selected, actions }) {
  const nbBlocs = (f.blocs||[]).length
  const nbComp  = (f.blocs||[]).flatMap(b=>b.competences||[]).length
  const nbMod   = (f.blocs||[]).flatMap(b=>b.modules||[]).length
  const nbAlert = (f.alertes_detectees||[]).length
  return (
    <div onClick={onClick} style={{ ...card({ cursor:onClick?'pointer':'default', borderLeft:`3px solid ${selected?P.menthe:P.border}`, background:selected?'rgba(93,226,152,0.04)':P.surface }), transition:'all 0.15s' }}
      onMouseEnter={e=>onClick&&(e.currentTarget.style.boxShadow='0 4px 16px rgba(11,43,45,0.10)')}
      onMouseLeave={e=>onClick&&(e.currentTarget.style.boxShadow='0 1px 6px rgba(11,43,45,0.06)')}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, color:P.abysse, lineHeight:1.3 }}>{f.formation?.titre||'Formation sans titre'}</div>
          <div style={{ fontSize:11, color:P.textm, marginTop:3 }}>
            {f._campus&&<span style={{ marginRight:8 }}>📍 {f._campus}</span>}
            {f.formation?.annee&&<span>{f.formation.annee}</span>}
          </div>
          <div style={{ display:'flex', gap:'1rem', marginTop:'0.5rem' }}>
            {[['blocs',nbBlocs],['compétences',nbComp],['modules',nbMod]].map(([l,v])=>(
              <div key={l}><span style={{ fontSize:13, fontWeight:700, color:P.petrole }}>{v}</span><span style={{ fontSize:10, color:P.textm, marginLeft:3 }}>{l}</span></div>
            ))}
            {nbAlert>0&&<div><span style={{ fontSize:13, fontWeight:700, color:P.amber }}>{nbAlert}</span><span style={{ fontSize:10, color:P.textm, marginLeft:3 }}>alerte{nbAlert>1?'s':''}</span></div>}
          </div>
        </div>
        {actions&&<div onClick={e=>e.stopPropagation()} style={{ display:'flex', gap:'0.35rem', flexShrink:0, marginLeft:'0.75rem' }}>{actions}</div>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   LANDING
═══════════════════════════════════════════════════════════════ */
function Landing({ onEnter, formations }) {
  const [role,    setRole]    = useState(null)
  const [campus,  setCampus]  = useState('')
  const [formId,  setFormId]  = useState(null)
  const [promo,   setPromo]   = useState('')
  const [nom,     setNom]     = useState('')

  /* Formations visibles selon le rôle */
  const formationsPourRole = () => {
    if (!role) return []
    if (role==='dir') return formations
    if (role==='rp') return campus ? formations.filter(f=>f._campus?.toLowerCase().includes(campus.toLowerCase())) : formations
    if (role==='intervenant') return nom
      ? formations.filter(f=>(f.intervenants||[]).some(i=>i.toLowerCase().includes(nom.toLowerCase())) || (f.blocs||[]).flatMap(b=>b.modules||[]).some(m=>m.intervenant?.toLowerCase().includes(nom.toLowerCase())))
      : formations
    if (role==='etudiant') return formations
    return []
  }

  const canEnter = () => {
    if (!role) return false
    if (role==='dir') return true
    if (role==='rp') return !!campus
    if (role==='intervenant') return !!nom
    if (role==='etudiant') return !!formId
    return false
  }

  const fVisible = formationsPourRole()

  return (
    <div style={{ minHeight:'100vh', background:'var(--grad-fond)', display:'flex', alignItems:'stretch', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, opacity:0.04, pointerEvents:'none', backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize:'180px' }}/>
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0.07 }} viewBox="0 0 1200 800" fill="none" stroke="white">
          <circle cx="950" cy="150" r="350" strokeWidth="0.6"/><circle cx="950" cy="150" r="220" strokeWidth="0.4"/><circle cx="950" cy="150" r="110" strokeWidth="0.3"/>
        </svg>
      </div>

      {/* Colonne gauche */}
      <div style={{ width:'42%', flexShrink:0, display:'flex', flexDirection:'column', justifyContent:'center', padding:'4rem 3rem 3rem 4rem', position:'relative', animation:'fadeUp 0.5s ease both' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'2.5rem' }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background:P.givre, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ color:P.abysse, fontSize:20, fontWeight:700, fontFamily:'var(--font-t)', fontStyle:'italic', lineHeight:1 }}>e</span>
          </div>
          <div>
            <div style={{ color:P.givre, fontSize:18, fontFamily:'var(--font-t)', fontWeight:600, letterSpacing:'-0.01em', lineHeight:1 }}>emineo</div>
            <div style={{ color:P.menthe, fontSize:9, fontWeight:600, letterSpacing:'0.18em', textTransform:'uppercase', marginTop:1 }}>ÉDUCATION</div>
          </div>
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, border:'1px solid rgba(93,226,152,0.22)', borderRadius:6, padding:'4px 12px', fontSize:10, fontWeight:500, color:'rgba(227,255,240,0.45)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'1.5rem', width:'fit-content' }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:formations.length?P.menthe:P.amber, display:'inline-block' }}/>
          {formations.length ? `${formations.length} formation${formations.length>1?'s':''} chargée${formations.length>1?'s':''}` : 'Aucune formation configurée'}
        </div>
        <h1 style={{ fontFamily:'var(--font-t)', color:P.givre, fontSize:'clamp(2.2rem,4vw,3.2rem)', fontWeight:400, lineHeight:1.08, letterSpacing:'-0.01em', marginBottom:'1.25rem' }}>
          Atlas des<br/><em style={{ fontStyle:'italic', color:P.menthe }}>compétences</em>
        </h1>
        <p style={{ fontSize:14, color:'rgba(227,255,240,0.40)', lineHeight:1.8, maxWidth:320, marginBottom:'1.5rem', fontWeight:300 }}>
          Coordination pédagogique inter-intervenants. Chaque acteur voit sa position dans le parcours — et ce que les autres ont couvert.
        </p>
        {formations.length>0&&(
          <div style={{ display:'flex', gap:'2rem' }}>
            {[[formations.length,'formations'],[(formations.flatMap(f=>f.blocs||[])).length,'blocs'],[(formations.flatMap(f=>(f.alertes_detectees||[]))).length,'alertes']].map(([v,l])=>(
              <div key={l}><div style={{ fontSize:20, fontWeight:700, color:P.givre, fontFamily:'var(--font-t)', lineHeight:1 }}>{v}</div><div style={{ fontSize:10, color:'rgba(227,255,240,0.35)', marginTop:2 }}>{l}</div></div>
            ))}
          </div>
        )}
        <div style={{ position:'absolute', right:0, top:'10%', bottom:'10%', width:1, background:'rgba(93,226,152,0.08)' }}/>
      </div>

      {/* Colonne droite — funnel */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'3rem 3rem 3rem 3rem', animation:'fadeUp 0.5s 0.12s ease both' }}>
        <div style={{ width:'100%', maxWidth:420, background:'rgba(227,255,240,0.04)', border:'1px solid rgba(93,226,152,0.12)', borderRadius:20, padding:'2rem', backdropFilter:'blur(12px)' }}>
          <p style={{ fontSize:10, fontWeight:600, color:'rgba(227,255,240,0.35)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'0.75rem' }}>Qui êtes-vous ?</p>
          {ROLES.map(r=>(
            <button key={r.id} onClick={()=>{ setRole(r.id); setCampus(''); setNom(''); setFormId(null) }}
              style={{ width:'100%', textAlign:'left', padding:'0.75rem 0.9rem', borderRadius:10, marginBottom:'0.35rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.65rem', fontSize:13, transition:'all 0.18s ease', border:`1px solid ${role===r.id?'rgba(93,226,152,0.45)':'rgba(93,226,152,0.10)'}`, background:role===r.id?'rgba(93,226,152,0.12)':'rgba(93,226,152,0.03)', color:role===r.id?P.givre:'rgba(227,255,240,0.65)' }}>
              <span style={{ fontSize:15, width:22, textAlign:'center', opacity:0.7, flexShrink:0 }}>{r.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div>{r.label}</div>
                <div style={{ fontSize:10, color:'rgba(227,255,240,0.35)', marginTop:1 }}>{r.desc}</div>
              </div>
            </button>
          ))}

          {/* Champ campus — RP */}
          {role==='rp'&&(
            <div style={{ marginTop:'1.25rem', animation:'fadeUp 0.28s ease both' }}>
              <hr style={{ border:'none', borderTop:'1px solid rgba(93,226,152,0.10)', marginBottom:'0.75rem' }}/>
              <p style={{ fontSize:10, fontWeight:600, color:'rgba(227,255,240,0.35)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'0.5rem' }}>Votre campus</p>
              <input value={campus} onChange={e=>setCampus(e.target.value)} placeholder="Saisir le nom du campus…"
                style={{ width:'100%', background:'rgba(93,226,152,0.06)', border:'1px solid rgba(93,226,152,0.18)', borderRadius:8, padding:'0.5rem 0.75rem', fontSize:13, color:P.givre, outline:'none' }}/>
              {campus&&fVisible.length>0&&(
                <div style={{ marginTop:'0.5rem', fontSize:11, color:'rgba(227,255,240,0.45)' }}>{fVisible.length} formation{fVisible.length>1?'s':''} trouvée{fVisible.length>1?'s':''}</div>
              )}
            </div>
          )}

          {/* Champ nom — Intervenant */}
          {role==='intervenant'&&(
            <div style={{ marginTop:'1.25rem', animation:'fadeUp 0.28s ease both' }}>
              <hr style={{ border:'none', borderTop:'1px solid rgba(93,226,152,0.10)', marginBottom:'0.75rem' }}/>
              <p style={{ fontSize:10, fontWeight:600, color:'rgba(227,255,240,0.35)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'0.5rem' }}>Votre nom</p>
              <input value={nom} onChange={e=>setNom(e.target.value)} placeholder="Prénom Nom…"
                style={{ width:'100%', background:'rgba(93,226,152,0.06)', border:'1px solid rgba(93,226,152,0.18)', borderRadius:8, padding:'0.5rem 0.75rem', fontSize:13, color:P.givre, outline:'none' }}/>
              {nom&&fVisible.length>0&&(
                <div style={{ marginTop:'0.5rem', fontSize:11, color:'rgba(227,255,240,0.45)' }}>{fVisible.length} formation{fVisible.length>1?'s':''} correspondent</div>
              )}
            </div>
          )}

          {/* Choix formation — Étudiant */}
          {role==='etudiant'&&formations.length>0&&(
            <div style={{ marginTop:'1.25rem', animation:'fadeUp 0.28s ease both' }}>
              <hr style={{ border:'none', borderTop:'1px solid rgba(93,226,152,0.10)', marginBottom:'0.75rem' }}/>
              <p style={{ fontSize:10, fontWeight:600, color:'rgba(227,255,240,0.35)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:'0.5rem' }}>Votre formation</p>
              {formations.map(f=>(
                <button key={f._id} onClick={()=>setFormId(f._id)} style={{ width:'100%', textAlign:'left', padding:'0.6rem 0.8rem', borderRadius:8, marginBottom:'0.3rem', cursor:'pointer', fontSize:13, transition:'all 0.15s', border:`1px solid ${formId===f._id?'rgba(93,226,152,0.5)':'rgba(93,226,152,0.12)'}`, background:formId===f._id?'rgba(93,226,152,0.15)':'rgba(93,226,152,0.04)', color:formId===f._id?P.givre:'rgba(227,255,240,0.65)' }}>
                  <div style={{ fontWeight:500 }}>{f.formation?.titre||'Sans titre'}</div>
                  {f._campus&&<div style={{ fontSize:10, color:'rgba(227,255,240,0.4)', marginTop:1 }}>{f._campus}</div>}
                </button>
              ))}
            </div>
          )}

          <button disabled={!canEnter()} onClick={()=>canEnter()&&onEnter({ role, campus, nom, formId, formations: fVisible })}
            style={{ width:'100%', padding:'0.85rem', borderRadius:10, fontSize:14, fontWeight:500, marginTop:'1.25rem', transition:'all 0.2s', cursor:canEnter()?'pointer':'not-allowed', border:'none', background:canEnter()?`linear-gradient(135deg,${P.petrole},${P.menthe})`:'rgba(93,226,152,0.08)', color:canEnter()?P.abysse:'rgba(227,255,240,0.25)', boxShadow:canEnter()?'0 4px 20px rgba(93,226,152,0.22)':'none' }}>
            Accéder à l'Atlas →
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VUE DIRECTION — ingestion multi-formations
═══════════════════════════════════════════════════════════════ */
function VueDir({ formations, onFormationsChange, onBack }) {
  const [onglet,   setOnglet]   = useState('formations')
  const [files,    setFiles]    = useState([])
  const [campus,   setCampus]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [progress, setProgress] = useState('')
  const [error,    setError]    = useState('')
  const [selF,     setSelF]     = useState(null) // formation sélectionnée pour la carto

  const totalAlertes = formations.flatMap(f=>f.alertes_detectees||[]).length

  async function lireTexte(file) {
    return new Promise((res,rej) => { const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsText(file,'utf-8') })
  }

  async function handleIngestion() {
    if (!files.length||!campus.trim()) return
    if (!API_KEY) { setError('Clé API manquante — VITE_ANTHROPIC_API_KEY'); return }
    setLoading(true); setError(''); setProgress('Lecture des fichiers…')
    try {
      const textes = await Promise.all(files.map(f=>lireTexte(f)))
      const data   = await ingererDocuments(textes, campus.trim(), setProgress)
      const updated = [...formations, data]
      onFormationsChange(updated)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      setProgress(`Formation "${data.formation?.titre}" chargée ✓`)
      setFiles([]); setCampus('')
      setOnglet('formations')
    } catch(e) { setError('Erreur : '+e.message) }
    finally { setLoading(false) }
  }

  function handleDelete(id) {
    if (!confirm('Supprimer cette formation ?')) return
    const updated = formations.filter(f=>f._id!==id)
    onFormationsChange(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    if (selF?._id===id) setSelF(null)
  }

  const fCarto = selF || formations[0] || null

  return (
    <div style={{ minHeight:'100vh', background:P.givre }}>
      <Topbar role="dir" formationTitre="Direction des programmes" onBack={onBack} onglet={onglet} setOnglet={setOnglet}
        onglets={[{id:'formations',label:'Formations'},{id:'ingestion',label:'+ Ingestion'},{id:'cartographie',label:'Cartographie'},{id:'alertes',label:`Alertes (${totalAlertes})`}]}/>

      <div style={{ maxWidth:960, margin:'0 auto', padding:'2rem 1.5rem' }}>

        {/* ── FORMATIONS ── */}
        {onglet==='formations'&&(
          <div className="fi">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.25rem' }}>
              <div>
                <h2 style={{ fontFamily:'var(--font-t)', fontWeight:400, color:P.abysse, margin:0, fontSize:24 }}>Formations chargées</h2>
                <p style={{ fontSize:13, color:P.textm, marginTop:'0.25rem' }}>{formations.length} formation{formations.length>1?'s':''} · {formations.flatMap(f=>f.blocs||[]).length} blocs au total</p>
              </div>
              <button onClick={()=>setOnglet('ingestion')} style={{ background:P.petrole, color:P.givre, border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:500 }}>+ Ajouter une formation</button>
            </div>
            {formations.length===0&&<EmptyState icon="🎓" titre="Aucune formation" message="Utilisez l'onglet Ingestion pour analyser vos premiers documents." action="Aller à l'ingestion →" onAction={()=>setOnglet('ingestion')}/>}
            {formations.map(f=>(
              <FormationCard key={f._id} f={f}
                actions={[
                  <button key="carto" onClick={()=>{ setSelF(f); setOnglet('cartographie') }} style={{ fontSize:11, color:P.petrole, border:`1px solid ${P.border}`, borderRadius:6, padding:'3px 9px', background:P.surface2 }}>Cartographie</button>,
                  <button key="del"   onClick={()=>handleDelete(f._id)} style={{ fontSize:11, color:P.red, border:`1px solid ${P.red}`, borderRadius:6, padding:'3px 9px', background:P.redbg }}>Supprimer</button>,
                ]}
              />
            ))}
          </div>
        )}

        {/* ── INGESTION ── */}
        {onglet==='ingestion'&&(
          <div className="fi">
            <h2 style={{ fontFamily:'var(--font-t)', fontWeight:400, color:P.abysse, marginTop:0, fontSize:24, marginBottom:'0.4rem' }}>Nouvelle formation</h2>
            <p style={{ fontSize:13, color:P.textm, marginBottom:'2rem', lineHeight:1.7 }}>Déposez les fichiers texte (.txt .md) de la formation à analyser — syllabi, plan de formation, RACE. Claude extrait blocs, compétences, modules et redondances.</p>

            {/* Campus */}
            <div style={card({ marginBottom:'1rem' })}>
              <div style={{ fontSize:12, fontWeight:600, color:P.abysse, marginBottom:'0.5rem' }}>Campus de rattachement</div>
              <input value={campus} onChange={e=>setCampus(e.target.value)} placeholder="Ex : Bordeaux, Paris, Nantes…"
                style={{ width:'100%', border:`1px solid ${P.border}`, borderRadius:8, padding:'0.55rem 0.75rem', fontSize:13, color:P.abysse, outline:'none', background:campus?P.surface:P.surface2 }}/>
            </div>

            {/* Zone dépôt */}
            <div onDragOver={e=>e.preventDefault()}
              onDrop={e=>{ e.preventDefault(); setFiles(prev=>[...prev,...Array.from(e.dataTransfer.files)]) }}
              onDragEnter={e=>e.currentTarget.style.background='rgba(93,226,152,0.10)'}
              onDragLeave={e=>e.currentTarget.style.background='rgba(93,226,152,0.04)'}
              onClick={()=>document.getElementById('file-input').click()}
              style={{ border:`2px dashed ${P.borderm}`, borderRadius:16, padding:'2.5rem 2rem', textAlign:'center', background:'rgba(93,226,152,0.04)', marginBottom:'1rem', cursor:'pointer', transition:'background 0.2s' }}>
              <input id="file-input" type="file" multiple accept=".txt,.md,.csv" style={{ display:'none' }} onChange={e=>setFiles(prev=>[...prev,...Array.from(e.target.files)])}/>
              <div style={{ fontSize:28, marginBottom:'0.6rem', opacity:0.45 }}>📄</div>
              <div style={{ fontSize:14, fontWeight:500, color:P.petrole, marginBottom:'0.25rem' }}>Glisser-déposer ou cliquer</div>
              <div style={{ fontSize:12, color:P.textm }}>Syllabi · Plan de formation · RACE · .txt .md</div>
            </div>

            {files.length>0&&(
              <div style={{ marginBottom:'1rem' }}>
                {files.map((f,i)=>(
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.5rem 0.75rem', background:P.surface, borderRadius:8, border:`1px solid ${P.border}`, marginBottom:'0.35rem' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      <span style={{ fontSize:14 }}>📄</span>
                      <div><div style={{ fontSize:13, fontWeight:500, color:P.abysse }}>{f.name}</div><div style={{ fontSize:11, color:P.textm }}>{(f.size/1024).toFixed(1)} Ko</div></div>
                    </div>
                    <button onClick={()=>setFiles(prev=>prev.filter((_,j)=>j!==i))} style={{ color:P.red, fontSize:16, padding:'0 4px' }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleIngestion} disabled={loading||!files.length||!campus.trim()||!API_KEY}
              style={{ width:'100%', padding:'0.9rem', borderRadius:10, fontSize:14, fontWeight:600, border:'none', transition:'all 0.2s',
                cursor:(!loading&&files.length&&campus.trim()&&API_KEY)?'pointer':'not-allowed',
                background:(!loading&&files.length&&campus.trim()&&API_KEY)?`linear-gradient(135deg,${P.petrole},${P.menthe})`:'rgba(19,69,71,0.08)',
                color:(!loading&&files.length&&campus.trim()&&API_KEY)?P.abysse:P.textm,
                boxShadow:(!loading&&files.length&&campus.trim()&&API_KEY)?'0 4px 20px rgba(93,226,152,0.22)':'none' }}>
              {loading?<span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem' }}><Spinner size={16}/>{progress||'Analyse…'}</span>:'Analyser avec Claude →'}
            </button>
            {error&&<div style={{ marginTop:'1rem', padding:'0.75rem 1rem', background:P.redbg, border:`1px solid ${P.red}`, borderRadius:8, fontSize:12, color:'#8B1A1A' }}>{error}</div>}
            {!API_KEY&&<div style={{ marginTop:'1rem', padding:'0.75rem 1rem', background:P.amberbg, border:`1px solid ${P.amber}`, borderRadius:8, fontSize:12, color:'#7A4A00' }}>⚠ Clé API non configurée — définir VITE_ANTHROPIC_API_KEY dans Vercel.</div>}
          </div>
        )}

        {/* ── CARTOGRAPHIE ── */}
        {onglet==='cartographie'&&(
          <div className="fi">
            {formations.length===0&&<EmptyState icon="🗺" titre="Aucune formation" message="Chargez au moins une formation pour afficher la cartographie." action="Aller à l'ingestion →" onAction={()=>setOnglet('ingestion')}/>}
            {formations.length>0&&(
              <>
                {/* Sélecteur de formation */}
                {formations.length>1&&(
                  <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1rem', flexWrap:'wrap' }}>
                    {formations.map(f=>(
                      <button key={f._id} onClick={()=>setSelF(f)} style={{ padding:'5px 14px', borderRadius:8, fontSize:12, fontWeight:500, transition:'all 0.15s', cursor:'pointer', border:`1px solid ${fCarto?._id===f._id?P.borderm:P.border}`, background:fCarto?._id===f._id?'rgba(93,226,152,0.12)':P.surface, color:fCarto?._id===f._id?P.petrole:P.textm }}>
                        {f.formation?.titre||'Sans titre'}{f._campus?` · ${f._campus}`:''}
                      </button>
                    ))}
                  </div>
                )}
                <h2 style={{ fontFamily:'var(--font-t)', fontWeight:400, color:P.abysse, marginTop:0, fontSize:22, marginBottom:'1rem' }}>
                  {fCarto?.formation?.titre||'Cartographie'}{fCarto?._campus?` — ${fCarto._campus}`:''}
                </h2>
                <GrapheCanvas blocs={fCarto?.blocs||[]} alertes={fCarto?.alertes_detectees||[]} showAlerts/>
              </>
            )}
          </div>
        )}

        {/* ── ALERTES RÉSEAU ── */}
        {onglet==='alertes'&&(
          <div className="fi">
            <h2 style={{ fontFamily:'var(--font-t)', fontWeight:400, color:P.abysse, marginTop:0, fontSize:22, marginBottom:'0.5rem' }}>Alertes réseau</h2>
            <p style={{ fontSize:12, color:P.textm, marginBottom:'1.25rem', lineHeight:1.6 }}>Signaux de coordination identifiés par analyse sémantique — opportunités pédagogiques, pas des sanctions.</p>
            {totalAlertes===0&&<EmptyState icon="✅" titre="Aucune alerte" message="Aucune redondance détectée dans les formations chargées."/>}
            {formations.map(f=>{
              const al = f.alertes_detectees||[]
              if (!al.length) return null
              return (
                <div key={f._id} style={{ marginBottom:'1.5rem' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:P.textm, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.5rem' }}>{f.formation?.titre}{f._campus?` · ${f._campus}`:''}</div>
                  {al.map((a,i)=>(
                    <div key={i} style={card({ borderLeft:`3px solid ${a.niveau===2?P.amber:P.menthe}` })}>
                      <div style={{ display:'flex', gap:'0.4rem', alignItems:'center', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                        <Tag label={`Niveau ${a.niveau}`} color={a.niveau===2?'amber':'blue'} small/>
                        <span style={{ fontSize:13, fontWeight:600, color:P.abysse }}>{a.notion}</span>
                      </div>
                      <p style={{ fontSize:12, color:P.textm, margin:'0 0 0.4rem', lineHeight:1.6 }}>{a.message}</p>
                      {a.modules?.length>0&&<div style={{ fontSize:11, color:P.textl }}>Modules : {a.modules.join(' · ')}</div>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VUE RP — ses formations filtrées par campus
═══════════════════════════════════════════════════════════════ */
function VueRP({ campus, formations, onBack }) {
  const [onglet, setOnglet] = useState('formations')
  const [selF,   setSelF]   = useState(formations[0]||null)
  const [bab,    setBab]    = useState(null)

  const f = selF
  const alertes = f?.alertes_detectees||[]

  return (
    <div style={{ minHeight:'100vh', background:P.givre }}>
      <Topbar role="rp" campus={campus} formationTitre={f?.formation?.titre||''} onBack={onBack} onglet={onglet} setOnglet={setOnglet}
        onglets={[{id:'formations',label:'Mes formations'},{id:'cartographie',label:'Cartographie'},{id:'blocs',label:'Blocs'},{id:'alertes',label:`Alertes (${alertes.length})`}]}/>
      <div style={{ maxWidth:1060, margin:'0 auto', padding:'1.5rem', display:'flex', gap:'1.25rem' }}>
        {/* Sidebar */}
        <div style={{ width:200, flexShrink:0 }}>
          <div style={card({ padding:'0.75rem' })}>
            <div style={{ fontSize:10, fontWeight:600, color:P.textm, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.5rem' }}>Campus {campus}</div>
            {formations.length===0&&<div style={{ fontSize:12, color:P.textm }}>Aucune formation</div>}
            {formations.map(fo=>(
              <button key={fo._id} onClick={()=>setSelF(fo)} style={{ width:'100%', textAlign:'left', padding:'6px 8px', borderRadius:6, marginBottom:'0.2rem', fontSize:12, cursor:'pointer', transition:'all 0.15s', border:`1px solid ${selF?._id===fo._id?P.borderm:'transparent'}`, background:selF?._id===fo._id?'rgba(93,226,152,0.10)':'transparent', color:selF?._id===fo._id?P.petrole:P.textm }}>
                <div style={{ fontWeight:selF?._id===fo._id?600:400 }}>{fo.formation?.titre||'Sans titre'}</div>
                <div style={{ fontSize:10, color:P.textl, marginTop:1 }}>{(fo.blocs||[]).length}B · {(fo.blocs||[]).flatMap(b=>b.modules||[]).length}M</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, minWidth:0 }} className="fi">
          {!f&&<EmptyState icon="🎓" titre="Aucune formation sur ce campus" message="Contacter la Direction des programmes pour charger une formation."/>}
          {f&&onglet==='formations'&&(
            <>
              <h2 style={{ fontFamily:'var(--font-t)', fontWeight:400, color:P.abysse, marginTop:0, fontSize:22, marginBottom:'1rem' }}>Mes formations — {campus}</h2>
              {formations.map(fo=><FormationCard key={fo._id} f={fo} selected={selF?._id===fo._id} onClick={()=>setSelF(fo)}/>)}
            </>
          )}
          {f&&onglet==='cartographie'&&(
            <>
              <h2 style={{ fontFamily:'var(--font-t)', fontWeight:400, color:P.abysse, marginTop:0, fontSize:22, marginBottom:'1rem' }}>{f.formation?.titre}</h2>
              <GrapheCanvas blocs={f.blocs||[]} alertes={alertes} showAlerts onClickBloc={n=>setBab(bab?.id===n.id?null:n)}/>
              {bab&&(
                <div style={{ background:P.surface, borderRadius:12, border:`1px solid ${P.red}`, overflow:'hidden', marginTop:'0.75rem', animation:'fadeUp 0.3s ease' }}>
                  <div style={{ background:P.abysse, padding:'8px 14px', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                    <button onClick={()=>setBab(null)} style={{ background:'rgba(93,226,152,0.12)', border:`1px solid ${P.borderm}`, color:P.givre, borderRadius:6, padding:'2px 9px', fontSize:11 }}>← Retour</button>
                    <span style={{ color:P.givre, fontSize:13, fontWeight:600 }}>{bab.id} — {bab.titre}</span>
                  </div>
                  <div style={{ padding:'1rem' }}>
                    {alertes.filter(a=>(a.modules||[]).some(m=>(bab.modules||[]).map(x=>x.id).includes(m))).map((a,i)=>(
                      <div key={i} style={{ padding:'0.6rem 0.8rem', background:a.niveau===2?P.amberbg:P.redbg, borderLeft:`3px solid ${a.niveau===2?P.amber:P.red}`, borderRadius:'0 8px 8px 0', fontSize:12, color:a.niveau===2?'#7A4A00':'#8B1A1A', lineHeight:1.6, marginBottom:'0.4rem' }}>
                        <strong>{a.notion}</strong> — {a.message}
                      </div>
                    ))}
                    <div style={{ marginTop:'0.5rem', padding:'0.6rem 0.8rem', background:'rgba(93,226,152,0.08)', borderRadius:6, fontSize:11, color:P.petrole, border:`1px solid ${P.borderm}` }}>Action suggérée : réunion de coordination des intervenants concernés.</div>
                  </div>
                </div>
              )}
            </>
          )}
          {f&&onglet==='blocs'&&(
            <>
              <h2 style={{ fontFamily:'var(--font-t)', fontWeight:400, color:P.abysse, marginTop:0, fontSize:22, marginBottom:'1rem' }}>Blocs — {f.formation?.titre}</h2>
              {(f.blocs||[]).map(b=>(
                <details key={b.id} style={{ ...card(), marginBottom:'0.6rem' }}>
                  <summary style={{ listStyle:'none', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
                    <div><Tag label={b.id} small/><span style={{ marginLeft:'0.5rem', fontSize:14, fontWeight:600, color:P.abysse }}>{b.titre}</span><div style={{ fontSize:11, color:P.textm, marginTop:3 }}>{b.competences?.length||0}C · {b.modules?.length||0}M</div></div>
                    <span style={{ fontSize:18, color:P.textm }}>▾</span>
                  </summary>
                  <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:`1px solid ${P.border}` }}>
                    {(b.modules||[]).map(m=>(
                      <div key={m.id} style={{ background:P.surface2, borderRadius:8, padding:'0.5rem 0.75rem', marginBottom:'0.35rem', border:`1px solid ${P.border}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                          <div style={{ fontSize:13, fontWeight:500, color:P.abysse }}>{m.titre}</div>
                          {m.volume&&<Tag label={m.volume} color="gray" small/>}
                        </div>
                        {m.intervenant&&<div style={{ fontSize:11, color:P.textm, marginTop:2 }}>{m.intervenant}</div>}
                        {m.notions_cles?.length>0&&<div style={{ display:'flex', flexWrap:'wrap', gap:'0.25rem', marginTop:'0.4rem' }}>{m.notions_cles.map(n=><Tag key={n} label={n} small/>)}</div>}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </>
          )}
          {f&&onglet==='alertes'&&(
            <>
              <h2 style={{ fontFamily:'var(--font-t)', fontWeight:400, color:P.abysse, marginTop:0, fontSize:22, marginBottom:'0.5rem' }}>Alertes — {f.formation?.titre}</h2>
              {alertes.length===0&&<EmptyState icon="✅" titre="Aucune alerte" message="Aucune redondance détectée dans cette formation."/>}
              {alertes.map((a,i)=>(
                <div key={i} style={card({ borderLeft:`3px solid ${a.niveau===2?P.amber:P.menthe}` })}>
                  <div style={{ display:'flex', gap:'0.4rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                    <Tag label={`Niveau ${a.niveau}`} color={a.niveau===2?'amber':'blue'} small/>
                    <span style={{ fontSize:13, fontWeight:600, color:P.abysse }}>{a.notion}</span>
                  </div>
                  <p style={{ fontSize:12, color:P.textm, margin:0, lineHeight:1.6 }}>{a.message}</p>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VUE INTERVENANT — ses modules sur toutes ses formations
═══════════════════════════════════════════════════════════════ */
function VueIntervenant({ nom, formations, onBack }) {
  const [selF,    setSelF]    = useState(formations[0]||null)
  const [onglet,  setOnglet]  = useState('avant')
  const [selMod,  setSelMod]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [fiche,   setFiche]   = useState(null)
  const [stream,  setStream]  = useState('')
  const [streaming,setStreaming]=useState(false)
  const [concepts,setConcepts]=useState([])
  const [ecart,   setEcart]   = useState('')
  const [signal,  setSignal]  = useState('bien')
  const [termine, setTermine] = useState(false)
  const [sent,    setSent]    = useState(false)

  /* Modules de l'intervenant dans la formation sélectionnée */
  const mesModules = selF ? (selF.blocs||[]).flatMap(b=>(b.modules||[]).map(m=>({...m,bloc_id:b.id,bloc_titre:b.titre}))).filter(m => !nom || !m.intervenant || m.intervenant.toLowerCase().includes(nom.toLowerCase())) : []

  async function chargerFiche(mod) {
    setSelMod(mod); setFiche(null); setStream(''); setLoading(true); setStreaming(true)
    setConcepts(mod.notions_cles||[])
    try {
      const result = await genererFicheJ1(selF, mod, partial=>setStream(partial))
      setFiche(result)
    } finally { setLoading(false); setStreaming(false) }
  }

  const toggle = c => setConcepts(p=>p.includes(c)?p.filter(x=>x!==c):[...p,c])

  return (
    <div style={{ minHeight:'100vh', background:P.givre }}>
      <Topbar role="intervenant" formationTitre={selF?.formation?.titre||''} onBack={onBack} onglet={onglet} setOnglet={setOnglet}
        onglets={[{id:'avant',label:'Avant la séance'},{id:'declaration',label:'Déclaration'},{id:'graphe',label:"Vue d'ensemble"}]}/>
      <div style={{ maxWidth:700, margin:'0 auto', padding:'2rem 1.5rem' }}>

        {/* Sélecteur de formation si plusieurs */}
        {formations.length>1&&(
          <div style={{ display:'flex', gap:'0.4rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
            {formations.map(f=>(
              <button key={f._id} onClick={()=>{ setSelF(f); setSelMod(null); setFiche(null) }} style={{ padding:'5px 12px', borderRadius:8, fontSize:12, cursor:'pointer', transition:'all 0.15s', border:`1px solid ${selF?._id===f._id?P.borderm:P.border}`, background:selF?._id===f._id?'rgba(93,226,152,0.12)':P.surface, color:selF?._id===f._id?P.petrole:P.textm }}>{f.formation?.titre||'Sans titre'}</button>
            ))}
          </div>
        )}

        {onglet==='avant'&&(
          <div className="fi">
            {!selF&&<EmptyState icon="📋" titre="Aucune formation" message="Aucune formation disponible."/>}
            {selF&&!selMod&&(
              <>
                <h2 style={{ fontFamily:'var(--font-t)', fontWeight:400, color:P.abysse, marginTop:0, fontSize:22, marginBottom:'0.5rem' }}>Choisir un module</h2>
                <p style={{ fontSize:13, color:P.textm, marginBottom:'1.25rem' }}>Sélectionnez le module pour générer votre fiche contexte J‑1.</p>
                {mesModules.length===0&&<div style={{ fontSize:13, color:P.textm, padding:'1rem', background:P.surface2, borderRadius:8 }}>Aucun module trouvé pour "{nom}" dans cette formation.</div>}
                {(selF.blocs||[]).map(b=>{
                  const bMods = mesModules.filter(m=>m.bloc_id===b.id)
                  if (!bMods.length) return null
                  return (
                    <div key={b.id} style={{ marginBottom:'1rem' }}>
                      <div style={{ fontSize:11, fontWeight:600, color:P.textm, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.4rem' }}>{b.id} — {b.titre}</div>
                      {bMods.map(m=>(
                        <button key={m.id} onClick={()=>chargerFiche(m)} style={{ width:'100%', textAlign:'left', padding:'0.75rem 1rem', borderRadius:10, border:`1px solid ${P.border}`, background:P.surface, marginBottom:'0.35rem', cursor:'pointer', transition:'all 0.15s', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                          onMouseEnter={e=>e.currentTarget.style.boxShadow='0 3px 12px rgba(11,43,45,0.08)'}
                          onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                          <div><div style={{ fontSize:13, fontWeight:500, color:P.abysse }}>{m.titre}</div>{m.intervenant&&<div style={{ fontSize:11, color:P.textm, marginTop:2 }}>{m.intervenant}</div>}</div>
                          <span style={{ fontSize:11, color:P.textm, flexShrink:0, marginLeft:'0.5rem' }}>Générer →</span>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </>
            )}
            {selF&&selMod&&(
              <>
                <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1.5rem' }}>
                  <button onClick={()=>{ setSelMod(null); setFiche(null) }} style={{ fontSize:12, color:P.petrole, border:`1px solid ${P.border}`, borderRadius:6, padding:'3px 10px', background:P.surface }}>← Modules</button>
                  <span style={{ fontSize:12, color:P.textm }}>›</span>
                  <span style={{ fontSize:13, fontWeight:600, color:P.abysse }}>{selMod.titre}</span>
                  <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.4rem' }}>
                    <span style={{ position:'relative', display:'inline-block', width:8, height:8 }}><span style={{ position:'absolute', inset:0, borderRadius:'50%', background:P.menthe, animation:'pulse 2s ease-in-out infinite' }}/><span style={{ position:'absolute', inset:0, borderRadius:'50%', background:P.menthe }}/></span>
                    <span style={{ fontSize:11, color:P.textm }}>Générée automatiquement</span>
                  </div>
                </div>
                {loading?(
                  <div style={{ padding:'1.25rem', background:P.abysse, borderRadius:12, border:`1px solid ${P.borderm}` }}>
                    <div style={{ fontSize:10, fontWeight:600, color:'rgba(93,226,152,0.5)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'0.5rem', display:'flex', alignItems:'center', gap:'0.5rem' }}><Spinner size={14}/> Claude génère la fiche…</div>
                    <div style={{ fontSize:11, color:P.eau, fontFamily:'monospace', lineHeight:1.7, whiteSpace:'pre-wrap', wordBreak:'break-word', minHeight:60 }}>{stream}{streaming&&<span className="stream-cursor"/>}</div>
                  </div>
                ):fiche&&(
                  <>
                    <div style={card()}>
                      <div style={{ fontSize:10, fontWeight:600, color:P.textm, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'0.5rem' }}>Ancrage pédagogique</div>
                      <div style={{ display:'flex', gap:'0.5rem', alignItems:'flex-start', marginBottom:'0.5rem' }}><Tag label={selMod.bloc_id}/><div><div style={{ fontSize:13, fontWeight:600, color:P.abysse }}>{selMod.titre}</div><div style={{ fontSize:11, color:P.textm, marginTop:2 }}>{selMod.bloc_titre}</div></div></div>
                      <p style={{ fontSize:12, color:P.textm, margin:0, lineHeight:1.6, fontStyle:'italic' }}>{fiche.ancrage}</p>
                    </div>
                    {selMod.notions_cles?.length>0&&(
                      <div style={card()}>
                        <div style={{ fontSize:10, fontWeight:600, color:P.textm, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'0.5rem' }}>Notions clés</div>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'0.35rem' }}>{selMod.notions_cles.map(n=><Tag key={n} label={n}/>)}</div>
                      </div>
                    )}
                    {fiche.dejavu?.length>0&&(
                      <div style={card()}>
                        <div style={{ fontSize:10, fontWeight:600, color:P.textm, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'0.5rem' }}>Ce que vos étudiants ont déjà vu</div>
                        {fiche.dejavu.map((item,i)=>(
                          <div key={i} style={{ background:P.surface2, borderRadius:8, padding:'0.55rem 0.8rem', marginBottom:'0.4rem' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'0.35rem', marginBottom:'0.3rem' }}>{item.intervenant&&<Avatar name={item.intervenant} size={20}/>}<span style={{ fontSize:12, fontWeight:600, color:P.abysse }}>{item.intervenant||'Intervenant'}</span><span style={{ fontSize:11, color:P.textm }}>· {item.module}</span></div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'0.25rem', marginBottom:'0.3rem' }}>{(item.concepts||[]).map(c=><Tag key={c} label={c} small/>)}</div>
                            <p style={{ fontSize:11, color:P.textm, margin:0, lineHeight:1.5, fontStyle:'italic' }}>{item.lien}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {fiche.apres?.length>0&&(
                      <div style={card()}>
                        <div style={{ fontSize:10, fontWeight:600, color:P.textm, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'0.5rem' }}>Ce qui arrive après</div>
                        {fiche.apres.map((item,i)=>(
                          <div key={i} style={{ display:'flex', gap:'0.6rem', padding:'0.4rem 0', borderBottom:i<fiche.apres.length-1?`1px solid rgba(19,69,71,0.06)`:'none', alignItems:'flex-start' }}>
                            <div style={{ fontSize:11, color:P.textl, flexShrink:0, width:60 }}>{item.date}</div>
                            <div style={{ flex:1 }}><span style={{ fontSize:12, fontWeight:600, color:P.abysse }}>{item.module}</span>{item.intervenant&&<span style={{ fontSize:11, color:P.textm }}> · {item.intervenant}</span>}<div style={{ display:'flex', flexWrap:'wrap', gap:'0.25rem', marginTop:'0.25rem' }}>{(item.concepts||[]).map(c=><Tag key={c} label={c} small/>)}</div></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {onglet==='declaration'&&(
          <div className="fi">
            {sent?(
              <div style={{ textAlign:'center', padding:'4rem 2rem' }}>
                <div style={{ fontSize:48, color:P.menthe, marginBottom:'0.6rem' }}>✓</div>
                <h2 style={{ fontFamily:'var(--font-t)', fontWeight:400, color:P.abysse, fontSize:21, marginBottom:'0.4rem' }}>Déclaration enregistrée</h2>
                <p style={{ color:P.textm, fontSize:13 }}>Merci. Le graphe sera mis à jour lors du prochain recalcul.</p>
                <button onClick={()=>setSent(false)} style={{ marginTop:'1.25rem', border:`1px solid ${P.border}`, color:P.textm, borderRadius:6, padding:'6px 16px', fontSize:12, background:P.surface }}>Nouvelle déclaration</button>
              </div>
            ):!selMod?(
              <div style={{ padding:'2rem', textAlign:'center', color:P.textm }}><div style={{ fontSize:13 }}>Sélectionnez d'abord un module dans l'onglet "Avant la séance".</div></div>
            ):(
              <>
                <div style={{ marginBottom:'1.25rem' }}><h1 style={{ fontFamily:'var(--font-t)', fontWeight:400, fontSize:21, color:P.abysse, margin:0 }}>Déclaration — {selMod.titre}</h1><p style={{ fontSize:12, color:P.textm, marginTop:'0.2rem' }}>~90 secondes</p></div>
                <div style={card()}>
                  <div style={{ fontSize:12, fontWeight:600, color:P.abysse, marginBottom:'0.5rem' }}><span style={{ color:P.menthe, marginRight:'0.35rem' }}>01</span>Notions couvertes</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'0.35rem' }}>
                    {(selMod.notions_cles||[]).map(c=>(
                      <button key={c} onClick={()=>toggle(c)} style={{ background:concepts.includes(c)?P.petrole:'rgba(19,69,71,0.06)', color:concepts.includes(c)?P.givre:P.textm, border:`1px solid ${concepts.includes(c)?P.petrole:P.border}`, borderRadius:20, padding:'4px 12px', fontSize:12, transition:'all 0.15s' }}>{c}</button>
                    ))}
                  </div>
                </div>
                <div style={card()}>
                  <div style={{ fontSize:12, fontWeight:600, color:P.abysse, marginBottom:'0.4rem' }}><span style={{ color:P.menthe, marginRight:'0.35rem' }}>02</span>Écart syllabus <span style={{ color:P.textm, fontWeight:400 }}>(facultatif)</span></div>
                  <textarea value={ecart} onChange={e=>setEcart(e.target.value)} placeholder="Ex : notion X reportée à la séance suivante…" style={{ width:'100%', border:`1px solid ${P.border}`, borderRadius:8, padding:'0.55rem', fontSize:12, resize:'vertical', minHeight:70, color:P.abysse, outline:'none', lineHeight:1.6 }}/>
                </div>
                <div style={card()}>
                  <div style={{ fontSize:12, fontWeight:600, color:P.abysse, marginBottom:'0.5rem' }}><span style={{ color:P.menthe, marginRight:'0.35rem' }}>03</span>Signal pédagogique</div>
                  <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap' }}>
                    {[{v:'bien',l:'✓ Bien assimilé',bg:'rgba(93,226,152,0.12)',fg:P.petrole,bd:P.borderm},{v:'consolider',l:'↻ À consolider',bg:P.amberbg,fg:'#7A4A00',bd:P.amber},{v:'reporte',l:'→ Reporté',bg:'rgba(19,69,71,0.06)',fg:P.textm,bd:P.border},{v:'alerte',l:'⚠ Alerte',bg:P.redbg,fg:'#8B1A1A',bd:P.red}].map(({v,l,bg,fg,bd})=>(
                      <button key={v} onClick={()=>setSignal(v)} style={{ background:signal===v?bg:'rgba(19,69,71,0.05)', color:signal===v?fg:P.textm, border:`1px solid ${signal===v?bd:P.border}`, borderRadius:8, padding:'5px 12px', fontSize:12, transition:'all 0.15s' }}>{l}</button>
                    ))}
                  </div>
                </div>
                <div style={card()}>
                  <div style={{ fontSize:12, fontWeight:600, color:P.abysse, marginBottom:'0.5rem' }}><span style={{ color:P.menthe, marginRight:'0.35rem' }}>04</span>Module terminé ?</div>
                  <div style={{ display:'flex', gap:'0.4rem' }}>
                    {[{v:false,l:'Non, il reste des séances'},{v:true,l:'Oui, module terminé'}].map(({v,l})=>(
                      <button key={String(v)} onClick={()=>setTermine(v)} style={{ background:termine===v?'rgba(93,226,152,0.12)':'rgba(19,69,71,0.05)', color:termine===v?P.petrole:P.textm, border:`1px solid ${termine===v?P.borderm:P.border}`, borderRadius:8, padding:'5px 12px', fontSize:12 }}>{l}</button>
                    ))}
                  </div>
                </div>
                <button onClick={async()=>{ await new Promise(r=>setTimeout(r,700)); setSent(true) }} style={{ width:'100%', background:P.petrole, color:P.givre, border:'none', borderRadius:10, padding:'12px', fontSize:14, fontWeight:500 }}>Envoyer la déclaration</button>
              </>
            )}
          </div>
        )}

        {onglet==='graphe'&&selF&&(
          <div className="fi">
            <h2 style={{ fontFamily:'var(--font-t)', fontWeight:400, color:P.abysse, marginTop:0, fontSize:22, marginBottom:'0.5rem' }}>Vue d'ensemble — {selF.formation?.titre}</h2>
            <p style={{ fontSize:12, color:P.textm, marginBottom:'1rem', lineHeight:1.6 }}>Lecture seule — votre position dans le parcours de compétences.</p>
            <GrapheCanvas blocs={selF.blocs||[]} alertes={[]} showAlerts={false}/>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VUE ÉTUDIANT — une seule formation
═══════════════════════════════════════════════════════════════ */
function VueEtudiant({ formId, formations, onBack }) {
  const f = formations.find(x=>x._id===formId) || formations[0]
  const allComps = f ? (f.blocs||[]).flatMap(b=>(b.competences||[]).map(c=>({...c,bloc_id:b.id,bloc_titre:b.titre,module:(b.modules||[])[0]?.titre||'',statut:null,retex:''}))) : []
  const [comps, setComps] = useState(allComps)
  const [saved, setSaved] = useState(false)

  const update = (id,field,val) => { setComps(p=>p.map(c=>c.id===id?{...c,[field]:val}:c)); setSaved(false) }
  const pct = allComps.length ? Math.round(comps.filter(c=>c.statut).length/allComps.length*100) : 0
  const sCol={acquis:P.menthe,voie:P.amber,nonacquis:P.red}
  const sBg={acquis:'rgba(93,226,152,0.12)',voie:P.amberbg,nonacquis:P.redbg}
  const sFg={acquis:P.petrole,voie:'#7A4A00',nonacquis:'#8B1A1A'}

  return (
    <div style={{ minHeight:'100vh', background:P.givre }}>
      <div style={{ height:52, background:P.surface, borderBottom:`1px solid ${P.border}`, padding:'0 1.25rem', display:'flex', alignItems:'center', gap:'0.75rem', position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 8px rgba(11,43,45,0.06)' }}>
        <button onClick={onBack} style={{ color:P.textm, fontSize:18, lineHeight:1, padding:'0 4px' }}>←</button>
        <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:P.abysse }}>Mon parcours</div><div style={{ fontSize:11, color:P.textm }}>{f?.formation?.titre||'—'}</div></div>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <span style={{ fontSize:11, color:P.textm }}>{pct}% renseigné</span>
          <div style={{ width:60, height:4, background:'rgba(19,69,71,0.10)', borderRadius:99, overflow:'hidden' }}><div style={{ width:`${pct}%`, height:'100%', background:P.menthe, borderRadius:99, transition:'width 0.4s' }}/></div>
        </div>
      </div>
      <div style={{ maxWidth:720, margin:'0 auto', padding:'1.5rem' }}>
        {!f&&<EmptyState icon="🎓" titre="Formation introuvable" message="Retourner à l'accueil et sélectionner votre formation."/>}
        {f&&allComps.length===0&&<EmptyState icon="📋" titre="Aucune compétence" message="Aucune compétence trouvée dans cette formation."/>}
        {f&&allComps.length>0&&(
          <>
            <div style={{ ...card({marginBottom:'1.25rem'}), background:'rgba(93,226,152,0.08)', border:`1px solid ${P.borderm}` }}>
              <div style={{ fontSize:12, fontWeight:600, color:P.petrole, marginBottom:'0.3rem' }}>Comment ça marche ?</div>
              <p style={{ fontSize:12, color:P.petrole, margin:0, lineHeight:1.6, opacity:0.8 }}>Pour chaque compétence, indique si tu l'as acquise. Ton retex est confidentiel — visible de ton tuteur uniquement.</p>
            </div>
            {(f.blocs||[]).map(b=>{
              const bC=comps.filter(c=>c.bloc_id===b.id); if(!bC.length) return null
              return (
                <div key={b.id} style={{ marginBottom:'1.5rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.75rem' }}><Tag label={b.id} small/><span style={{ fontSize:14, fontWeight:600, color:P.abysse }}>{b.titre}</span></div>
                  {bC.map(c=>(
                    <div key={c.id} style={card()}>
                      <div style={{ marginBottom:'0.6rem' }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:'0.5rem', marginBottom:'0.2rem' }}><Tag label={c.id} small/><span style={{ fontSize:13, color:P.abysse, lineHeight:1.4, fontWeight:500 }}>{c.libelle}</span></div>
                        {c.module&&<div style={{ fontSize:11, color:P.textm }}>Module : {c.module}</div>}
                      </div>
                      <div style={{ fontSize:11, fontWeight:600, color:P.textm, letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:'0.4rem' }}>Ton auto-évaluation</div>
                      <div style={{ display:'flex', gap:'0.35rem', marginBottom:'0.5rem', flexWrap:'wrap' }}>
                        {[{v:'acquis',l:'✓ Acquis'},{v:'voie',l:'↗ En voie'},{v:'nonacquis',l:'✗ Pas encore'}].map(({v,l})=>(
                          <button key={v} onClick={()=>update(c.id,'statut',c.statut===v?null:v)} style={{ background:c.statut===v?(sBg[v]||'rgba(19,69,71,0.06)'):'rgba(19,69,71,0.05)', color:c.statut===v?(sFg[v]||P.textm):P.textm, border:`1px solid ${c.statut===v?(sCol[v]||P.border):P.border}`, borderRadius:20, padding:'4px 12px', fontSize:12, transition:'all 0.15s' }}>{l}</button>
                        ))}
                      </div>
                      <textarea value={c.retex} onChange={e=>update(c.id,'retex',e.target.value)} placeholder="Commentaire libre — optionnel, confidentiel" style={{ width:'100%', border:`1px solid ${P.border}`, borderRadius:8, padding:'0.5rem', fontSize:12, resize:'vertical', minHeight:50, color:P.abysse, outline:'none', lineHeight:1.5, background:c.retex?P.surface:'rgba(227,255,240,0.3)' }}/>
                    </div>
                  ))}
                </div>
              )
            })}
            <button onClick={()=>setSaved(true)} style={{ width:'100%', background:P.petrole, color:P.givre, border:'none', borderRadius:10, padding:'12px', fontSize:14, fontWeight:500 }}>{saved?'✓ Enregistré':'Enregistrer mon auto-évaluation'}</button>
            {saved&&<p style={{ textAlign:'center', fontSize:12, color:P.petrole, marginTop:'0.6rem' }}>Ton retex est visible de ton tuteur / maître d'apprentissage.</p>}
          </>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [ctx, setCtx] = useState(null)
  const [formations, setFormations] = useState(() => {
    try { const s=localStorage.getItem(STORAGE_KEY); return s?JSON.parse(s):[] } catch { return [] }
  })

  if (!ctx) return <Landing onEnter={c=>setCtx(c)} formations={formations}/>

  const back = () => setCtx(null)
  const { role, campus, nom, formId, formations: fVisible } = ctx

  if (role==='dir')         return <VueDir        formations={formations} onFormationsChange={setFormations} onBack={back}/>
  if (role==='rp')          return <VueRP         campus={campus} formations={fVisible||formations} onBack={back}/>
  if (role==='intervenant') return <VueIntervenant nom={nom} formations={fVisible||formations} onBack={back}/>
  if (role==='etudiant')    return <VueEtudiant    formId={formId} formations={formations} onBack={back}/>
  return null
}
