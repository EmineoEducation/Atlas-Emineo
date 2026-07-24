import { useState, useEffect, useRef, useCallback } from 'react'
import { api, apiFetch, setToken, clearToken, getToken, ingererDocuments, genererFicheJ1 } from './api.js'

const P = {
  abysse:'#0B2B2D',petrole:'#134547',menthe:'#5DE298',givre:'#E3FFF0',eau:'#9DF0C4',saumon:'#E89B77',
  surface:'#FFFFFF',surface2:'#F5FDF8',border:'rgba(19,69,71,0.12)',borderm:'rgba(93,226,152,0.28)',
  textm:'#4A706E',textl:'rgba(11,43,45,0.40)',amber:'#EF9F27',amberbg:'#FFF8ED',red:'#E24B4A',redbg:'#FEF2F2',
}
const SCOL={nominal:'#5DE298',signal:'#9DF0C4',coordination:'#EF9F27',incoherence:'#E24B4A',vide:'#8EADA8'}
const SFIL={nominal:'rgba(93,226,152,0.12)',signal:'rgba(157,240,196,0.14)',coordination:'rgba(239,159,39,0.10)',incoherence:'rgba(226,75,74,0.08)',vide:'rgba(19,69,71,0.04)'}
const CAMPUS_LIST=['Le Mans','Paris','Nantes','Bordeaux','Rennes','Vannes','Poitiers','La Rochelle']

function Tag({label,color='blue',small}){
  const m={blue:{bg:'rgba(93,226,152,0.15)',fg:P.petrole},amber:{bg:P.amberbg,fg:'#7A4A00'},teal:{bg:'rgba(157,240,196,0.25)',fg:P.abysse},red:{bg:P.redbg,fg:'#8B1A1A'},gray:{bg:'rgba(19,69,71,0.07)',fg:P.textm}}
  const s=m[color]||m.gray
  return <span style={{background:s.bg,color:s.fg,fontSize:small?10:12,fontWeight:500,padding:small?'2px 7px':'3px 10px',borderRadius:20,display:'inline-block',lineHeight:1.6,whiteSpace:'nowrap'}}>{label}</span>
}
function Avatar({name,size=32}){
  const ini=(name||'?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()
  const cols=[['rgba(93,226,152,0.2)',P.petrole],['rgba(157,240,196,0.3)',P.abysse],['rgba(232,155,119,0.2)','#6B3A20']]
  const [bg,fg]=cols[(name||'').charCodeAt(0)%3]
  return <div style={{width:size,height:size,borderRadius:'50%',background:bg,color:fg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.35,fontWeight:600,flexShrink:0,border:`1px solid ${P.borderm}`}}>{ini}</div>
}
function Bar({pct,color='blue',h=4}){
  const f={blue:P.menthe,teal:P.eau,red:P.red,amber:P.amber}
  return <div style={{background:'rgba(19,69,71,0.10)',borderRadius:99,height:h,overflow:'hidden',width:'100%'}}><div style={{width:`${pct}%`,height:'100%',background:f[color]||P.menthe,borderRadius:99,transition:'width 0.6s ease'}}/></div>
}
function Spinner({size=20}){return <div style={{width:size,height:size,border:`2px solid ${P.borderm}`,borderTopColor:P.menthe,borderRadius:'50%',animation:'spin 0.7s linear infinite',flexShrink:0}}/>}
function card(x={}){return{background:P.surface,borderRadius:12,border:`1px solid ${P.border}`,padding:'1.25rem 1.4rem',marginBottom:'0.8rem',boxShadow:'0 1px 6px rgba(11,43,45,0.06)',...x}}
function Empty({icon,titre,msg,action,onClick}){
  return <div style={{padding:'4rem 2rem',textAlign:'center'}}><div style={{fontSize:40,opacity:0.35,marginBottom:'0.75rem'}}>{icon}</div><div style={{fontSize:15,fontWeight:600,color:P.petrole,marginBottom:'0.3rem'}}>{titre}</div><div style={{fontSize:13,color:P.textm,lineHeight:1.6,maxWidth:320,margin:'0 auto'}}>{msg}</div>{action&&<button onClick={onClick} style={{marginTop:'1.25rem',background:P.petrole,color:P.givre,border:'none',borderRadius:8,padding:'8px 20px',fontSize:13,cursor:'pointer'}}>{action}</button>}</div>
}

/* GRAPHE */
function GrapheCanvas({blocs,alertes,onClickBloc,showAlerts=true}){
  const cvRef=useRef(null)
  const [panel,setPanel]=useState(null)
  const blocsComp=(blocs||[]).filter(b=>(b.competences||[]).length>0)
  const nodes=blocsComp.map((b,i,arr)=>{
    const angle=(2*Math.PI*i/Math.max(arr.length,1))-Math.PI/2
    const r=arr.length<=3?0.28:0.30
    const ids=(b.modules||[]).map(m=>m.id)
    const h1=(alertes||[]).some(a=>a.niveau===1&&!(a._dismissed)&&(a.modules||[]).some(m=>ids.includes(m)))
    const h2=(alertes||[]).some(a=>a.niveau===2&&!(a._dismissed)&&(a.modules||[]).some(m=>ids.includes(m)))
    const h3=(alertes||[]).some(a=>a.niveau===3&&!(a._dismissed)&&(a.modules||[]).some(m=>ids.includes(m)))
    return{...b,x:0.5+r*Math.cos(angle),y:0.45+r*0.75*Math.sin(angle),status:h1?'incoherence':h2?'coordination':h3?'signal':'nominal',comp:(b.competences||[]).length,mc:(b.modules||[]).length}
  })
  const links=nodes.map((n,i)=>({a:n.id,b:nodes[(i+1)%nodes.length].id,w:2}))
  const draw=useCallback(()=>{
    const cv=cvRef.current;if(!cv)return
    const w=cv.width=cv.parentElement.clientWidth,h=cv.height=400
    const ctx=cv.getContext('2d');ctx.clearRect(0,0,w,h)
    links.forEach(l=>{
      const a=nodes.find(n=>n.id===l.a),b=nodes.find(n=>n.id===l.b);if(!a||!b)return
      ctx.beginPath();ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h)
      ctx.strokeStyle='rgba(19,69,71,0.10)';ctx.lineWidth=l.w;ctx.stroke()
    })
    nodes.forEach(n=>{
      const x=n.x*w,y=n.y*h,rc=18+n.comp*4
      if(n.status==='incoherence'){ctx.beginPath();ctx.arc(x,y,rc+7,0,Math.PI*2);ctx.strokeStyle='rgba(226,75,74,0.18)';ctx.lineWidth=5;ctx.stroke()}
      ctx.beginPath();ctx.arc(x,y,rc,0,Math.PI*2);ctx.fillStyle=SFIL[n.status]||SFIL.vide;ctx.fill()
      ctx.strokeStyle=SCOL[n.status]||SCOL.vide;ctx.lineWidth=showAlerts?2:1.5;ctx.stroke()
      ctx.fillStyle=P.abysse;ctx.textAlign='center';ctx.textBaseline='middle'
      const fs=Math.max(9,rc*0.22);ctx.font=`600 ${fs}px Inter,system-ui`
      ctx.fillText(n.id,x,y-4)
      ctx.font=`400 ${Math.max(8,fs*0.85)}px Inter,system-ui`;ctx.fillStyle=P.textm
      const short=n.titre?n.titre.split(' ').slice(0,2).join(' '):'';ctx.fillText(short,x,y+8)
    })
  },[nodes,links,showAlerts])
  useEffect(()=>{draw();window.addEventListener('resize',draw);return()=>window.removeEventListener('resize',draw)},[draw])
  function getHit(e){
    const cv=cvRef.current;if(!cv)return null
    const rect=cv.getBoundingClientRect()
    const mx=(e.clientX-rect.left)*(cv.width/rect.width),my=(e.clientY-rect.top)*(cv.height/rect.height)
    return nodes.find(n=>{const dx=mx-n.x*cv.width,dy=my-n.y*cv.height;return Math.sqrt(dx*dx+dy*dy)<=18+n.comp*4})
  }
  return(
    <div style={{position:'relative',borderRadius:12,border:`1px solid ${P.border}`,overflow:'hidden',background:'rgba(227,255,240,0.3)'}}>
      <canvas ref={cvRef} style={{display:'block',cursor:'default'}}
        onMouseMove={e=>{const n=getHit(e);e.currentTarget.style.cursor=n?'pointer':'default'}}
        onClick={e=>{const n=getHit(e);if(!n){setPanel(null);return}if(onClickBloc&&n.status==='incoherence'){onClickBloc(n);return}setPanel(prev=>prev?.id===n.id?null:n)}}
      />
      {panel&&(
        <div style={{position:'absolute',right:0,top:0,width:220,height:'100%',background:'rgba(255,255,255,0.97)',borderLeft:`1px solid ${P.border}`,padding:'0.9rem',overflowY:'auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.5rem'}}>
            <span style={{fontWeight:600,fontSize:13,color:P.abysse}}>{panel.id} — {panel.titre}</span>
            <button onClick={()=>setPanel(null)} style={{color:P.textm,fontSize:16}}>×</button>
          </div>
          <div style={{fontSize:11,color:P.textm,marginBottom:'0.5rem'}}>{panel.comp}C · {panel.mc}M</div>
          {(panel.competences||[]).map(c=><div key={c.id} style={{fontSize:11,padding:'3px 0',borderBottom:`1px solid ${P.border}`,color:P.abysse}}>{c.id} — {c.libelle}</div>)}
        </div>
      )}
      <div style={{position:'absolute',bottom:8,left:10,fontSize:10,color:P.textl}}>Clic = détail · Rouge = incohérence</div>
    </div>
  )
}

/* TOPBAR */
function Topbar({user,formationTitre,onLogout,onglet,setOnglet,onglets}){
  return(
    <div style={{height:52,background:P.surface,borderBottom:`1px solid ${P.border}`,padding:'0 1.25rem',display:'flex',alignItems:'center',gap:'0.75rem',position:'sticky',top:0,zIndex:100,boxShadow:'0 1px 8px rgba(11,43,45,0.06)'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,paddingRight:10,borderRight:`1px solid ${P.border}`}}>
        <div style={{width:24,height:24,borderRadius:'50%',background:P.petrole,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{color:P.menthe,fontSize:11,fontWeight:700,fontFamily:'Georgia,serif',fontStyle:'italic'}}>e</span>
        </div>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:600,color:P.abysse,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{formationTitre||'Atlas des compétences'}</div>
        <div style={{fontSize:10,color:P.textm}}>{user.prenom} {user.nom}</div>
      </div>
      <div style={{display:'flex',gap:'0.3rem'}}>
        {onglets.map(t=><button key={t.id} onClick={()=>setOnglet(t.id)} style={{padding:'4px 11px',borderRadius:6,fontSize:12,fontWeight:500,cursor:'pointer',border:`1px solid ${onglet===t.id?P.borderm:'transparent'}`,background:onglet===t.id?'rgba(93,226,152,0.12)':'transparent',color:onglet===t.id?P.petrole:P.textm}}>{t.label}</button>)}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:'0.5rem',paddingLeft:10,borderLeft:`1px solid ${P.border}`}}>
        <Avatar name={`${user.prenom} ${user.nom}`} size={24}/>
        <button onClick={onLogout} title="Déconnexion" style={{color:P.textm,fontSize:14,cursor:'pointer'}}>⏻</button>
      </div>
    </div>
  )
}

/* LOGIN */
function LoginPage({onLogin}){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  async function handleSubmit(){
    setLoading(true);setError('')
    try{const d=await api.login(email,password);setToken(d.token);onLogin(d.user)}
    catch(e){setError(e.message)}finally{setLoading(false)}
  }
  return(
    <div style={{minHeight:'100vh',background:`linear-gradient(135deg,${P.abysse} 0%,${P.petrole} 100%)`,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
      <div style={{background:'rgba(227,255,240,0.06)',border:'1px solid rgba(93,226,152,0.18)',borderRadius:20,padding:'2.5rem',width:'100%',maxWidth:400,backdropFilter:'blur(8px)'}}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <div style={{width:48,height:48,borderRadius:'50%',background:'rgba(93,226,152,0.15)',border:`1px solid ${P.borderm}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1rem'}}>
            <span style={{color:P.menthe,fontSize:20,fontFamily:'Georgia,serif',fontStyle:'italic',fontWeight:700}}>e</span>
          </div>
          <h1 style={{fontFamily:'Georgia,serif',color:'#fff',fontSize:22,fontWeight:400,margin:0}}>Atlas des compétences</h1>
          <p style={{color:'rgba(227,255,240,0.45)',fontSize:12,marginTop:'0.3rem'}}>Éminéo · Coordination pédagogique</p>
        </div>
        <div style={{marginBottom:'0.75rem'}}>
          <label style={{fontSize:10,fontWeight:600,color:'rgba(227,255,240,0.5)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:'0.3rem'}}>Identifiant</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="prenom.nom@emineo-education.fr" style={{width:'100%',background:'rgba(227,255,240,0.07)',border:'1px solid rgba(93,226,152,0.2)',borderRadius:8,padding:'0.65rem 0.85rem',fontSize:13,color:'#fff',outline:'none',boxSizing:'border-box'}}/>
        </div>
        <div style={{marginBottom:'1.25rem'}}>
          <label style={{fontSize:10,fontWeight:600,color:'rgba(227,255,240,0.5)',textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:'0.3rem'}}>Mot de passe</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} style={{width:'100%',background:'rgba(227,255,240,0.07)',border:'1px solid rgba(93,226,152,0.2)',borderRadius:8,padding:'0.65rem 0.85rem',fontSize:13,color:'#fff',outline:'none',boxSizing:'border-box'}}/>
        </div>
        {error&&<div style={{marginBottom:'1rem',padding:'0.6rem 0.8rem',background:'rgba(226,75,74,0.15)',border:'1px solid rgba(226,75,74,0.3)',borderRadius:8,fontSize:12,color:'#FFB8B8'}}>{error}</div>}
        <button onClick={handleSubmit} disabled={loading||!email||!password}
          style={{width:'100%',padding:'0.85rem',borderRadius:10,fontSize:14,fontWeight:500,border:'none',cursor:(!loading&&email&&password)?'pointer':'not-allowed',
            background:(!loading&&email&&password)?`linear-gradient(135deg,${P.petrole},${P.menthe})`:'rgba(93,226,152,0.08)',color:(!loading&&email&&password)?P.abysse:'rgba(227,255,240,0.25)',
            boxShadow:(!loading&&email&&password)?'0 4px 20px rgba(93,226,152,0.22)':'none',transition:'all 0.2s'}}>
          {loading?<span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem'}}><Spinner size={16}/>Connexion…</span>:'Se connecter'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   IMPORT CSV — deux modes : étudiants / intervenants
   Format CRM Éminéo : CSV séparateur ";" UTF-8 BOM
   Étudiants  : Nom;Prénom;Email école
   Intervenants : Nom;Prénom;Matières;Email école
     → pour les intervenants : Claude apparie les matières CRM aux modules Atlas
═══════════════════════════════════════════════════════════════════════════ */

function genPassword(){
  const chars='abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({length:8},()=>chars[Math.floor(Math.random()*chars.length)]).join('')
}

// Parser CSV séparateur ";" — gère les champs entre guillemets et le BOM UTF-8
function parseCSV(text){
  const lines=text.replace(/^\uFEFF/,'').split('\n').map(l=>l.trim()).filter(Boolean)
  if(!lines.length)return[]
  function splitLine(line){
    const cols=[];let cur='',inQ=false
    for(let i=0;i<line.length;i++){
      const c=line[i]
      if(c==='"'&&!inQ){inQ=true}
      else if(c==='"'&&inQ&&line[i+1]==='"'){cur+='"';i++}
      else if(c==='"'&&inQ){inQ=false}
      else if(c===';'&&!inQ){cols.push(cur.trim());cur=''}
      else cur+=c
    }
    cols.push(cur.trim())
    return cols
  }
  const headers=splitLine(lines[0]).map(h=>h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'_'))
  return lines.slice(1).map(l=>{
    const cols=splitLine(l)
    const obj={}
    headers.forEach((h,i)=>{obj[h]=cols[i]||''})
    return obj
  })
}

function ResultTable({rows,onReset}){
  const ok=rows.filter(r=>r.status==='ok')
  const err=rows.filter(r=>r.status==='err')
  return(
    <div>
      <div style={{padding:'0.75rem 1rem',background:'rgba(93,226,152,0.1)',border:`1px solid ${P.borderm}`,borderRadius:8,fontSize:13,color:P.petrole,marginBottom:'0.75rem',fontWeight:500}}>
        ✓ {ok.length} compte{ok.length>1?'s':''} créé{ok.length>1?'s':''}
        {err.length>0&&<span style={{color:P.red}}> · {err.length} erreur{err.length>1?'s':''}</span>}
      </div>
      <div style={{padding:'0.65rem 0.9rem',background:P.amberbg,border:`1px solid ${P.amber}`,borderRadius:8,fontSize:12,color:'#7A4A00',marginBottom:'1rem',lineHeight:1.6}}>
        ⚠ Conservez impérativement cette liste — les mots de passe ne seront plus affichés.
      </div>
      <div style={{overflowX:'auto',border:`1px solid ${P.border}`,borderRadius:8,marginBottom:'0.75rem'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead><tr style={{background:P.surface2}}>{['Prénom','Nom','Email','Mot de passe','Ok'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left',fontWeight:600,color:P.textm,borderBottom:`1px solid ${P.border}`}}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r,i)=><tr key={i} style={{background:r.status==='err'?P.redbg:'transparent'}}>
            <td style={{padding:'5px 8px',borderBottom:`1px solid ${P.border}`,color:P.abysse}}>{r.prenom}</td>
            <td style={{padding:'5px 8px',borderBottom:`1px solid ${P.border}`,color:P.abysse}}>{r.nom}</td>
            <td style={{padding:'5px 8px',borderBottom:`1px solid ${P.border}`,color:P.abysse,fontSize:11}}>{r.email}</td>
            <td style={{padding:'5px 8px',borderBottom:`1px solid ${P.border}`,fontFamily:'monospace',fontWeight:600,color:r.status==='ok'?P.petrole:P.red}}>{r.status==='ok'?r.mdp:r.msg}</td>
            <td style={{padding:'5px 8px',borderBottom:`1px solid ${P.border}`,textAlign:'center'}}>{r.status==='ok'?'✓':'✗'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <button onClick={onReset} style={{border:`1px solid ${P.border}`,color:P.textm,borderRadius:6,padding:'5px 14px',fontSize:12,background:P.surface,cursor:'pointer'}}>Nouvel import</button>
    </div>
  )
}

/* ── Import étudiants ─────────────────────────────────────────────────────── */
function ImportEtudiants({campus,formationId,onDone}){
  const [rows,setRows]=useState([])
  const [importing,setImporting]=useState(false)
  const [done,setDone]=useState(false)
  const [err,setErr]=useState('')

  function parseFile(file){
    setErr('');setRows([]);setDone(false)
    const r=new FileReader()
    r.onload=e=>{
      try{
        const parsed=parseCSV(e.target.result)
        if(!parsed.length){setErr('Fichier vide.');return}
        // Colonnes CRM : nom / prenom / email_ecole (ou email)
        const rows=parsed.map(p=>({
          nom:(p.nom||'').toUpperCase(),
          prenom:p.prenom||p['pr_nom']||'',
          email:p.email_ecole||p.email||p.mail||'',
          mdp:genPassword(),status:'pending',msg:''
        })).filter(r=>r.nom&&r.email)
        if(!rows.length){setErr('Aucune ligne valide (nom + email requis).');return}
        setRows(rows)
      }catch(e){setErr('Erreur : '+e.message)}
    }
    r.readAsText(file,'utf-8')
  }

  async function handleImport(){
    setImporting(true)
    const updated=[...rows]
    for(let i=0;i<updated.length;i++){
      try{
        await api.createUser({nom:updated[i].nom,prenom:updated[i].prenom,email:updated[i].email,role:'etudiant',campus:campus||'',password:updated[i].mdp,formation_id:formationId||undefined})
        updated[i]={...updated[i],status:'ok'}
      }catch(e){updated[i]={...updated[i],status:'err',msg:e.message}}
      setRows([...updated])
    }
    setImporting(false);setDone(true)
    if(onDone)onDone()
  }

  if(done)return <ResultTable rows={rows} onReset={()=>{setRows([]);setDone(false)}}/>
  return(
    <div>
      <p style={{fontSize:12,color:P.textm,marginBottom:'0.75rem',lineHeight:1.7}}>
        Export CRM → fichier <strong>.csv</strong> avec colonnes : <strong>Nom · Prénom · Email école</strong>
      </p>
      <div onClick={()=>document.getElementById('csv-etu').click()}
        style={{border:`2px dashed ${P.borderm}`,borderRadius:12,padding:'1.75rem',textAlign:'center',cursor:'pointer',background:'rgba(93,226,152,0.03)',marginBottom:'0.75rem'}}>
        <input id="csv-etu" type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}} onChange={e=>e.target.files[0]&&parseFile(e.target.files[0])}/>
        <div style={{fontSize:22,opacity:0.4,marginBottom:'0.35rem'}}>🎓</div>
        <div style={{fontSize:13,fontWeight:500,color:P.petrole}}>Fichier étudiants (.csv)</div>
      </div>
      {err&&<div style={{padding:'0.6rem 0.8rem',background:P.redbg,border:`1px solid ${P.red}`,borderRadius:8,fontSize:12,color:'#8B1A1A',marginBottom:'0.75rem'}}>{err}</div>}
      {rows.length>0&&<>
        <div style={{fontSize:12,color:P.textm,marginBottom:'0.5rem'}}>{rows.length} étudiant{rows.length>1?'s':''} détecté{rows.length>1?'s':''}</div>
        <div style={{maxHeight:160,overflowY:'auto',marginBottom:'0.75rem',border:`1px solid ${P.border}`,borderRadius:8}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:P.surface2}}>{['Prénom','Nom','Email'].map(h=><th key={h} style={{padding:'5px 8px',textAlign:'left',fontWeight:600,color:P.textm,borderBottom:`1px solid ${P.border}`}}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r,i)=><tr key={i}><td style={{padding:'4px 8px',color:P.abysse}}>{r.prenom}</td><td style={{padding:'4px 8px',color:P.abysse}}>{r.nom}</td><td style={{padding:'4px 8px',color:P.abysse,fontSize:11}}>{r.email}</td></tr>)}</tbody>
          </table>
        </div>
        <button onClick={handleImport} disabled={importing}
          style={{width:'100%',padding:'0.75rem',borderRadius:10,fontSize:13,fontWeight:600,border:'none',cursor:importing?'not-allowed':'pointer',background:importing?'rgba(19,69,71,0.08)':`linear-gradient(135deg,${P.petrole},${P.menthe})`,color:importing?P.textm:P.abysse}}>
          {importing?<span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem'}}><Spinner size={14}/>Création…</span>:`Créer ${rows.length} compte${rows.length>1?'s':''} étudiant${rows.length>1?'s':''} →`}
        </button>
      </>}
    </div>
  )
}

/* ── Import intervenants + appariement Claude ─────────────────────────────── */
function ImportIntervenants({campus,formation,onDone}){
  const [rows,setRows]=useState([])       // [{nom,prenom,email,matieres[],modules_appareis[],mdp,status,msg}]
  const [appLoading,setAppLoading]=useState(false)
  const [appDone,setAppDone]=useState(false)
  const [importing,setImporting]=useState(false)
  const [done,setDone]=useState(false)
  const [err,setErr]=useState('')

  // Tous les modules de la formation pour l'appariement
  const allModules=formation?(formation.blocs||[]).flatMap(b=>(b.modules||[]).map(m=>({id:m.id,titre:m.titre,bloc:b.id}))):[  ]

  function parseFile(file){
    setErr('');setRows([]);setAppDone(false);setDone(false)
    const r=new FileReader()
    r.onload=e=>{
      try{
        const parsed=parseCSV(e.target.result)
        if(!parsed.length){setErr('Fichier vide.');return}
        // Colonnes CRM intervenants : Nom;Prénom;Matières;Email école
        // Après parsing CSV, clés normalisées : nom / prenom / mati_res / email__cole
        const rows=parsed.map(p=>{
          // Récupérer la clé matières (peut varier selon normalisation)
          const matiereRaw=p.mati_res||p.matieres||p['mati_res']||p['matire']||''
          const matieres=matiereRaw.split(',').map(m=>m.trim()).filter(Boolean)
          const email=p.email__cole||p.email_ecole||p.email||p.mail||''
          return{
            nom:(p.nom||'').toUpperCase(),
            prenom:p.prenom||'',
            email,
            matieres,
            modules_appareis:[],
            mdp:genPassword(),
            status:'pending',msg:''
          }
        }).filter(r=>r.nom&&r.email)
        if(!rows.length){setErr('Aucune ligne valide.');return}
        setRows(rows)
      }catch(e){setErr('Erreur : '+e.message)}
    }
    r.readAsText(file,'utf-8')
  }

  // Appariement sémantique via Claude (passe par /api/ingest mode prompt)
  async function apparier(){
    if(!allModules.length){setErr('Aucune formation sélectionnée — impossible d\'apparier les modules.');return}
    setAppLoading(true);setErr('')
    try{
      const modulesStr=allModules.map(m=>`${m.id}|${m.titre} (${m.bloc})`).join('\n')
      const intervenantsStr=rows.map((r,i)=>`[${i}] ${r.prenom} ${r.nom} — matières CRM : ${r.matieres.join(' / ')}`).join('\n')
      const prompt=
        'Tu es expert en ingénierie pédagogique. Apparie chaque intervenant à ses modules dans la formation.\n\n'+
        'MODULES DE LA FORMATION (id|titre):\n'+modulesStr+'\n\n'+
        'INTERVENANTS ET LEURS MATIÈRES (issues du CRM, libellés approximatifs):\n'+intervenantsStr+'\n\n'+
        'RÈGLES:\n'+
        '- Fais une correspondance sémantique entre les libellés CRM et les titres de modules\n'+
        '- Un intervenant peut être affecté à plusieurs modules\n'+
        '- Si aucun module ne correspond, retourne un tableau vide\n'+
        '- Retourne UNIQUEMENT ce JSON, sans texte ni backtick:\n'+
        '{"affectations":[{"index":0,"modules":["M1","M3"]},{"index":1,"modules":["M2"]}]}'
      const result=await apiFetch('/api/ingest',{method:'POST',body:{prompt}})
      const text=result.text||''
      let parsed
      try{
        const clean=text.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim()
        const first=clean.indexOf('{'),last=clean.lastIndexOf('}')
        parsed=JSON.parse(first>=0?clean.slice(first,last+1):clean)
      }catch{setErr('Claude n\'a pas retourné un JSON valide. Réessayez.');setAppLoading(false);return}
      const updated=rows.map((r,i)=>{
        const aff=(parsed.affectations||[]).find(a=>a.index===i)
        return{...r,modules_appareis:aff?aff.modules:[]}
      })
      setRows(updated);setAppDone(true)
    }catch(e){setErr('Erreur appariement : '+(e&&e.message?e.message:String(e)))}
    finally{setAppLoading(false)}
  }

  async function handleImport(){
    setImporting(true)
    const updated=[...rows]
    for(let i=0;i<updated.length;i++){
      try{
        await api.createUser({nom:updated[i].nom,prenom:updated[i].prenom,email:updated[i].email,role:'intervenant',campus:campus||'',password:updated[i].mdp,formation_id:(formation&&formation._id)||undefined})
        updated[i]={...updated[i],status:'ok'}
      }catch(e){updated[i]={...updated[i],status:'err',msg:e.message}}
      setRows([...updated])
    }
    // Mettre à jour les modules avec le nom des intervenants
    if(formation&&updated.some(r=>r.status==='ok'&&r.modules_appareis.length)){
      try{
        const updatedFormation=JSON.parse(JSON.stringify(formation))
        updated.filter(r=>r.status==='ok').forEach(r=>{
          r.modules_appareis.forEach(mid=>{
            updatedFormation.blocs.forEach(b=>{
              b.modules=(b.modules||[]).map(m=>m.id===mid?{...m,intervenant:`${r.prenom} ${r.nom}`}:m)
            })
          })
        })
        await api.updateFormation(formation._id,{data:updatedFormation})
      }catch(e){console.warn('Mise à jour modules intervenants échouée:',e.message)}
    }
    setImporting(false);setDone(true)
    if(onDone)onDone()
  }

  if(done)return <ResultTable rows={rows} onReset={()=>{setRows([]);setDone(false);setAppDone(false)}}/>
  return(
    <div>
      <p style={{fontSize:12,color:P.textm,marginBottom:'0.75rem',lineHeight:1.7}}>
        Export CRM → fichier <strong>.csv</strong> avec colonnes : <strong>Nom · Prénom · Matières · Email école</strong><br/>
        Claude apparie automatiquement les matières aux modules de la formation.
      </p>
      {!formation&&<div style={{padding:'0.6rem 0.8rem',background:P.amberbg,border:`1px solid ${P.amber}`,borderRadius:8,fontSize:12,color:'#7A4A00',marginBottom:'0.75rem'}}>⚠ Sélectionnez d'abord une formation dans l'onglet "Mes formations" pour activer l'appariement.</div>}
      <div onClick={()=>document.getElementById('csv-int').click()}
        style={{border:`2px dashed ${P.borderm}`,borderRadius:12,padding:'1.75rem',textAlign:'center',cursor:'pointer',background:'rgba(93,226,152,0.03)',marginBottom:'0.75rem'}}>
        <input id="csv-int" type="file" accept=".csv,.xlsx,.xls" style={{display:'none'}} onChange={e=>e.target.files[0]&&parseFile(e.target.files[0])}/>
        <div style={{fontSize:22,opacity:0.4,marginBottom:'0.35rem'}}>👨‍🏫</div>
        <div style={{fontSize:13,fontWeight:500,color:P.petrole}}>Fichier intervenants (.csv)</div>
      </div>
      {err&&<div style={{padding:'0.6rem 0.8rem',background:P.redbg,border:`1px solid ${P.red}`,borderRadius:8,fontSize:12,color:'#8B1A1A',marginBottom:'0.75rem'}}>{err}</div>}

      {rows.length>0&&(
        <>
          <div style={{fontSize:12,color:P.textm,marginBottom:'0.5rem'}}>{rows.length} intervenant{rows.length>1?'s':''} détecté{rows.length>1?'s':''}</div>
          <div style={{maxHeight:200,overflowY:'auto',marginBottom:'0.75rem',border:`1px solid ${P.border}`,borderRadius:8}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:P.surface2}}>
                {['Prénom','Nom','Matières CRM',appDone?'Modules Atlas':''].filter(Boolean).map(h=><th key={h} style={{padding:'5px 8px',textAlign:'left',fontWeight:600,color:P.textm,borderBottom:`1px solid ${P.border}`}}>{h}</th>)}
              </tr></thead>
              <tbody>{rows.map((r,i)=><tr key={i}>
                <td style={{padding:'4px 8px',color:P.abysse,verticalAlign:'top'}}>{r.prenom}</td>
                <td style={{padding:'4px 8px',color:P.abysse,verticalAlign:'top'}}>{r.nom}</td>
                <td style={{padding:'4px 8px',color:P.textm,fontSize:11,verticalAlign:'top',maxWidth:200}}>
                  <div style={{display:'flex',flexWrap:'wrap',gap:2}}>{r.matieres.slice(0,3).map((m,j)=><span key={j} style={{background:'rgba(19,69,71,0.07)',borderRadius:4,padding:'1px 5px',fontSize:10}}>{m}</span>)}{r.matieres.length>3&&<span style={{fontSize:10,color:P.textl}}>+{r.matieres.length-3}</span>}</div>
                </td>
                {appDone&&<td style={{padding:'4px 8px',verticalAlign:'top'}}>
                  {r.modules_appareis.length>0
                    ?<div style={{display:'flex',flexWrap:'wrap',gap:2}}>{r.modules_appareis.map(m=><span key={m} style={{background:'rgba(93,226,152,0.15)',color:P.petrole,borderRadius:4,padding:'1px 6px',fontSize:10,fontWeight:600}}>{m}</span>)}</div>
                    :<span style={{fontSize:10,color:P.textl,fontStyle:'italic'}}>Non apparié</span>}
                </td>}
              </tr>)}</tbody>
            </table>
          </div>

          {!appDone&&(
            <button onClick={apparier} disabled={appLoading||!formation}
              style={{width:'100%',padding:'0.75rem',borderRadius:10,fontSize:13,fontWeight:600,border:`1px solid ${P.borderm}`,cursor:(!appLoading&&formation)?'pointer':'not-allowed',background:(!appLoading&&formation)?'rgba(93,226,152,0.1)':'rgba(19,69,71,0.05)',color:(!appLoading&&formation)?P.petrole:P.textm,marginBottom:'0.5rem'}}>
              {appLoading?<span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem'}}><Spinner size={14}/>Claude apparie les modules…</span>:'✦ Apparier les modules avec Claude →'}
            </button>
          )}

          {appDone&&(
            <button onClick={handleImport} disabled={importing}
              style={{width:'100%',padding:'0.75rem',borderRadius:10,fontSize:13,fontWeight:600,border:'none',cursor:importing?'not-allowed':'pointer',background:importing?'rgba(19,69,71,0.08)':`linear-gradient(135deg,${P.petrole},${P.menthe})`,color:importing?P.textm:P.abysse}}>
              {importing?<span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem'}}><Spinner size={14}/>Création des comptes…</span>:`Créer ${rows.length} compte${rows.length>1?'s':''} intervenant${rows.length>1?'s':''} →`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/* ── ImportCSV : conteneur avec sélecteur de titre + onglets Étudiants / Intervenants ─ */
function ImportCSV({campus,formations,formation:formationProp,onDone}){
  const [tab,setTab]=useState('etudiants')
  // Liste des titres disponibles (déjà filtrée au campus du RP par l'appelant)
  const titres=formations||(formationProp?[formationProp]:[])
  const [selId,setSelId]=useState(()=>{
    if(formationProp&&formationProp._id) return formationProp._id
    return titres[0]?._id||null
  })
  const formation=titres.find(t=>t._id===selId)||formationProp||null

  return(
    <div>
      {/* Bandeau de contexte — lève toute ambiguïté : où vont les comptes importés */}
      <div style={{display:'flex',alignItems:'center',gap:'0.75rem',flexWrap:'wrap',padding:'0.7rem 0.9rem',background:'rgba(93,226,152,0.08)',border:`1px solid ${P.borderm}`,borderRadius:10,marginBottom:'1.25rem'}}>
        <span style={{fontSize:12,fontWeight:600,color:P.petrole}}>Vous importez vers</span>
        {titres.length>1?(
          <select value={selId||''} onChange={e=>setSelId(Number(e.target.value))}
            style={{border:`1px solid ${P.border}`,borderRadius:7,padding:'5px 10px',fontSize:13,fontWeight:600,color:P.abysse,background:P.surface,outline:'none'}}>
            {titres.map(t=><option key={t._id} value={t._id}>{t.formation?.titre||`Formation ${t._id}`}</option>)}
          </select>
        ):(
          <span style={{fontSize:13,fontWeight:600,color:P.abysse}}>{formation?.formation?.titre||'— aucun titre —'}</span>
        )}
        {campus&&<span style={{fontSize:12,color:P.textm}}>· campus <strong style={{color:P.abysse}}>{campus}</strong></span>}
      </div>

      {!formation&&(
        <div style={{padding:'0.6rem 0.8rem',background:P.amberbg,border:`1px solid ${P.amber}`,borderRadius:8,fontSize:12,color:'#7A4A00',marginBottom:'0.75rem'}}>⚠ Aucun titre disponible sur ce campus. Contactez la Direction des programmes.</div>
      )}

      <div style={{display:'flex',gap:'0.4rem',marginBottom:'1.25rem'}}>
        {[{id:'etudiants',l:'🎓 Étudiants'},{id:'intervenants',l:'👨‍🏫 Intervenants'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'6px 16px',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer',
              border:`1px solid ${tab===t.id?P.borderm:P.border}`,
              background:tab===t.id?P.petrole:P.surface,
              color:tab===t.id?P.menthe:P.textm}}>
            {t.l}
          </button>
        ))}
      </div>
      {tab==='etudiants'&&<ImportEtudiants campus={campus} formationId={formation?._id} onDone={onDone}/>}
      {tab==='intervenants'&&<ImportIntervenants campus={campus} formation={formation} onDone={onDone}/>}
    </div>
  )
}

/* ═══ GESTION COMPTES — Dir péda (formulaire manuel) ═══════════════════════ */
function UserManagement(){
  const [users,setUsers]=useState([])
  const [loading,setLoading]=useState(true)
  const [form,setForm]=useState({role:'rp',nom:'',prenom:'',email:'',password:'',campus:''})
  const [msg,setMsg]=useState('')
  const [err,setErr]=useState('')
  const [tab,setTab]=useState('manuel')

  useEffect(()=>{api.getUsers().then(d=>{setUsers(d.users);setLoading(false)}).catch(()=>setLoading(false))},[])

  async function handleCreate(){
    setErr('');setMsg('')
    try{
      const data=await api.createUser(form)
      setMsg(`Compte créé : ${data.email}`)
      setForm({role:'rp',nom:'',prenom:'',email:'',password:'',campus:''})
      const d=await api.getUsers();setUsers(d.users)
    }catch(e){setErr(e.message)}
  }

  async function handleDelete(id,nom){
    if(!confirm(`Supprimer le compte de ${nom} ?`))return
    try{await api.deleteUser(id);const d=await api.getUsers();setUsers(d.users)}
    catch(e){setErr(e.message)}
  }

  return(
    <div className="fi">
      <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>Gestion des comptes RP</h2>
      <div style={{display:'flex',gap:'0.4rem',marginBottom:'1.25rem'}}>
        {[{id:'manuel',l:'Création manuelle'},{id:'excel',l:'Import Excel'}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'5px 14px',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer',border:`1px solid ${tab===t.id?P.borderm:P.border}`,background:tab===t.id?'rgba(93,226,152,0.12)':P.surface,color:tab===t.id?P.petrole:P.textm}}>{t.l}</button>)}
      </div>

      {tab==='manuel'&&(
        <div style={card({marginBottom:'1.5rem'})}>
          <div style={{fontSize:13,fontWeight:600,color:P.abysse,marginBottom:'0.75rem'}}>Nouveau compte RP</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:'0.5rem'}}>
            <div><label style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.06em'}}>Campus</label>
            <input value={form.campus} onChange={e=>setForm({...form,campus:e.target.value})} placeholder="Bordeaux" style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:6,padding:'0.45rem',fontSize:13,color:P.abysse,outline:'none'}}/></div>
            <div><label style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.06em'}}>Email</label>
            <input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:6,padding:'0.45rem',fontSize:13,color:P.abysse,outline:'none'}}/></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:'0.5rem'}}>
            <div><label style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.06em'}}>Nom</label><input value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:6,padding:'0.45rem',fontSize:13,color:P.abysse,outline:'none'}}/></div>
            <div><label style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.06em'}}>Prénom</label><input value={form.prenom} onChange={e=>setForm({...form,prenom:e.target.value})} style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:6,padding:'0.45rem',fontSize:13,color:P.abysse,outline:'none'}}/></div>
          </div>
          <div style={{marginBottom:'0.75rem'}}>
            <label style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.06em'}}>Mot de passe</label>
            <input value={form.password} onChange={e=>setForm({...form,password:e.target.value})} style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:6,padding:'0.45rem',fontSize:13,color:P.abysse,outline:'none'}}/>
          </div>
          <button onClick={handleCreate} disabled={!form.nom||!form.password} style={{background:P.petrole,color:P.givre,border:'none',borderRadius:8,padding:'8px 20px',fontSize:13,fontWeight:500,cursor:(form.nom&&form.password)?'pointer':'not-allowed',opacity:(form.nom&&form.password)?1:0.5}}>Créer le compte</button>
          {msg&&<div style={{marginTop:'0.5rem',fontSize:12,color:P.petrole}}>{msg}</div>}
          {err&&<div style={{marginTop:'0.5rem',fontSize:12,color:P.red}}>{err}</div>}
        </div>
      )}

      {tab==='excel'&&(
        <div style={card({marginBottom:'1.5rem'})}>
          <ImportCSV campus="" formations={[]} formation={null} onDone={()=>{api.getUsers().then(d=>setUsers(d.users)).catch(()=>{})}}/>
        </div>
      )}

      {loading?<div style={{textAlign:'center',padding:'2rem'}}><Spinner/></div>:
        users.map(u=>(
          <div key={u.id} style={{...card({display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.75rem 1rem'})}}>
            <div style={{display:'flex',alignItems:'center',gap:'0.6rem'}}>
              <Avatar name={`${u.prenom} ${u.nom}`} size={28}/>
              <div>
                <div style={{fontSize:13,fontWeight:500,color:P.abysse}}>{u.prenom} {u.nom}</div>
                <div style={{fontSize:11,color:P.textm}}>{u.email}{u.campus?` · ${u.campus}`:''}</div>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
              <Tag label={u.role} small/>
              {u.role!=='dir'&&<button onClick={()=>handleDelete(u.id,u.nom)} style={{fontSize:11,color:P.red,border:`1px solid ${P.red}`,borderRadius:6,padding:'2px 8px',background:P.redbg,cursor:'pointer'}}>×</button>}
            </div>
          </div>
        ))
      }
    </div>
  )
}

/* ═══ ÉDITEUR CAMPUS (inline sur une carte formation) ══════════════════════ */
function CampusEditor({formation,onSave}){
  const [sel,setSel]=useState(()=>{
    const c=formation._campus||''
    try{const p=JSON.parse(c);return Array.isArray(p)?p:[c].filter(Boolean)}
    catch{return c?c.split(',').map(x=>x.trim()).filter(Boolean):[]}
  })
  const [saving,setSaving]=useState(false)
  async function save(){
    setSaving(true)
    try{await api.updateFormation(formation._id,{campus:sel})}
    catch(e){alert('Erreur : '+e.message)}
    finally{setSaving(false)}
    if(onSave)onSave(sel)
  }
  return(
    <div style={{marginTop:'0.6rem',paddingTop:'0.6rem',borderTop:`1px solid ${P.border}`}}>
      <div style={{fontSize:11,fontWeight:600,color:P.textm,marginBottom:'0.4rem',textTransform:'uppercase',letterSpacing:'0.07em'}}>Campus</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:'0.3rem',marginBottom:'0.5rem'}}>
        {CAMPUS_LIST.map(c=>{
          const on=sel.includes(c)
          return <button key={c} onClick={()=>setSel(p=>on?p.filter(x=>x!==c):[...p,c])}
            style={{padding:'3px 10px',borderRadius:20,fontSize:11,border:`1px solid ${on?P.borderm:P.border}`,background:on?'rgba(93,226,152,0.12)':P.surface,color:on?P.petrole:P.textm,cursor:'pointer',fontWeight:on?600:400}}>{c}</button>
        })}
      </div>
      <button onClick={save} disabled={saving||!sel.length} style={{fontSize:11,background:sel.length?P.petrole:'rgba(19,69,71,0.08)',color:sel.length?P.givre:P.textm,border:'none',borderRadius:6,padding:'4px 12px',cursor:(!saving&&sel.length)?'pointer':'not-allowed'}}>
        {saving?'…':'Enregistrer'}
      </button>
    </div>
  )
}

/* ═══ ALERTES avec dismissal ══════════════════════════════════════════════ */
function AlertesList({formations,showFormationTitle=true}){
  const [dismissed,setDismissed]=useState({})   // {formId_idx: true}
  const toggle=(fid,i)=>setDismissed(p=>({...p,[fid+'_'+i]:!p[fid+'_'+i]}))
  const allDismissed=formations.every(f=>(f.alertes_detectees||[]).every((_,i)=>dismissed[f._id+'_'+i]))
  return(
    <div>
      {formations.every(f=>!(f.alertes_detectees||[]).length)?
        <Empty icon="✅" titre="Aucune alerte" msg="Aucune redondance détectée."/>:
        formations.map(f=>{
          const al=f.alertes_detectees||[]
          if(!al.length)return null
          return(
            <div key={f._id} style={{marginBottom:'1.5rem'}}>
              {showFormationTitle&&<div style={{fontSize:11,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>{f.formation?.titre}{f._campus?` · ${f._campus}`:''}</div>}
              {al.map((a,i)=>{
                const key=f._id+'_'+i
                const dis=!!dismissed[key]
                return(
                  <div key={i} style={{...card({borderLeft:`3px solid ${dis?P.border:a.niveau===2?P.amber:P.menthe}`}),opacity:dis?0.45:1,transition:'opacity 0.2s'}}>
                    <div style={{display:'flex',gap:'0.4rem',marginBottom:'0.4rem',flexWrap:'wrap',alignItems:'center'}}>
                      <Tag label={`Niveau ${a.niveau}`} color={dis?'gray':a.niveau===2?'amber':'blue'} small/>
                      <span style={{fontSize:13,fontWeight:600,color:dis?P.textm:P.abysse,flex:1}}>{a.notion}</span>
                      <button onClick={()=>toggle(f._id,i)}
                        style={{fontSize:11,padding:'2px 9px',borderRadius:6,border:`1px solid ${P.border}`,background:dis?'rgba(93,226,152,0.08)':P.surface,color:dis?P.petrole:P.textm,cursor:'pointer',flexShrink:0}}>
                        {dis?'Réactiver':'Ignorer'}
                      </button>
                    </div>
                    {!dis&&<p style={{fontSize:12,color:P.textm,margin:0,lineHeight:1.6}}>{a.message}</p>}
                    {dis&&<p style={{fontSize:11,color:P.textl,margin:0,fontStyle:'italic'}}>Alerte ignorée — cliquez Réactiver pour la rétablir.</p>}
                  </div>
                )
              })}
            </div>
          )
        })
      }
    </div>
  )
}

/* ═══ VUE DIRECTION DES PROGRAMMES ════════════════════════════════════════ */
function VueDir({user,onLogout}){
  const [onglet,setOnglet]=useState('formations')
  const [formations,setFormations]=useState([])
  const [loading,setLoading]=useState(true)
  const [files,setFiles]=useState([])
  const [campusSel,setCampusSel]=useState(['Le Mans'])
  const [nomFormation,setNomFormation]=useState('')
  const [ingLoading,setIngLoading]=useState(false)
  const [progress,setProgress]=useState('')
  const [error,setError]=useState('')
  const [selF,setSelF]=useState(null)
  const [editCampus,setEditCampus]=useState(null)   // _id de la formation en cours d'édition campus

  useEffect(()=>{loadFormations()},[])
  async function loadFormations(){
    try{const d=await api.getFormations();setFormations(d.formations);setLoading(false)}catch(e){setError(e.message);setLoading(false)}
  }
  async function lireTexte(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsText(file,'utf-8')})}

  async function handleIngestion(){
    if(!files.length||!campusSel.length)return
    setIngLoading(true);setError('');setProgress('Envoi au serveur…')
    try{
      const textes=await Promise.all(files.map(f=>lireTexte(f)))
      const campusVal=campusSel.length===1?campusSel[0]:campusSel
      const data=await ingererDocuments(textes,campusVal,setProgress)
      // Surcharge du titre si renseigné
      if(nomFormation.trim()&&data.formation)data.formation.titre=nomFormation.trim()
      setProgress('Enregistrement…')
      await api.createFormation(campusVal,data)
      setProgress('Formation chargée ✓');setFiles([]);setCampusSel([]);setNomFormation('')
      await loadFormations();setOnglet('formations')
    }catch(e){setError('Erreur : '+(e&&e.message?e.message:String(e)))}finally{setIngLoading(false)}
  }

  async function handleDelete(id){
    if(!confirm('Supprimer cette formation ?'))return
    try{await api.deleteFormation(id);await loadFormations();if(selF?._id===id)setSelF(null)}catch(e){setError(e.message)}
  }

  const totalAlertes=formations.flatMap(f=>f.alertes_detectees||[]).length
  const fCarto=selF||formations[0]||null

  return(
    <div style={{minHeight:'100vh',background:P.givre}}>
      <Topbar user={user} formationTitre="Direction des programmes" onLogout={onLogout} onglet={onglet} setOnglet={setOnglet}
        onglets={[{id:'formations',label:'Formations'},{id:'ingestion',label:'+ Ingestion'},{id:'cartographie',label:'Cartographie'},{id:'alertes',label:`Alertes (${totalAlertes})`},{id:'comptes',label:'Comptes'}]}/>
      <div style={{maxWidth:960,margin:'0 auto',padding:'2rem 1.5rem'}}>

        {onglet==='formations'&&(
          <div className="fi">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1.25rem'}}>
              <div><h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,margin:0,fontSize:24}}>Formations chargées</h2><p style={{fontSize:13,color:P.textm,marginTop:'0.25rem'}}>{formations.length} formation{formations.length>1?'s':''}</p></div>
              <button onClick={()=>setOnglet('ingestion')} style={{background:P.petrole,color:P.givre,border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:500,cursor:'pointer'}}>+ Ajouter</button>
            </div>
            {loading?<div style={{textAlign:'center',padding:'2rem'}}><Spinner/></div>:
              formations.length===0?<Empty icon="🎓" titre="Aucune formation" msg="Utilisez l'onglet Ingestion pour analyser vos documents." action="Aller à l'ingestion →" onClick={()=>setOnglet('ingestion')}/>:
              formations.map(f=>{
                const isSel=fCarto?._id===f._id
                return(
                <div key={f._id} onClick={()=>setSelF(f)}
                  style={{...card(),cursor:'pointer',
                    background:isSel?P.petrole:P.surface,
                    border:`1px solid ${isSel?P.petrole:P.border}`,
                    boxShadow:isSel?'0 4px 18px rgba(19,69,71,0.25)':'0 1px 6px rgba(11,43,45,0.06)',
                    transition:'all 0.18s'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:600,color:isSel?P.menthe:P.abysse}}>{f.formation?.titre||'Sans titre'}</div>
                      <div style={{fontSize:11,color:isSel?'rgba(227,255,240,0.55)':P.textm,marginTop:3}}>
                        {f._campus&&`📍 ${Array.isArray(f._campus)?f._campus.join(', '):(()=>{try{const p=JSON.parse(f._campus);return Array.isArray(p)?p.join(', '):f._campus}catch{return f._campus}})()}`}
                        {f._campus&&' · '}{(f.blocs||[]).length}B · {(f.blocs||[]).flatMap(b=>b.competences||[]).length}C · {(f.blocs||[]).flatMap(b=>b.modules||[]).length}M
                      </div>
                      {(f.alertes_detectees||[]).length>0&&<div style={{fontSize:11,color:isSel?P.eau:P.amber,marginTop:3}}>{(f.alertes_detectees||[]).length} alerte{(f.alertes_detectees||[]).length>1?'s':''}</div>}
                    </div>
                    <div style={{display:'flex',gap:'0.35rem',flexShrink:0,marginLeft:'0.75rem'}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>setEditCampus(editCampus===f._id?null:f._id)} style={{fontSize:11,color:isSel?P.menthe:P.petrole,border:`1px solid ${isSel?'rgba(93,226,152,0.3)':P.border}`,borderRadius:6,padding:'3px 9px',background:isSel?'rgba(93,226,152,0.12)':P.surface2,cursor:'pointer'}}>📍</button>
                      <button onClick={()=>{setSelF(f);setOnglet('cartographie')}} style={{fontSize:11,color:isSel?P.menthe:P.petrole,border:`1px solid ${isSel?'rgba(93,226,152,0.3)':P.border}`,borderRadius:6,padding:'3px 9px',background:isSel?'rgba(93,226,152,0.12)':P.surface2,cursor:'pointer'}}>Voir →</button>
                      <button onClick={()=>handleDelete(f._id)} style={{fontSize:11,color:isSel?'#FFB8B8':P.red,border:`1px solid ${isSel?'rgba(226,75,74,0.4)':P.red}`,borderRadius:6,padding:'3px 9px',background:isSel?'rgba(226,75,74,0.15)':P.redbg,cursor:'pointer'}}>×</button>
                    </div>
                  </div>
                  {editCampus===f._id&&<CampusEditor formation={f} onSave={async()=>{await loadFormations();setEditCampus(null)}}/>}
                </div>
                )
              })
            }
          </div>
        )}

        {onglet==='ingestion'&&(
          <div className="fi">
            <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:24,marginBottom:'0.4rem'}}>Nouvelle formation</h2>
            <p style={{fontSize:13,color:P.textm,marginBottom:'1.5rem',lineHeight:1.7}}>Déposez vos documents — syllabi, plan de formation, RACE.</p>

            {/* Nom de la formation */}
            <div style={card({marginBottom:'1rem'})}>
              <div style={{fontSize:12,fontWeight:600,color:P.abysse,marginBottom:'0.5rem'}}>Nom de la formation <span style={{fontWeight:400,color:P.textm}}>(optionnel — prioritaire sur le nom extrait)</span></div>
              <input value={nomFormation} onChange={e=>setNomFormation(e.target.value)} placeholder="Ex : MSMC 2025-26 — Bordeaux"
                style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:8,padding:'0.6rem 0.8rem',fontSize:13,color:P.abysse,outline:'none',boxSizing:'border-box'}}/>
            </div>

            {/* Campus multi-sélection */}
            <div style={card({marginBottom:'1rem'})}>
              <div style={{fontSize:12,fontWeight:600,color:P.abysse,marginBottom:'0.6rem'}}>Campus de rattachement</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem'}}>
                {CAMPUS_LIST.map(c=>{
                  const sel=campusSel.includes(c)
                  return <button key={c} onClick={()=>setCampusSel(p=>sel?p.filter(x=>x!==c):[...p,c])}
                    style={{padding:'5px 14px',borderRadius:20,fontSize:13,border:`1px solid ${sel?P.borderm:P.border}`,background:sel?'rgba(93,226,152,0.12)':P.surface,color:sel?P.petrole:P.textm,fontWeight:sel?600:400,cursor:'pointer',transition:'all 0.15s'}}>{c}</button>
                })}
              </div>
              {campusSel.length>1&&<div style={{fontSize:11,color:P.textm,marginTop:'0.5rem'}}>ℹ️ Formation visible par les RP de : {campusSel.join(', ')}</div>}
            </div>

            {/* Zone de dépôt */}
            <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();setFiles(prev=>[...prev,...Array.from(e.dataTransfer.files)])}} onClick={()=>document.getElementById('fi2').click()}
              style={{border:`2px dashed ${P.borderm}`,borderRadius:16,padding:'2.5rem 2rem',textAlign:'center',background:'rgba(93,226,152,0.04)',marginBottom:'1rem',cursor:'pointer'}}>
              <input id="fi2" type="file" multiple accept=".txt,.md,.csv,.pdf,.docx,.xlsx" style={{display:'none'}} onChange={e=>setFiles(prev=>[...prev,...Array.from(e.target.files)])}/>
              <div style={{fontSize:28,marginBottom:'0.6rem',opacity:0.45}}>📄</div>
              <div style={{fontSize:14,fontWeight:500,color:P.petrole}}>Glisser-déposer ou cliquer</div>
              <div style={{fontSize:12,color:P.textm}}>Syllabi · Plan de formation · RACE · .md .txt .pdf .docx .xlsx</div>
            </div>

            {files.length>0&&<div style={{marginBottom:'1rem'}}>{files.map((f,i)=><div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.5rem 0.75rem',background:P.surface,borderRadius:8,border:`1px solid ${P.border}`,marginBottom:'0.35rem'}}><div style={{fontSize:13,fontWeight:500,color:P.abysse}}>{f.name} <span style={{fontSize:11,color:P.textm}}>({(f.size/1024).toFixed(1)} Ko)</span></div><button onClick={()=>setFiles(prev=>prev.filter((_,j)=>j!==i))} style={{color:P.red,fontSize:16,cursor:'pointer'}}>×</button></div>)}</div>}

            <button onClick={handleIngestion} disabled={ingLoading||!files.length||!campusSel.length}
              style={{width:'100%',padding:'0.9rem',borderRadius:10,fontSize:14,fontWeight:600,border:'none',transition:'all 0.2s',cursor:(!ingLoading&&files.length&&campusSel.length)?'pointer':'not-allowed',
                background:(!ingLoading&&files.length&&campusSel.length)?`linear-gradient(135deg,${P.petrole},${P.menthe})`:'rgba(19,69,71,0.08)',color:(!ingLoading&&files.length&&campusSel.length)?P.abysse:P.textm}}>
              {ingLoading?<span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem'}}><Spinner size={16}/>{progress}</span>:'Analyser avec Claude →'}
            </button>
            {error&&<div style={{marginTop:'1rem',padding:'0.75rem 1rem',background:P.redbg,border:`1px solid ${P.red}`,borderRadius:8,fontSize:12,color:'#8B1A1A'}}>{error}</div>}
          </div>
        )}

        {onglet==='cartographie'&&(
          <div className="fi">
            {formations.length===0?<Empty icon="🗺" titre="Aucune formation" msg="Chargez une formation d'abord." action="Ingestion →" onClick={()=>setOnglet('ingestion')}/>:<>
              {formations.length>1&&<div style={{display:'flex',gap:'0.4rem',marginBottom:'1rem',flexWrap:'wrap'}}>{formations.map(f=><button key={f._id} onClick={()=>setSelF(f)} style={{padding:'5px 14px',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer',border:`1px solid ${fCarto?._id===f._id?P.borderm:P.border}`,background:fCarto?._id===f._id?'rgba(93,226,152,0.12)':P.surface,color:fCarto?._id===f._id?P.petrole:P.textm}}>{f.formation?.titre||'?'}</button>)}</div>}
              <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>{fCarto?.formation?.titre||'Cartographie'}</h2>
              <GrapheCanvas blocs={fCarto?.blocs||[]} alertes={fCarto?.alertes_detectees||[]} showAlerts/>
            </>}
          </div>
        )}

        {onglet==='alertes'&&(
          <div className="fi">
            <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.5rem'}}>Alertes réseau</h2>
            <p style={{fontSize:12,color:P.textm,marginBottom:'1.25rem'}}>Signaux de coordination — opportunités pédagogiques. Vous pouvez ignorer les alertes non pertinentes.</p>
            <AlertesList formations={formations} showFormationTitle/>
          </div>
        )}

        {onglet==='comptes'&&<UserManagement/>}
      </div>
    </div>
  )
}

/* ═══ VUE RP ════════════════════════════════════════════════════════════════ */
function VueRP({user,onLogout}){
  const [onglet,setOnglet]=useState('formations')
  const [formations,setFormations]=useState([])
  const [loading,setLoading]=useState(true)
  const [selF,setSelF]=useState(null)

  useEffect(()=>{api.getFormations().then(d=>{setFormations(d.formations);setLoading(false)}).catch(()=>setLoading(false))},[])
  const f=selF||formations[0]||null
  const alertes=f?.alertes_detectees||[]

  return(
    <div style={{minHeight:'100vh',background:P.givre}}>
      <Topbar user={user} formationTitre={f?.formation?.titre||''} onLogout={onLogout} onglet={onglet} setOnglet={setOnglet}
        onglets={[{id:'formations',label:'Mes formations'},{id:'cartographie',label:'Cartographie'},{id:'blocs',label:'Blocs'},{id:'alertes',label:`Alertes (${alertes.length})`},{id:'comptes',label:'Comptes'}]}/>
      <div style={{maxWidth:960,margin:'0 auto',padding:'1.5rem'}}>
        {loading?<div style={{textAlign:'center',padding:'2rem'}}><Spinner/></div>:!f?<Empty icon="🎓" titre="Aucune formation" msg="Aucune formation sur votre campus. Contacter la Direction des programmes."/>:<>
          {onglet==='formations'&&<div className="fi"><h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>Mes formations — {user.campus}</h2>{formations.map(fo=>{const isSel=selF?._id===fo._id;return<div key={fo._id} onClick={()=>setSelF(fo)} style={{...card({cursor:'pointer'}),background:isSel?P.petrole:P.surface,border:`1px solid ${isSel?P.petrole:P.border}`,boxShadow:isSel?'0 4px 18px rgba(19,69,71,0.25)':'0 1px 6px rgba(11,43,45,0.06)',transition:'all 0.18s'}}><div style={{fontSize:14,fontWeight:600,color:isSel?P.menthe:P.abysse}}>{fo.formation?.titre}</div><div style={{fontSize:11,color:isSel?'rgba(227,255,240,0.55)':P.textm,marginTop:3}}>{(fo.blocs||[]).length}B · {(fo.blocs||[]).flatMap(b=>b.modules||[]).length}M</div></div>})}</div>}
          {onglet==='cartographie'&&<div className="fi"><h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>{f.formation?.titre}</h2><GrapheCanvas blocs={f.blocs||[]} alertes={alertes} showAlerts/></div>}
          {onglet==='blocs'&&<div className="fi"><h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>Blocs</h2>{(f.blocs||[]).map(b=><details key={b.id} style={{...card(),marginBottom:'0.6rem'}}><summary style={{listStyle:'none',display:'flex',justifyContent:'space-between',cursor:'pointer'}}><div><Tag label={b.id} small/><span style={{marginLeft:'0.5rem',fontSize:14,fontWeight:600,color:P.abysse}}>{b.titre}</span><div style={{fontSize:11,color:P.textm,marginTop:3}}>{(b.competences||[]).length}C · {(b.modules||[]).length}M</div></div><span style={{fontSize:18,color:P.textm}}>▾</span></summary><div style={{marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:`1px solid ${P.border}`}}>{(b.modules||[]).map(m=><div key={m.id} style={{background:P.surface2,borderRadius:8,padding:'0.5rem 0.75rem',marginBottom:'0.35rem',border:`1px solid ${P.border}`}}><div style={{fontSize:13,fontWeight:500,color:P.abysse}}>{m.titre}</div>{m.intervenant&&<div style={{fontSize:11,color:P.textm}}>{m.intervenant}</div>}{m.notions_cles?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'0.25rem',marginTop:'0.3rem'}}>{m.notions_cles.map(n=><Tag key={n} label={n} small/>)}</div>}</div>)}</div></details>)}</div>}
          {onglet==='alertes'&&<div className="fi"><h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.5rem'}}>Alertes</h2><p style={{fontSize:12,color:P.textm,marginBottom:'1.25rem'}}>Ignorez les alertes non pertinentes — elles restent réactivables.</p><AlertesList formations={[f]} showFormationTitle={false}/></div>}
          {onglet==='comptes'&&(
            <div className="fi">
              <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.75rem'}}>Import de comptes</h2>
              <p style={{fontSize:13,color:P.textm,marginBottom:'1.25rem',lineHeight:1.7}}>Importez les intervenants et étudiants de votre campus. Pour les intervenants, Claude apparie automatiquement leurs matières aux modules de la formation sélectionnée.</p>
              <div style={card()}>
                <ImportCSV campus={user.campus} formations={formations} formation={f} onDone={()=>{}}/>
              </div>
            </div>
          )}
        </>}
      </div>
    </div>
  )
}

/* ═══ VUE INTERVENANT ══════════════════════════════════════════════════════ */
function VueIntervenant({user,onLogout}){
  const [formations,setFormations]=useState([])
  const [selF,setSelF]=useState(null)
  const [onglet,setOnglet]=useState('avant')
  const [selMod,setSelMod]=useState(null)
  const [loading,setLoading]=useState(true)
  const [ficheLoading,setFicheLoading]=useState(false)
  const [fiche,setFiche]=useState(null)
  const [stream,setStream]=useState('')
  const [sent,setSent]=useState(false)

  useEffect(()=>{api.getFormations().then(d=>{setFormations(d.formations);setLoading(false)}).catch(()=>setLoading(false))},[])
  useEffect(()=>{if(formations.length&&!selF)setSelF(formations[0])},[formations])
  const mesModules=selF?(selF.blocs||[]).flatMap(b=>(b.modules||[]).map(m=>({...m,bloc_id:b.id,bloc_titre:b.titre}))):[  ]

  async function chargerFiche(mod){
    setSelMod(mod);setFiche(null);setStream('');setFicheLoading(true)
    try{const r=await genererFicheJ1(selF,mod,p=>setStream(p));setFiche(r)}finally{setFicheLoading(false)}
  }

  return(
    <div style={{minHeight:'100vh',background:P.givre}}>
      <Topbar user={user} formationTitre={selF?.formation?.titre||''} onLogout={onLogout} onglet={onglet} setOnglet={setOnglet}
        onglets={[{id:'avant',label:'Fiche J-1'},{id:'declaration',label:'Déclaration'},{id:'graphe',label:"Vue d'ensemble"}]}/>
      <div style={{maxWidth:700,margin:'0 auto',padding:'2rem 1.5rem'}}>
        {loading?<div style={{textAlign:'center',padding:'2rem'}}><Spinner/></div>:!selF?<Empty icon="📋" titre="Aucune formation" msg="Aucune formation disponible."/>:<>
          {formations.length>1&&<div style={{display:'flex',gap:'0.4rem',marginBottom:'1.25rem',flexWrap:'wrap'}}>{formations.map(f=><button key={f._id} onClick={()=>{setSelF(f);setSelMod(null);setFiche(null)}} style={{padding:'5px 12px',borderRadius:8,fontSize:12,cursor:'pointer',border:`1px solid ${selF?._id===f._id?P.borderm:P.border}`,background:selF?._id===f._id?'rgba(93,226,152,0.12)':P.surface,color:selF?._id===f._id?P.petrole:P.textm}}>{f.formation?.titre||'?'}</button>)}</div>}
          {onglet==='avant'&&!selMod&&<div className="fi"><h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.5rem'}}>Choisir un module</h2><p style={{fontSize:13,color:P.textm,marginBottom:'1rem'}}>Sélectionnez le module pour générer la fiche J‑1.</p>
            {(selF.blocs||[]).map(b=>{const bM=mesModules.filter(m=>m.bloc_id===b.id);if(!bM.length)return null;return<div key={b.id} style={{marginBottom:'1rem'}}><div style={{fontSize:11,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.4rem'}}>{b.id} — {b.titre}</div>{bM.map(m=><button key={m.id} onClick={()=>chargerFiche(m)} style={{width:'100%',textAlign:'left',padding:'0.75rem 1rem',borderRadius:10,border:`1px solid ${P.border}`,background:P.surface,marginBottom:'0.35rem',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.boxShadow='0 3px 12px rgba(11,43,45,0.08)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}><div><div style={{fontSize:13,fontWeight:500,color:P.abysse}}>{m.titre}</div>{m.intervenant&&<div style={{fontSize:11,color:P.textm,marginTop:2}}>{m.intervenant}</div>}</div><span style={{fontSize:11,color:P.textm}}>Générer →</span></button>)}</div>})}
          </div>}
          {onglet==='avant'&&selMod&&<div className="fi">
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'1.5rem'}}>
              <button onClick={()=>{setSelMod(null);setFiche(null)}} style={{fontSize:12,color:P.petrole,border:`1px solid ${P.border}`,borderRadius:6,padding:'3px 10px',background:P.surface,cursor:'pointer'}}>← Modules</button>
              <span style={{fontSize:13,fontWeight:600,color:P.abysse}}>{selMod.titre}</span>
            </div>
            {ficheLoading?<div style={{padding:'1.25rem',background:P.abysse,borderRadius:12,border:`1px solid ${P.borderm}`}}><div style={{fontSize:10,fontWeight:600,color:'rgba(93,226,152,0.5)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'0.5rem',display:'flex',alignItems:'center',gap:'0.5rem'}}><Spinner size={14}/>Claude génère la fiche…</div><div style={{fontSize:11,color:P.eau,fontFamily:'monospace',lineHeight:1.7,whiteSpace:'pre-wrap',wordBreak:'break-word',minHeight:60}}>{stream}</div></div>:fiche&&<>
              <div style={card()}><div style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Ancrage</div><div style={{display:'flex',gap:'0.5rem',alignItems:'flex-start',marginBottom:'0.5rem'}}><Tag label={selMod.bloc_id}/><div><div style={{fontSize:13,fontWeight:600,color:P.abysse}}>{selMod.titre}</div><div style={{fontSize:11,color:P.textm,marginTop:2}}>{selMod.bloc_titre}</div></div></div><p style={{fontSize:12,color:P.textm,margin:0,lineHeight:1.6,fontStyle:'italic'}}>{fiche.ancrage}</p></div>
              {fiche.dejavu?.length>0&&<div style={card()}><div style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Déjà vu par vos étudiants</div>{fiche.dejavu.map((it,i)=><div key={i} style={{background:P.surface2,borderRadius:8,padding:'0.55rem 0.8rem',marginBottom:'0.4rem'}}><div style={{display:'flex',alignItems:'center',gap:'0.35rem',marginBottom:'0.3rem'}}>{it.intervenant&&<Avatar name={it.intervenant} size={20}/>}<span style={{fontSize:12,fontWeight:600,color:P.abysse}}>{it.intervenant||'—'}</span><span style={{fontSize:11,color:P.textm}}>· {it.module}</span></div><div style={{display:'flex',flexWrap:'wrap',gap:'0.25rem',marginBottom:'0.3rem'}}>{(it.concepts||[]).map(c=><Tag key={c} label={c} small/>)}</div><p style={{fontSize:11,color:P.textm,margin:0,fontStyle:'italic'}}>{it.lien}</p></div>)}</div>}
              {fiche.apres?.length>0&&<div style={card()}><div style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Ce qui arrive après</div>{fiche.apres.map((it,i)=><div key={i} style={{display:'flex',gap:'0.6rem',padding:'0.4rem 0',borderBottom:i<fiche.apres.length-1?`1px solid rgba(19,69,71,0.06)`:'none'}}><div style={{fontSize:11,color:P.textl,flexShrink:0,width:60}}>{it.date}</div><div style={{flex:1}}><span style={{fontSize:12,fontWeight:600,color:P.abysse}}>{it.module}</span>{it.intervenant&&<span style={{fontSize:11,color:P.textm}}> · {it.intervenant}</span>}<div style={{display:'flex',flexWrap:'wrap',gap:'0.25rem',marginTop:'0.25rem'}}>{(it.concepts||[]).map(c=><Tag key={c} label={c} small/>)}</div></div></div>)}</div>}
            </>}
          </div>}
          {onglet==='declaration'&&(sent?<div style={{textAlign:'center',padding:'4rem 2rem'}}><div style={{fontSize:48,color:P.menthe}}>✓</div><h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,fontSize:21,marginTop:'0.5rem'}}>Déclaration enregistrée</h2><button onClick={()=>setSent(false)} style={{marginTop:'1rem',border:`1px solid ${P.border}`,color:P.textm,borderRadius:6,padding:'6px 16px',fontSize:12,background:P.surface,cursor:'pointer'}}>Nouvelle déclaration</button></div>:!selMod?<div style={{padding:'2rem',textAlign:'center',color:P.textm,fontSize:13}}>Sélectionnez un module dans l'onglet Fiche J-1.</div>:<div className="fi"><h1 style={{fontFamily:'Georgia,serif',fontWeight:400,fontSize:21,color:P.abysse,margin:0,marginBottom:'1.25rem'}}>Déclaration — {selMod.titre}</h1><button onClick={async()=>{await new Promise(r=>setTimeout(r,700));setSent(true)}} style={{width:'100%',background:P.petrole,color:P.givre,border:'none',borderRadius:10,padding:'12px',fontSize:14,fontWeight:500,cursor:'pointer'}}>Envoyer la déclaration</button></div>)}
          {onglet==='graphe'&&<div className="fi"><h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.5rem'}}>Vue d'ensemble</h2><p style={{fontSize:12,color:P.textm,marginBottom:'1rem'}}>Lecture seule.</p><GrapheCanvas blocs={selF?.blocs||[]} alertes={[]} showAlerts={false}/></div>}
        </>}
      </div>
    </div>
  )
}

/* ═══ VUE ÉTUDIANT ══════════════════════════════════════════════════════════ */
function VueEtudiant({user,onLogout}){
  const [formations,setFormations]=useState([])
  const [loading,setLoading]=useState(true)
  const [saved,setSaved]=useState(false)
  useEffect(()=>{api.getFormations().then(d=>{setFormations(d.formations);setLoading(false)}).catch(()=>setLoading(false))},[])
  const f=formations[0]||null
  const allComps=f?(f.blocs||[]).flatMap(b=>(b.competences||[]).map(c=>({...c,bloc_id:b.id,bloc_titre:b.titre,module:(b.modules||[])[0]?.titre||'',statut:null,retex:''}))):[  ]
  const [comps,setComps]=useState([])
  useEffect(()=>{if(allComps.length&&!comps.length)setComps(allComps)},[allComps])
  const update=(id,field,val)=>{setComps(p=>p.map(c=>c.id===id?{...c,[field]:val}:c));setSaved(false)}
  const pct=allComps.length?Math.round(comps.filter(c=>c.statut).length/allComps.length*100):0
  const sCol={acquis:P.menthe,voie:P.amber,nonacquis:P.red}
  const sBg={acquis:'rgba(93,226,152,0.12)',voie:P.amberbg,nonacquis:P.redbg}
  const sFg={acquis:P.petrole,voie:'#7A4A00',nonacquis:'#8B1A1A'}
  return(
    <div style={{minHeight:'100vh',background:P.givre}}>
      <div style={{height:52,background:P.surface,borderBottom:`1px solid ${P.border}`,padding:'0 1.25rem',display:'flex',alignItems:'center',gap:'0.75rem',position:'sticky',top:0,zIndex:100,boxShadow:'0 1px 8px rgba(11,43,45,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,paddingRight:10,borderRight:`1px solid ${P.border}`}}><div style={{width:24,height:24,borderRadius:'50%',background:P.petrole,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:P.menthe,fontSize:11,fontWeight:700,fontFamily:'Georgia,serif',fontStyle:'italic'}}>e</span></div></div>
        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:P.abysse}}>Mon parcours</div><div style={{fontSize:11,color:P.textm}}>{f?.formation?.titre||'—'}</div></div>
        <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}><span style={{fontSize:11,color:P.textm}}>{pct}%</span><div style={{width:60,height:4,background:'rgba(19,69,71,0.10)',borderRadius:99,overflow:'hidden'}}><div style={{width:`${pct}%`,height:'100%',background:P.menthe,borderRadius:99,transition:'width 0.4s'}}/></div></div>
        <div style={{display:'flex',alignItems:'center',gap:'0.5rem',paddingLeft:10,borderLeft:`1px solid ${P.border}`}}><Avatar name={`${user.prenom} ${user.nom}`} size={24}/><span style={{fontSize:11,color:P.abysse}}>{user.prenom}</span><button onClick={onLogout} title="Déconnexion" style={{color:P.textm,fontSize:14,cursor:'pointer'}}>⏻</button></div>
      </div>
      <div style={{maxWidth:720,margin:'0 auto',padding:'1.5rem'}}>
        {loading?<div style={{textAlign:'center',padding:'2rem'}}><Spinner/></div>:!f?<Empty icon="🎓" titre="Aucune formation" msg="Contacter la Direction des programmes."/>:comps.length===0?<Empty icon="📋" titre="Aucune compétence" msg="Données en cours de chargement."/>:<>
          <div style={{...card({marginBottom:'1.25rem'}),background:'rgba(93,226,152,0.08)',border:`1px solid ${P.borderm}`}}><div style={{fontSize:12,fontWeight:600,color:P.petrole,marginBottom:'0.3rem'}}>Comment ça marche ?</div><p style={{fontSize:12,color:P.petrole,margin:0,lineHeight:1.6,opacity:0.8}}>Pour chaque compétence, indique si tu l'as acquise. Ton retex est confidentiel.</p></div>
          {(f.blocs||[]).map(b=>{const bC=comps.filter(c=>c.bloc_id===b.id);if(!bC.length)return null;return<div key={b.id} style={{marginBottom:'1.5rem'}}><div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'0.75rem'}}><Tag label={b.id} small/><span style={{fontSize:14,fontWeight:600,color:P.abysse}}>{b.titre}</span></div>
            {bC.map(c=><div key={c.id} style={card()}><div style={{marginBottom:'0.6rem'}}><div style={{display:'flex',alignItems:'flex-start',gap:'0.5rem',marginBottom:'0.2rem'}}><Tag label={c.id} small/><span style={{fontSize:13,color:P.abysse,lineHeight:1.4,fontWeight:500}}>{c.libelle}</span></div>{c.module&&<div style={{fontSize:11,color:P.textm}}>Module : {c.module}</div>}</div>
              <div style={{fontSize:11,fontWeight:600,color:P.textm,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:'0.4rem'}}>Ton auto-évaluation</div>
              <div style={{display:'flex',gap:'0.35rem',marginBottom:'0.5rem',flexWrap:'wrap'}}>{[{v:'acquis',l:'✓ Acquis'},{v:'voie',l:'↗ En voie'},{v:'nonacquis',l:'✗ Pas encore'}].map(({v,l})=><button key={v} onClick={()=>update(c.id,'statut',c.statut===v?null:v)} style={{background:c.statut===v?(sBg[v]||'rgba(19,69,71,0.06)'):'rgba(19,69,71,0.05)',color:c.statut===v?(sFg[v]||P.textm):P.textm,border:`1px solid ${c.statut===v?(sCol[v]||P.border):P.border}`,borderRadius:20,padding:'4px 12px',fontSize:12,transition:'all 0.15s',cursor:'pointer'}}>{l}</button>)}</div>
              <textarea value={c.retex} onChange={e=>update(c.id,'retex',e.target.value)} placeholder="Commentaire libre (optionnel)" style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:8,padding:'0.5rem',fontSize:12,resize:'vertical',minHeight:50,color:P.abysse,outline:'none',lineHeight:1.5,background:c.retex?P.surface:'rgba(227,255,240,0.3)'}}/>
            </div>)}
          </div>})}
          <button onClick={()=>setSaved(true)} style={{width:'100%',background:P.petrole,color:P.givre,border:'none',borderRadius:10,padding:'12px',fontSize:14,fontWeight:500,cursor:'pointer'}}>{saved?'✓ Enregistré':'Enregistrer'}</button>
          {saved&&<p style={{textAlign:'center',fontSize:12,color:P.petrole,marginTop:'0.6rem'}}>Visible de ton tuteur uniquement.</p>}
        </>}
      </div>
    </div>
  )
}

/* ═══ VUE FORMATEUR RÉFÉRENT — poste de travail (lecture seule V1) ═══════════ */
function VueFR({user,onLogout}){
  const [formations,setFormations]=useState([])
  const [formationId,setFormationId]=useState(null)
  const [onglet,setOnglet]=useState('alertes')
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  useEffect(()=>{
    api.getFormations()
      .then(d=>{
        setFormations(d.formations||[])
        const first=(d.formations||[])[0]
        if(first) setFormationId(first._id)
        else setLoading(false)
      })
      .catch(e=>{setError(e.message);setLoading(false)})
  },[])

  useEffect(()=>{
    if(!formationId) return
    setLoading(true);setError('')
    api.getFR(formationId)
      .then(d=>{setData(d);setLoading(false)})
      .catch(e=>{setError(e.message);setLoading(false)})
  },[formationId])

  const f=formations.find(x=>x._id===formationId)||null
  const titre=f?.formation?.titre||'Atlas des compétences'
  const prevues=data?.seances_prevues||[]
  const realisees=data?.seances_realisees||[]
  const ecarts=data?.ecarts||[]
  const digest=data?.digest||null

  const parIntervenant={}
  prevues.forEach(s=>{
    const k=s.intervenant_nom||'—'
    if(!parIntervenant[k]) parIntervenant[k]={nom:k,seances:[]}
    parIntervenant[k].seances.push(s)
  })
  const intervenants=Object.values(parIntervenant)

  const onglets=[
    {id:'alertes',label:`Écarts (${ecarts.length})`},
    {id:'digest',label:'Digest'},
    {id:'previsionnel',label:'Prévisionnels'},
  ]

  function fmtDate(iso){
    if(!iso) return '—'
    try{return new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}catch(_){return iso}
  }

  return(
    <div style={{minHeight:'100vh',background:P.givre}}>
      <Topbar user={user} formationTitre={`${titre} — Formateur Référent`} onLogout={onLogout} onglet={onglet} setOnglet={setOnglet} onglets={onglets}/>
      <div style={{maxWidth:1000,margin:'0 auto',padding:'1.5rem 1.25rem'}}>

        {formations.length>1&&(
          <div style={{marginBottom:'1rem',display:'flex',alignItems:'center',gap:'0.5rem'}}>
            <span style={{fontSize:11,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.07em'}}>Titre</span>
            <select value={formationId||''} onChange={e=>setFormationId(Number(e.target.value))}
              style={{border:`1px solid ${P.border}`,borderRadius:7,padding:'6px 10px',fontSize:13,color:P.abysse,background:P.surface,outline:'none'}}>
              {formations.map(x=><option key={x._id} value={x._id}>{x.formation?.titre||`Formation ${x._id}`}{x._campus?` · ${x._campus}`:''}</option>)}
            </select>
          </div>
        )}

        {loading?(
          <div style={{textAlign:'center',padding:'3rem'}}><Spinner size={28}/></div>
        ):error?(
          <Empty icon="⚠" titre="Erreur de chargement" msg={error}/>
        ):!f?(
          <Empty icon="📋" titre="Aucune formation" msg="Aucun titre ne vous est rattaché. Contactez la Direction des programmes."/>
        ):(
          <>
            {onglet==='alertes'&&(
              <div style={{animation:'fadeIn 0.25s ease'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'0.75rem',marginBottom:'1.5rem'}}>
                  <div style={card({padding:'1rem 1.25rem',marginBottom:0})}><div style={{fontSize:28,fontWeight:600,lineHeight:1,color:P.red}}>{ecarts.length}</div><div style={{fontSize:11,color:P.textm,marginTop:4}}>Écarts prévu / réalisé</div></div>
                  <div style={card({padding:'1rem 1.25rem',marginBottom:0})}><div style={{fontSize:28,fontWeight:600,lineHeight:1,color:P.menthe}}>{prevues.length}</div><div style={{fontSize:11,color:P.textm,marginTop:4}}>Séances prévues</div></div>
                  <div style={card({padding:'1rem 1.25rem',marginBottom:0})}><div style={{fontSize:28,fontWeight:600,lineHeight:1,color:P.petrole}}>{realisees.length}</div><div style={{fontSize:11,color:P.textm,marginTop:4}}>Séances réalisées (CESAR)</div></div>
                </div>

                {ecarts.length===0?(
                  <Empty icon="✓" titre="Aucun écart cette semaine" msg="Toutes les séances prévues correspondent au réalisé déclaré. Rien à arbitrer pour le moment."/>
                ):ecarts.map(e=>(
                  <div key={e.previsionnel_id} style={card({borderLeft:`3px solid ${P.red}`})}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:'0.5rem',marginBottom:'0.4rem'}}>
                      <Tag label="Écart prévu / réalisé" color="red" small/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:600,color:P.abysse}}>{e.titre} — {e.intervenant_nom}</div>
                        <div style={{fontSize:12,color:P.textm,marginTop:2}}>Séance {e.numero} · prévue le {fmtDate(e.date_prevue)} · aucune déclaration reçue</div>
                      </div>
                    </div>
                    <div style={{fontSize:13,color:P.textm,lineHeight:1.6}}>
                      Cette séance figure au prévisionnel mais n'a pas encore de réalisé déclaré (émargement CESAR ou saisie FR).
                      Le graphe de compétences ne peut pas être mis à jour tant que le contenu réalisé n'est pas connu.
                    </div>
                  </div>
                ))}
              </div>
            )}

            {onglet==='digest'&&(
              <div style={{animation:'fadeIn 0.25s ease'}}>
                {!digest?(
                  <Empty icon="✉" titre="Aucun digest généré" msg="Le digest de la semaine n'a pas encore été produit par Atlas. Il apparaîtra ici dès qu'une séance de la semaine sera réalisée, prêt à être relu puis validé."/>
                ):(
                  <DigestPreview digest={digest} titre={titre} campus={f._campus} fr={`${user.prenom} ${user.nom}`}/>
                )}
              </div>
            )}

            {onglet==='previsionnel'&&(
              <div style={{animation:'fadeIn 0.25s ease'}}>
                {intervenants.length===0?(
                  <Empty icon="📝" titre="Aucun prévisionnel saisi" msg="Les intervenants n'ont pas encore renseigné leur prévisionnel annuel pour ce titre."/>
                ):(
                  <>
                    <p style={{fontSize:13,color:P.textm,marginBottom:'1.25rem',lineHeight:1.6}}>Saisies intervenants — séances planifiées cette semaine.</p>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.6rem'}}>
                      {intervenants.map(it=>(
                        <div key={it.nom} style={card({marginBottom:0})}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                            <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                              <Avatar name={it.nom} size={26}/>
                              <div>
                                <div style={{fontSize:14,fontWeight:600,color:P.abysse}}>{it.nom}</div>
                                <div style={{fontSize:12,color:P.textm}}>{it.seances.length} séance{it.seances.length>1?'s':''} cette semaine</div>
                              </div>
                            </div>
                          </div>
                          {it.seances.map(s=>(
                            <div key={s.id} style={{padding:'0.4rem 0',borderTop:`1px solid ${P.border}`}}>
                              <div style={{fontSize:12,fontWeight:500,color:P.abysse}}>Séance {s.numero} · {s.titre}</div>
                              <div style={{fontSize:11,color:P.textm,marginTop:2}}>{fmtDate(s.date_prevue)} · {s.modalite==='D'?'Distanciel':'Présentiel'}</div>
                              {(s.competences||[]).length>0&&<div style={{display:'flex',gap:3,flexWrap:'wrap',marginTop:4}}>{s.competences.map(c=><Tag key={c} label={c} small/>)}</div>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ── Aperçu digest — reproduit la maquette validée, alimenté par digest.contenu_genere ── */
function DigestPreview({digest,titre,campus,fr}){
  const c=digest.contenu_genere||{}
  const D={abysse:P.abysse,petrole:P.petrole,menthe:P.menthe,saumon:P.saumon}
  const traverse=c.traverse||[]
  const coordination=c.coordination||[]
  const vosSeances=c.vos_seances||[]
  const quiDautre=c.qui_dautre||[]
  const kpis=c.kpis||{intervenants:traverse.length,seances:0,couverture:'—',coordination:coordination.length}
  const noteFR=c.note_fr||''
  const sectStyle={padding:'1.25rem 1.75rem',borderBottom:'1px solid rgba(255,255,255,0.06)',background:D.abysse}
  const labelStyle={fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.28)',marginBottom:'0.75rem'}
  const pill={display:'inline-block',padding:'1px 8px',borderRadius:20,fontSize:10,fontWeight:600,background:'rgba(93,226,152,0.12)',color:D.menthe,border:'1px solid rgba(93,226,152,0.22)',marginRight:3,marginTop:4}
  const item={display:'flex',alignItems:'flex-start',gap:'0.85rem',padding:'0.55rem 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}
  const dot=(dim)=>({width:7,height:7,borderRadius:'50%',background:dim?'rgba(93,226,152,0.3)':D.menthe,flexShrink:0,marginTop:4})
  const itTitle={fontSize:13,fontWeight:500,color:'#fff',lineHeight:1.4}
  const itSub={fontSize:11,color:'rgba(255,255,255,0.38)',marginTop:2,lineHeight:1.5}
  const statutLabel={genere:'Prêt à valider',valide:'Validé',envoye:'Envoyé'}[digest.statut]||digest.statut

  return(
    <>
      <div style={{...card({background:'rgba(93,226,152,0.10)',border:`1px solid ${P.borderm}`}),display:'flex',alignItems:'flex-start',gap:'0.6rem'}}>
        <span style={{fontSize:14}}>✓</span>
        <div style={{fontSize:13,color:P.petrole,lineHeight:1.6}}>
          Digest {statutLabel.toLowerCase()}. Relisez l'aperçu ci-dessous tel que les intervenants le recevront
          {(digest.destinataires||[]).length>0&&<> — {digest.destinataires.length} destinataire{digest.destinataires.length>1?'s':''}</>}.
        </div>
      </div>

      <div style={{fontSize:11,fontWeight:600,color:P.textm,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'0.75rem'}}>Aperçu — tel que les intervenants le recevront</div>

      <div style={{borderRadius:14,overflow:'hidden',border:`1px solid ${P.border}`,boxShadow:'0 4px 24px rgba(11,43,45,0.12)'}}>
        <div style={{background:D.petrole,padding:'0.7rem 1.75rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:14,color:D.menthe,fontWeight:600}}>Atlas · Éminéo</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.35)'}}>{titre}{campus?` · ${campus}`:''}</div>
        </div>

        <div style={{background:D.abysse,padding:'1.75rem'}}>
          <div style={{fontSize:10,fontWeight:600,letterSpacing:'0.12em',textTransform:'uppercase',color:D.menthe,marginBottom:'0.4rem'}}>Synthèse · Formateur Référent {fr}</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:22,color:'#fff',fontWeight:400,lineHeight:1.25,marginBottom:'0.35rem'}}>{c.titre||'Ce que le groupe a traversé'}</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.35)'}}>Généré par Atlas · Validé avant envoi · Répondez à ce mail pour contacter {fr}</div>
          <div style={{display:'flex',gap:'1.5rem',marginTop:'1.25rem',paddingTop:'1.25rem',borderTop:'1px solid rgba(255,255,255,0.07)'}}>
            <div><div style={{fontSize:22,fontWeight:700,color:D.menthe}}>{kpis.intervenants}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Intervenants actifs</div></div>
            <div><div style={{fontSize:22,fontWeight:700,color:D.menthe}}>{kpis.seances}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Séances réalisées</div></div>
            <div><div style={{fontSize:22,fontWeight:700,color:D.menthe}}>{kpis.couverture}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Couverture RNCP</div></div>
            <div><div style={{fontSize:22,fontWeight:700,color:D.saumon}}>{kpis.coordination}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Points de coordination</div></div>
          </div>
        </div>

        <div style={sectStyle}>
          <div style={labelStyle}>Ce que le groupe a traversé</div>
          {traverse.length===0?<div style={itSub}>Aucune séance réalisée cette période.</div>:traverse.map((t,i)=>(
            <div key={i} style={item}>
              <div style={dot(t.en_cours)}/>
              <div><div style={{...itTitle,...(t.en_cours?{color:'rgba(255,255,255,0.55)'}:{})}}>{t.module}</div>
                <div style={itSub}>{t.intervenant}{t.seances?` · ${t.seances}`:''}{t.volume?` · ${t.volume}`:''}{t.modalite?` · ${t.modalite}`:''}</div>
                <div>{(t.competences||[]).map(cp=><span key={cp} style={t.en_cours?{...pill,opacity:0.5}:pill}>{cp}</span>)}</div>
              </div>
            </div>
          ))}
        </div>

        {(noteFR||coordination.length>0)&&(
          <div style={sectStyle}>
            <div style={labelStyle}>Point de coordination — {fr}, FR</div>
            {noteFR&&(
              <div style={{background:'rgba(232,155,119,0.08)',border:'1px solid rgba(232,155,119,0.2)',borderRadius:8,padding:'0.85rem 1rem',marginBottom:coordination.length?'0.75rem':0}}>
                <div style={{fontSize:10,fontWeight:600,color:D.saumon,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:'0.3rem'}}>Note du Formateur Référent</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.62)',lineHeight:1.65}}>{noteFR}</div>
              </div>
            )}
            {coordination.map((co,i)=>(
              <div key={i} style={{...item,padding:'0.4rem 0'}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:D.saumon,flexShrink:0,marginTop:4}}/>
                <div><div style={{...itTitle,fontSize:12}}>{co.titre}</div><div style={itSub}>{co.detail}</div></div>
              </div>
            ))}
          </div>
        )}

        {vosSeances.length>0&&(
          <div style={sectStyle}>
            <div style={labelStyle}>Vos prochaines séances — ancrage RNCP</div>
            {vosSeances.map((s,i)=>(
              <div key={i} style={item}>
                <div style={dot(true)}/>
                <div><div style={itTitle}>{s.titre}</div><div style={itSub}>{s.sub}</div><div>{(s.competences||[]).map(cp=><span key={cp} style={pill}>{cp}</span>)}</div></div>
              </div>
            ))}
          </div>
        )}

        {quiDautre.length>0&&(
          <div style={sectStyle}>
            <div style={labelStyle}>Qui d'autre intervient ce mois-ci</div>
            {quiDautre.map((q,i)=>(
              <div key={i} style={item}>
                <div style={dot(true)}/>
                <div><div style={itTitle}>{q.intervenant} — {q.module}</div><div style={itSub}>{q.date} · {q.competence?<span style={pill}>{q.competence}</span>:null} {q.detail}</div></div>
              </div>
            ))}
          </div>
        )}

        <div style={{background:D.petrole,padding:'1.25rem 1.75rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem'}}>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',lineHeight:1.5}}>Répondre à ce mail = contacter {fr} directement.<br/>Atlas des compétences · Éminéo · {titre}</div>
          <button disabled title="Validation disponible prochainement"
            style={{background:'rgba(93,226,152,0.35)',color:'rgba(11,43,45,0.5)',border:'none',borderRadius:6,padding:'9px 20px',fontWeight:700,fontSize:13,cursor:'not-allowed',whiteSpace:'nowrap'}}>
            ✓ Valider et envoyer
          </button>
        </div>
      </div>
      <p style={{textAlign:'center',fontSize:11,color:P.textl,marginTop:'0.75rem'}}>La validation et l'envoi seront activés dans une prochaine version.</p>
    </>
  )
}

/* ═══ APP ROOT ══════════════════════════════════════════════════════════════ */
export default function App(){
  const [user,setUser]=useState(null)
  const [checking,setChecking]=useState(true)
  useEffect(()=>{
    const token=getToken()
    if(!token){setChecking(false);return}
    api.me().then(d=>setUser(d.user)).catch(()=>clearToken()).finally(()=>setChecking(false))
  },[])
  function handleLogout(){api.logout().catch(()=>{});clearToken();setUser(null)}
  if(checking)return <div style={{minHeight:'100vh',background:`linear-gradient(135deg,${P.abysse},${P.petrole})`,display:'flex',alignItems:'center',justifyContent:'center'}}><Spinner size={32}/></div>
  if(!user)return <LoginPage onLogin={u=>setUser(u)}/>
  if(user.role==='dir')        return <VueDir user={user} onLogout={handleLogout}/>
  if(user.role==='rp')         return <VueRP user={user} onLogout={handleLogout}/>
  if(user.role==='fr')         return <VueFR user={user} onLogout={handleLogout}/>
  if(user.role==='intervenant')return <VueIntervenant user={user} onLogout={handleLogout}/>
  if(user.role==='etudiant')   return <VueEtudiant user={user} onLogout={handleLogout}/>
  return <div>Rôle inconnu : {user.role}</div>
}
