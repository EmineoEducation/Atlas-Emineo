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
  // Liens sémantiques réels entre blocs.
  // Auparavant : anneau reliant chaque bloc au suivant dans l'ordre du tableau.
  // Ce tracé ne portait aucune information — il dessinait un cercle quel que
  // soit le contenu. Un lien signifie désormais qu'au moins une notion clé est
  // travaillée dans les deux blocs, et son épaisseur compte ces notions
  // partagées, conformément à l'intention d'origine (épaisseur = fréquence de
  // résonance). Sans notion commune : aucun trait, ce qui est une information.
  const normNotion=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()
  const notionsParBloc=nodes.map(n=>{
    const set=new Set()
    ;(n.modules||[]).forEach(m=>(m.notions_cles||[]).forEach(k=>{const v=normNotion(k);if(v.length>2)set.add(v)}))
    return set
  })
  const links=[]
  for(let i=0;i<nodes.length;i++){
    for(let j=i+1;j<nodes.length;j++){
      let partagees=0
      notionsParBloc[i].forEach(v=>{if(notionsParBloc[j].has(v))partagees++})
      if(partagees>0) links.push({a:nodes[i].id,b:nodes[j].id,w:Math.min(1+partagees*1.2,6),n:partagees})
    }
  }
  const draw=useCallback(()=>{
    const cv=cvRef.current;if(!cv)return
    const w=cv.width=cv.parentElement.clientWidth,h=cv.height=400
    const ctx=cv.getContext('2d');ctx.clearRect(0,0,w,h)
    links.forEach(l=>{
      const a=nodes.find(n=>n.id===l.a),b=nodes.find(n=>n.id===l.b);if(!a||!b)return
      ctx.beginPath();ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h)
      ctx.strokeStyle=`rgba(19,69,71,${Math.min(0.10+(l.n||1)*0.06,0.38)})`;ctx.lineWidth=l.w;ctx.stroke()
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
      <div style={{position:'absolute',bottom:8,left:10,fontSize:10,color:P.textl}}>{links.length?'Trait = notion commune · épaisseur = nombre de notions partagées':'Aucune notion partagée entre blocs — ingérer les syllabi'}</div>
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
  const [atelierOpen,setAtelierOpen]=useState(false)
  const [onglet,setOnglet]=useState('formations')
  const [formations,setFormations]=useState([])
  const [loading,setLoading]=useState(true)
  const [files,setFiles]=useState([])
  const [nomFormation,setNomFormation]=useState('')
  const [typeDoc,setTypeDoc]=useState('pf')        // 'pf' | 'syllabus' | 'race'
  const [ciblesSel,setCiblesSel]=useState([])      // ids de promotions visées
  const [rapport,setRapport]=useState(null)
  const [ingLoading,setIngLoading]=useState(false)
  const [progress,setProgress]=useState('')
  const [error,setError]=useState('')
  const [selF,setSelF]=useState(null)
  const [editCampus,setEditCampus]=useState(null)   // _id de la formation en cours d'édition campus
  const [digestData,setDigestData]=useState(null)
  const [digestLoading,setDigestLoading]=useState(false)
  const [generating,setGenerating]=useState(false)
  const [genError,setGenError]=useState('')

  useEffect(()=>{loadFormations()},[])
  async function loadFormations(){
    try{const d=await api.getFormations();setFormations(d.formations);setLoading(false)}catch(e){setError(e.message);setLoading(false)}
  }
  async function lireTexte(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsText(file,'utf-8')})}

  // Ingestion vers des promotions pre-creees.
  // Le PF pose la structure et se ventile sur les deux annees d'un Mastere ;
  // les syllabi et le RACE viennent ensuite l'enrichir sans jamais l'ecraser.
  async function handleIngestion(){
    if(!files.length||!ciblesSel.length)return
    setIngLoading(true);setError('');setRapport(null);setProgress('Lecture des fichiers…')
    try{
      const textes=await Promise.all(files.map(f=>lireTexte(f)))
      setProgress(typeDoc==='pf'?'Analyse du plan de formation…':typeDoc==='race'?'Analyse du référentiel…':'Analyse des syllabi…')
      const data=await ingererDocuments(textes,'Le Mans',setProgress,typeDoc)
      if(nomFormation.trim()&&data.formation)data.formation.titre=nomFormation.trim()
      const cibles=ciblesSel.map(id=>{
        const f=formations.find(x=>x._id===id)
        const tc=f?.titre_court||f?._titre_court||''
        return {id,cycle:(tc.split(' ')[0]||'').toUpperCase()}
      })
      setProgress(cibles.length>1?'Ventilation sur les promotions…':'Enregistrement…')
      const r=await api.alimenterPromotions(cibles,data,typeDoc)
      setRapport(r.rapport||null)
      setProgress('Terminé ✓');setFiles([]);setNomFormation('')
      await loadFormations()
    }catch(e){setError('Erreur : '+(e&&e.message?e.message:String(e)))}finally{setIngLoading(false)}
  }

  async function handleDelete(id){
    if(!confirm('Supprimer cette formation ?'))return
    try{await api.deleteFormation(id);await loadFormations();if(selF?._id===id)setSelF(null)}catch(e){setError(e.message)}
  }

  function premierCampus(f){
    if(!f)return ''
    const c=f._campus
    if(Array.isArray(c))return c[0]||''
    try{const p=JSON.parse(c);if(Array.isArray(p))return p[0]||''}catch(_){}
    return (c||'').split(',')[0].trim()
  }

  async function loadDigest(fId){
    if(!fId)return
    setDigestLoading(true)
    try{const d=await api.getFR(fId);setDigestData(d)}catch(e){setError(e.message)}finally{setDigestLoading(false)}
  }

  async function genererDigestDir(){
    if(!fCarto)return
    setGenerating(true);setGenError('')
    try{
      await api.generateDigest(fCarto._id,premierCampus(fCarto))
      await loadDigest(fCarto._id)
    }catch(e){setGenError(e.message)}finally{setGenerating(false)}
  }

  async function validerEnvoyerDir(noteFr){
    if(!digestData?.digest)return
    await api.validerEnvoyerDigest(digestData.digest.id,noteFr)
    await loadDigest(fCarto._id)
  }

  const totalAlertes=formations.flatMap(f=>f.alertes_detectees||[]).length
  const fCarto=selF||formations[0]||null

  useEffect(()=>{ if(onglet==='digest'&&fCarto) loadDigest(fCarto._id) },[onglet,fCarto?._id])

  // La Direction peut ouvrir le poste de travail L'Atelier (même écran que le
  // Formateur Référent — l'API autorise déjà 'dir' sur toutes les actions FR).
  if(atelierOpen) return <VueFR user={user} onLogout={onLogout} onRetour={()=>setAtelierOpen(false)}/>

  return(
    <div style={{minHeight:'100vh',background:P.givre}}>
      <Topbar user={user} formationTitre="Direction des programmes" onLogout={onLogout} onglet={onglet} setOnglet={setOnglet}
        onglets={[{id:'formations',label:'Formations'},{id:'ingestion',label:'+ Ingestion'},{id:'cartographie',label:'Cartographie'},{id:'digest',label:'Digest'},{id:'alertes',label:`Alertes (${totalAlertes})`},{id:'comptes',label:'Comptes'}]}/>
      <div style={{maxWidth:960,margin:'0 auto',padding:'2rem 1.5rem'}}>

        <button onClick={()=>setAtelierOpen(true)}
          style={{width:'100%',display:'flex',alignItems:'center',gap:14,background:P.abysse,color:P.givre,border:'none',borderRadius:14,padding:'16px 20px',marginBottom:'1.5rem',cursor:'pointer',textAlign:'left'}}>
          <span style={{fontFamily:"'DM Serif Display',serif",fontSize:19,color:P.menthe,flexShrink:0}}>L'Atelier</span>
          <span style={{flex:1}}>
            <span style={{display:'block',fontSize:13,fontWeight:600}}>Ouvrir le poste de travail</span>
            <span style={{display:'block',fontSize:11.5,color:'rgba(227,255,240,.5)',marginTop:2}}>Cartographie · comparateur · digest — le mois en 3 temps</span>
          </span>
          <span style={{fontSize:16,color:P.menthe,flexShrink:0}}>→</span>
        </button>

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
            <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:24,marginBottom:'0.4rem'}}>Alimenter une promotion</h2>
            <p style={{fontSize:13,color:P.textm,marginBottom:'1.5rem',lineHeight:1.7}}>
              Les sept promotions du Mans sont déjà créées. Le plan de formation pose la structure et se répartit sur les deux années ; les syllabi et le RACE viennent ensuite l'enrichir.
            </p>

            {/* Nature du document */}
            <div style={card({marginBottom:'1rem'})}>
              <div style={{fontSize:12,fontWeight:600,color:P.abysse,marginBottom:'0.6rem'}}>1 · Nature du document</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem',marginBottom:'0.6rem'}}>
                {[{v:'pf',l:'Plan de formation'},{v:'syllabus',l:'Syllabi'},{v:'race',l:'RACE'}].map(({v,l})=>{
                  const sel=typeDoc===v
                  return <button key={v} onClick={()=>{setTypeDoc(v);setRapport(null)}}
                    style={{padding:'6px 16px',borderRadius:20,fontSize:13,border:`1px solid ${sel?P.borderm:P.border}`,background:sel?'rgba(93,226,152,0.12)':P.surface,color:sel?P.petrole:P.textm,fontWeight:sel?600:400,cursor:'pointer',transition:'all 0.15s'}}>{l}</button>
                })}
              </div>
              <div style={{fontSize:12,color:P.textm,lineHeight:1.6}}>
                {typeDoc==='pf'&&"Donne la liste des modules et leur année. Remplace la structure de la promotion visée."}
                {typeDoc==='syllabus'&&"Donne le détail d'un module déjà créé : séances, notions, compétences. N'écrase pas le plan de formation."}
                {typeDoc==='race'&&"Donne la grille de certification : blocs, compétences, critères. Ne crée aucun module."}
              </div>
            </div>

            {/* Promotions visées */}
            <div style={card({marginBottom:'1rem'})}>
              <div style={{fontSize:12,fontWeight:600,color:P.abysse,marginBottom:'0.6rem'}}>2 · Promotion(s) alimentée(s)</div>
              {formations.length===0
                ? <div style={{fontSize:12,color:P.textm}}>Aucune promotion en base — lancer /api/setup.</div>
                : <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem'}}>
                    {formations.map(f=>{
                      const tc=f._titre_court||f.formation?.titre||'?'
                      const sel=ciblesSel.includes(f._id)
                      const nbMod=(f.blocs||[]).reduce((n,b)=>n+((b.modules||[]).length),0)
                      return <button key={f._id} onClick={()=>setCiblesSel(p=>sel?p.filter(x=>x!==f._id):[...p,f._id])}
                        style={{padding:'6px 14px',borderRadius:20,fontSize:13,border:`1px solid ${sel?P.borderm:P.border}`,background:sel?'rgba(93,226,152,0.12)':P.surface,color:sel?P.petrole:P.textm,fontWeight:sel?600:400,cursor:'pointer',transition:'all 0.15s'}}>
                        {tc}<span style={{fontSize:11,opacity:0.7,marginLeft:6}}>{nbMod?nbMod+' mod.':'vide'}</span>
                      </button>
                    })}
                  </div>}
              {typeDoc==='pf'&&ciblesSel.length>1&&(
                <div style={{fontSize:12,color:P.petrole,marginTop:'0.6rem',lineHeight:1.6}}>
                  Ventilation : chaque module ira vers l'année indiquée dans le document. Ceux dont l'année n'est pas déterminable seront listés à part, sans être rattachés.
                </div>
              )}
              {typeDoc!=='pf'&&ciblesSel.length>1&&(
                <div style={{fontSize:12,color:P.amber,marginTop:'0.6rem',lineHeight:1.6}}>
                  Un syllabus ou un RACE s'applique à une promotion à la fois — le même contenu sera appliqué à chacune des promotions cochées.
                </div>
              )}
            </div>

            {/* Nom de la formation */}
            <div style={card({marginBottom:'1rem'})}>
              <div style={{fontSize:12,fontWeight:600,color:P.abysse,marginBottom:'0.5rem'}}>3 · Intitulé <span style={{fontWeight:400,color:P.textm}}>(optionnel — prioritaire sur l'intitulé extrait)</span></div>
              <input value={nomFormation} onChange={e=>setNomFormation(e.target.value)} placeholder="Laisser vide pour conserver l'intitulé de la promotion"
                style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:8,padding:'0.6rem 0.8rem',fontSize:13,color:P.abysse,outline:'none',boxSizing:'border-box'}}/>
            </div>

            {/* Zone de dépôt */}
            <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();setFiles(prev=>[...prev,...Array.from(e.dataTransfer.files)])}} onClick={()=>document.getElementById('fi2').click()}
              style={{border:`2px dashed ${P.borderm}`,borderRadius:16,padding:'2.5rem 2rem',textAlign:'center',background:'rgba(93,226,152,0.04)',marginBottom:'1rem',cursor:'pointer'}}>
              <input id="fi2" type="file" multiple accept=".txt,.md,.csv,.pdf,.docx,.xlsx" style={{display:'none'}} onChange={e=>setFiles(prev=>[...prev,...Array.from(e.target.files)])}/>
              <div style={{fontSize:28,marginBottom:'0.6rem',opacity:0.45}}>📄</div>
              <div style={{fontSize:14,fontWeight:500,color:P.petrole}}>4 · Glisser-déposer ou cliquer</div>
              <div style={{fontSize:12,color:P.textm}}>.md .txt .pdf .docx .xlsx</div>
            </div>

            {files.length>0&&<div style={{marginBottom:'1rem'}}>{files.map((f,i)=><div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0.5rem 0.75rem',background:P.surface,borderRadius:8,border:`1px solid ${P.border}`,marginBottom:'0.35rem'}}><div style={{fontSize:13,fontWeight:500,color:P.abysse}}>{f.name} <span style={{fontSize:11,color:P.textm}}>({(f.size/1024).toFixed(1)} Ko)</span></div><button onClick={()=>setFiles(prev=>prev.filter((_,j)=>j!==i))} style={{color:P.red,fontSize:16,cursor:'pointer'}}>×</button></div>)}</div>}

            <button onClick={handleIngestion} disabled={ingLoading||!files.length||!ciblesSel.length}
              style={{width:'100%',padding:'0.9rem',borderRadius:10,fontSize:14,fontWeight:600,border:'none',transition:'all 0.2s',cursor:(!ingLoading&&files.length&&ciblesSel.length)?'pointer':'not-allowed',
                background:(!ingLoading&&files.length&&ciblesSel.length)?`linear-gradient(135deg,${P.petrole},${P.menthe})`:'rgba(19,69,71,0.08)',color:(!ingLoading&&files.length&&ciblesSel.length)?P.abysse:P.textm}}>
              {ingLoading?<span style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem'}}><Spinner size={16}/>{progress}</span>:'Analyser avec Claude →'}
            </button>

            {error&&<div style={{marginTop:'1rem',padding:'0.75rem 1rem',background:P.redbg,border:`1px solid ${P.red}`,borderRadius:8,fontSize:12,color:'#8B1A1A'}}>{error}</div>}

            {/* Rapport d'ingestion — ce qui est passé, et surtout ce qui ne l'est pas */}
            {rapport&&(
              <div style={card({marginTop:'1rem'})}>
                <div style={{fontSize:12,fontWeight:600,color:P.abysse,marginBottom:'0.6rem'}}>Rapport d'ingestion</div>
                {(rapport.cibles||[]).map((c,i)=>(
                  <div key={i} style={{fontSize:13,color:P.abysse,padding:'0.35rem 0',borderBottom:`1px solid ${P.border}`}}>
                    <strong>{c.promotion}</strong>
                    {c.modules!==undefined&&<span style={{color:P.textm}}> — {c.modules} module(s), {c.blocs} bloc(s)</span>}
                    {c.modules_rapproches!==undefined&&<span style={{color:P.textm}}> — {c.modules_rapproches} module(s) enrichi(s), {c.modules_non_rapproches} sans correspondance</span>}
                  </div>
                ))}
                {(rapport.non_ventiles||[]).length>0&&(
                  <div style={{marginTop:'0.75rem',padding:'0.6rem 0.8rem',background:P.amberbg,border:`1px solid ${P.amber}`,borderRadius:8,fontSize:12,color:'#7A4E06',lineHeight:1.6}}>
                    <strong>{rapport.non_ventiles.length} module(s) sans année identifiable</strong> — non rattachés : {rapport.non_ventiles.join(' · ')}.
                    <div style={{marginTop:4}}>Faire apparaître l'année sur ces lignes du plan de formation, puis redéposer.</div>
                  </div>
                )}
                {(rapport.non_rapproches||[]).length>0&&(
                  <div style={{marginTop:'0.75rem',padding:'0.6rem 0.8rem',background:P.amberbg,border:`1px solid ${P.amber}`,borderRadius:8,fontSize:12,color:'#7A4E06',lineHeight:1.6}}>
                    <strong>{rapport.non_rapproches.length} module(s) sans correspondance dans le plan de formation</strong> : {rapport.non_rapproches.map(x=>x.module).join(' · ')}.
                    <div style={{marginTop:4}}>Placés en attente. Soit l'intitulé diverge du plan, soit le module en est absent.</div>
                  </div>
                )}
              </div>
            )}
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

        {onglet==='digest'&&(
          <div className="fi">
            {formations.length===0?<Empty icon="✉" titre="Aucune formation" msg="Chargez une formation d'abord." action="Ingestion →" onClick={()=>setOnglet('ingestion')}/>:<>
              {formations.length>1&&<div style={{display:'flex',gap:'0.4rem',marginBottom:'1rem',flexWrap:'wrap'}}>{formations.map(f=><button key={f._id} onClick={()=>setSelF(f)} style={{padding:'5px 14px',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer',border:`1px solid ${fCarto?._id===f._id?P.borderm:P.border}`,background:fCarto?._id===f._id?'rgba(93,226,152,0.12)':P.surface,color:fCarto?._id===f._id?P.petrole:P.textm}}>{f.formation?.titre||'?'}</button>)}</div>}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'1rem'}}>
                <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,margin:0,fontSize:22}}>{fCarto?.formation?.titre||'Digest'}</h2>
                <button onClick={genererDigestDir} disabled={generating}
                  style={{background:P.petrole,color:P.givre,border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:500,cursor:'pointer',opacity:generating?0.6:1,display:'flex',alignItems:'center',gap:'0.5rem'}}>
                  {generating?<Spinner size={14}/>:null}{digestData?.digest?'↻ Régénérer le digest':'Générer le digest du mois'}
                </button>
              </div>
              {genError&&<div style={{...card(),border:`1px solid ${P.red}`,color:'#8B1A1A',fontSize:12,marginBottom:'1rem'}}>⚠ {genError}</div>}
              {digestLoading?<div style={{textAlign:'center',padding:'2rem'}}><Spinner/></div>:
                !digestData?.digest?(
                  <Empty icon="✉" titre="Aucun digest généré" msg="Générez le digest du mois pour ce titre — il s'appuie sur les séances déclarées de la période en cours."/>
                ):(
                  <DigestPreview digest={digestData.digest} titre={fCarto?.formation?.titre||''} campus={premierCampus(fCarto)} fr={`${user.prenom} ${user.nom} (Direction)`} onValiderEnvoyer={validerEnvoyerDir}/>
                )
              }
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
  const [atelierOpen,setAtelierOpen]=useState(false)
  const [onglet,setOnglet]=useState('formations')
  const [formations,setFormations]=useState([])
  const [loading,setLoading]=useState(true)
  const [selF,setSelF]=useState(null)

  useEffect(()=>{api.getFormations().then(d=>{setFormations(d.formations);setLoading(false)}).catch(()=>setLoading(false))},[])
  const f=selF||formations[0]||null
  const alertes=f?.alertes_detectees||[]

  if(atelierOpen) return <VueFR user={user} onLogout={onLogout} onRetour={()=>setAtelierOpen(false)}/>

  return(
    <div style={{minHeight:'100vh',background:P.givre}}>
      <Topbar user={user} formationTitre={f?.formation?.titre||''} onLogout={onLogout} onglet={onglet} setOnglet={setOnglet}
        onglets={[{id:'formations',label:'Mes formations'},{id:'cartographie',label:'Cartographie'},{id:'blocs',label:'Blocs'},{id:'alertes',label:`Alertes (${alertes.length})`},{id:'comptes',label:'Comptes'}]}/>
      <div style={{maxWidth:960,margin:'0 auto',padding:'1.5rem'}}>
        <button onClick={()=>setAtelierOpen(true)}
          style={{width:'100%',display:'flex',alignItems:'center',gap:14,background:P.abysse,color:P.givre,border:'none',borderRadius:14,padding:'16px 20px',marginBottom:'1.5rem',cursor:'pointer',textAlign:'left'}}>
          <span style={{fontFamily:"'DM Serif Display',serif",fontSize:19,color:P.menthe,flexShrink:0}}>L'Atelier</span>
          <span style={{flex:1}}>
            <span style={{display:'block',fontSize:13,fontWeight:600}}>Ouvrir le poste de travail</span>
            <span style={{display:'block',fontSize:11.5,color:'rgba(227,255,240,.5)',marginTop:2}}>Cartographie · comparateur · digest — le mois en 3 temps</span>
          </span>
          <span style={{fontSize:16,color:P.menthe,flexShrink:0}}>→</span>
        </button>
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
/* ═══ L'ATELIER — design system partagé (FR + Intervenant) ═══════════════════
   Porté depuis la proposition retenue (Claude Design, session du 26/07/2026).
   Mapping de rôle : le "Responsable pédagogique" de la maquette correspond au
   rôle FR en prod (seul rôle habilité à générer/valider/envoyer le digest,
   cf api/fr.js). Le RP réel (vue campus, tous titres confondus) et Dir restent
   sur l'ancienne UI pour l'instant — la maquette ne les couvrait pas. */
const AT = {
  ok:P.menthe,
  warn:P.saumon, warnText:'#B5643C', warnBg:'#FDF1EB',
  idle:'#B9C6C3', idleText:'#8CA8A4', idleText2:'#7FA09C',
}
function atTag(st){
  const fg = st==='ok'?P.petrole : st==='warn'?AT.warnText : AT.idleText2
  const bg = st==='ok'?P.givre : st==='warn'?AT.warnBg : '#F0F4F3'
  return {fontSize:10,fontWeight:700,letterSpacing:'.04em',padding:'3px 9px',borderRadius:20,flexShrink:0,color:fg,background:bg}
}
function atDot(st){
  const c = st==='ok'?AT.ok : st==='warn'?AT.warn : AT.idle
  return {width:7,height:7,borderRadius:'50%',flexShrink:0,background:c}
}
function moduleToBlocMap(blocs){
  const m={}
  ;(blocs||[]).forEach(b=>(b.modules||[]).forEach(mod=>{m[mod.id]=b.id}))
  return m
}
function normCode(c){ return String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'') }

/* Libellés des 4 états du comparateur prévu/réalisé (cf api/fr.js
   calculerDelta). 'ecart_moins' a été ajouté le 25/08/2026 : une séance dont
   le contenu annoncé n'a pas été couvert s'affichait auparavant « Conforme ». */
function etatLabel(etat){
  if(etat==='nominal')    return 'Conforme'
  if(etat==='ecart_plus') return 'Écart +'
  if(etat==='ecart_moins')return 'Écart −'
  return 'Non déclarée'
}
function abregeMois(label){
  if(!label) return ''
  const [mois,annee]=label.split(' ')
  if(!mois) return label
  return mois.slice(0,3).charAt(0).toUpperCase()+mois.slice(1,3)+'. '+(annee||'')
}
const STOPWORDS=new Set(['de','du','des','la','le','les','et','en','pour','au','aux','d','l','un','une','à','the','of'])
function titreCourt(titre){
  if(!titre) return '—'
  const mots=titre.split(/\s+/).filter(w=>w && !STOPWORDS.has(w.toLowerCase().replace(/[^a-zà-ÿ]/gi,'')))
  const sigle=mots.map(w=>w[0]).join('').toUpperCase().slice(0,6)
  return sigle.length>=2?sigle:titre.slice(0,10)
}
function fmtCourt(iso){
  if(!iso) return '—'
  try{return new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}catch(_){return iso}
}

/* Cartographie hub-et-satellites — généralisée à N blocs (la maquette avait
   4 coordonnées fixes ; ici on répartit les blocs en cercle autour du hub). */
function Cartographie2({blocs,mode,sel,onSelect,titre}){
  const deploy = mode==='deploiement'
  const n = blocs.length||1
  const cx=430, cy=235, R=225, W=860, H=510
  const positioned = blocs.map((b,i)=>{
    const a = -Math.PI*0.75 + i*(2*Math.PI/n)
    return {...b, x:+(cx+Math.cos(a)*R).toFixed(1), y:+(cy+Math.sin(a)*R).toFixed(1)}
  })
  const C = 2*Math.PI*52
  return (
    <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 18px',borderBottom:`1px solid ${P.border}`,flexWrap:'wrap',gap:8}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:P.petrole}}>Cartographie du titre</div>
        <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
          {(deploy?[{c:AT.ok,t:'conforme'},{c:AT.warn,t:'anomalie'},{c:AT.idle,t:'non entamé'}]:[{c:'#FFFFFF',t:'compétence prévue'},{c:'#CBDCD7',t:'lien inter-blocs'}]).map(l=>(
            <span key={l.t} style={{display:'flex',alignItems:'center',gap:6,fontSize:10.5,color:P.textm}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:l.c,border:`1px solid ${P.border}`,display:'inline-block'}}/>{l.t}
            </span>
          ))}
        </div>
      </div>
      <div style={{position:'relative',background:'#FBFEFC'}}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{display:'block',width:'100%',height:'auto'}}>
          {positioned.map(b=>(
            <line key={'l'+b.id} x1={cx} y1={cy} x2={b.x} y2={b.y} stroke={deploy?'#DCE9E4':'transparent'} strokeWidth={1.5} strokeDasharray={deploy?'none':'4 5'}/>
          ))}
          <circle cx={cx} cy={cy} r={52} fill={P.abysse}/>
          <text x={cx} y={cy-7} textAnchor="middle" fill={P.menthe} style={{font:"600 12px 'DM Sans'"}}>{titreCourt(titre)}</text>
          <text x={cx} y={cy+11} textAnchor="middle" fill="rgba(227,255,240,.5)" style={{font:"400 10px 'DM Sans'"}}>{blocs.length} bloc{blocs.length>1?'s':''}</text>
          {positioned.map(b=>{
            const col = b.st==='ok'?AT.ok:b.st==='warn'?AT.warn:AT.idle
            const nComp = b.comp||0
            const dots = Array.from({length:nComp},(_,i2)=>{
              const a = -Math.PI*0.78 + (Math.PI*1.56)*(nComp===1?0.5:i2/(nComp-1))
              const covered = deploy && i2 < Math.round(nComp*(b.pct||0)/100)
              return {x:+(b.x+Math.cos(a)*68).toFixed(1), y:+(b.y+Math.sin(a)*68).toFixed(1),
                fill: deploy?(covered?col:'#FFFFFF'):'#FFFFFF', stroke: deploy?col:'#CBDCD7'}
            })
            const fill = deploy?(b.st==='ok'?'#F1FCF6':b.st==='warn'?'#FDF6F2':'#F6F8F8'):'#FFFFFF'
            const stroke = deploy?col:'#C3D5D0'
            return (
              <g key={b.id} onClick={()=>onSelect({kind:'bloc',id:b.id})} style={{cursor:'pointer'}}>
                {dots.map((d,di)=><circle key={di} cx={d.x} cy={d.y} r={4.5} fill={d.fill} stroke={d.stroke} strokeWidth={1}/>)}
                {deploy&&<>
                  <circle cx={b.x} cy={b.y} r={52} fill="none" stroke="#EAF3EF" strokeWidth={5}/>
                  <circle cx={b.x} cy={b.y} r={52} fill="none" stroke={col} strokeWidth={5} strokeLinecap="round"
                    strokeDasharray={`${(C*(b.pct||0)/100).toFixed(1)} ${C.toFixed(1)}`} transform={`rotate(-90 ${b.x} ${b.y})`}/>
                </>}
                <circle cx={b.x} cy={b.y} r={45} fill={fill} stroke={stroke} strokeWidth={deploy?1:1.4} strokeDasharray={deploy?'none':'5 4'}/>
              </g>
            )
          })}
        </svg>
        {positioned.map(b=>(
          <div key={'lbl'+b.id}>
            <button onClick={()=>onSelect({kind:'bloc',id:b.id})} style={{position:'absolute',left:`${(b.x/W*100).toFixed(2)}%`,top:`${(b.y/H*100).toFixed(2)}%`,transform:'translate(-50%,-50%)',textAlign:'center',lineHeight:1.15,width:80,cursor:'pointer'}}>
              <span style={{fontSize:15,fontWeight:700,color:P.abysse,display:'block'}}>{b.id}</span>
              <span style={{display:'block',marginTop:2,fontSize:11,fontWeight:600,color:deploy?(b.st==='idle'?AT.idleText:b.st==='warn'?AT.warnText:P.petrole):AT.idleText}}>{deploy?(b.pct||0)+' %':(b.comp||0)+' comp.'}</span>
            </button>
            <div style={{position:'absolute',left:`${(b.x/W*100).toFixed(2)}%`,top:`${((b.y+92)/H*100).toFixed(2)}%`,transform:'translate(-50%,-50%)',width:190,textAlign:'center',pointerEvents:'none',fontSize:12,fontWeight:600,color:P.petrole,lineHeight:1.3}}>{b.titre}</div>
            {deploy&&b.anom>0&&(
              <div style={{position:'absolute',left:`${((b.x+38)/W*100).toFixed(2)}%`,top:`${((b.y-36)/H*100).toFixed(2)}%`,transform:'translate(-50%,-50%)',width:24,height:24,borderRadius:'50%',background:AT.warn,color:P.abysse,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>{b.anom}</div>
            )}
          </div>
        ))}
      </div>
      <div style={{padding:'10px 18px',borderTop:`1px solid ${P.border}`,fontSize:10.5,color:AT.idleText}}>
        {deploy?"Anneau = couverture réelle du bloc · satellites pleins = compétences couvertes · pastille = anomalies":"Contours pointillés = structure planifiée, aucune séance encore déclarée"}
      </div>
    </div>
  )
}

/* Arborescence "tiroir" — Babouchka rendu visible en permanence sur la page,
   jamais caché derrière un clic. */
function Arbre2({arbre,mode,open,toggle,sel,onSelect}){
  const deploy = mode==='deploiement'
  return (
    <div style={{display:'flex',flexDirection:'column',gap:26}}>
      {arbre.map(b=>{
        const o = open[b.id]!==false
        return (
          <section key={b.id}>
            <div style={{display:'flex',alignItems:'center',gap:12,paddingBottom:12}}>
              <button onClick={()=>toggle(b.id)} style={{width:26,height:26,borderRadius:8,background:P.abysse,color:P.menthe,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer'}}>{o?'▾':'▸'}</button>
              <button onClick={()=>onSelect({kind:'bloc',id:b.id})} style={{display:'flex',alignItems:'baseline',gap:10,textAlign:'left',cursor:'pointer'}}>
                <span style={{fontFamily:"'DM Serif Display',serif",fontSize:18,color:P.abysse}}>{b.id}</span>
                <span style={{fontSize:14,fontWeight:600,color:P.petrole}}>{b.titre}</span>
              </button>
              <span style={{flex:1,height:1,background:P.border}}/>
              <span style={{fontSize:11,color:P.textm,flexShrink:0}}>{b.meta}</span>
            </div>
            {o&&(
              <div style={{marginLeft:12,borderLeft:'2px solid #CFEBDD',paddingLeft:22,display:'flex',flexDirection:'column',gap:14}}>
                {b.modules.map(m=>(
                  <div key={m.id} style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:14,overflow:'hidden'}}>
                    <button onClick={()=>onSelect({kind:'module',id:m.id,data:m})} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 16px',textAlign:'left',cursor:'pointer'}}>
                      <span style={{flex:1}}>
                        <span style={{display:'block',fontSize:13.5,fontWeight:600,color:P.abysse}}>{m.titre}</span>
                        <span style={{display:'block',fontSize:11,color:AT.idleText,marginTop:3}}>{m.meta}</span>
                      </span>
                      <span style={atTag(deploy?m.st:'idle')}>{deploy?m.etat:'Planifié'}</span>
                    </button>
                    <div style={{padding:'2px 16px 14px'}}>
                      <div style={{fontSize:9.5,fontWeight:600,letterSpacing:'.13em',textTransform:'uppercase',color:AT.idleText,margin:'6px 0 8px'}}>Compétences associées</div>
                      <div style={{display:'flex',flexDirection:'column',gap:1}}>
                        {m.competences.map(c=>(
                          <button key={c.code} onClick={()=>onSelect({kind:'comp',id:m.id+c.code,data:c,mod:m.titre,bloc:b.id+' — '+b.titre})}
                            style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'7px 8px',borderRadius:8,background:sel?.kind==='comp'&&sel?.id===m.id+c.code?'#F1FCF6':'transparent',cursor:'pointer'}}>
                            <span style={atDot(deploy?c.st:'idle')}/>
                            <span style={{fontSize:11,fontWeight:600,color:P.petrole,width:44,flexShrink:0,textAlign:'left'}}>{c.code}</span>
                            <span style={{flex:1,textAlign:'left',fontSize:12,color:P.abysse}}>{c.label}</span>
                            <span style={atTag(deploy?c.st:'idle')}>{deploy?c.statut:'Prévue'}</span>
                          </button>
                        ))}
                      </div>
                      {m.seances.length>0&&<>
                        <div style={{fontSize:9.5,fontWeight:600,letterSpacing:'.13em',textTransform:'uppercase',color:AT.idleText,margin:'14px 0 8px'}}>{deploy?'Séances déclarées':'Séances prévues'}</div>
                        <div style={{display:'flex',flexDirection:'column',gap:6}}>
                          {m.seances.map((s,si)=>(
                            <button key={si} onClick={()=>onSelect({kind:'seance',id:m.id+s.date,data:s})}
                              style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,background:sel?.kind==='seance'&&sel?.id===m.id+s.date?'#F1FCF6':'#F7FBF9',cursor:'pointer'}}>
                              <span style={{fontSize:11,color:AT.idleText,width:52,flexShrink:0,textAlign:'left'}}>{s.date}</span>
                              <span style={{flex:1,textAlign:'left',fontSize:12,color:P.abysse}}>{s.titre}</span>
                              <span style={atTag(deploy?s.st:'idle')}>{deploy?s.etat:'prévue'}</span>
                            </button>
                          ))}
                        </div>
                      </>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}

/* Inspecteur — panneau persistant à droite, jamais un modal : la sélection
   courante (bloc, module, compétence, séance) s'y affiche systématiquement. */
function Inspecteur({insp}){
  return (
    <aside style={{background:P.surface,borderLeft:`1px solid ${P.border}`,overflowY:'auto',display:'flex',flexDirection:'column',width:336,flexShrink:0}}>
      <div style={{padding:'20px 22px 14px',borderBottom:`1px solid ${P.border}`,position:'sticky',top:0,background:P.surface,zIndex:3}}>
        <div style={{fontSize:9.5,letterSpacing:'.16em',textTransform:'uppercase',color:AT.idleText}}>Inspecteur</div>
        <div style={{fontSize:11,color:P.textm,marginTop:5,lineHeight:1.5}}>Sélectionnez un bloc, un module, une compétence ou une séance.</div>
      </div>
      <div key={insp.key} style={{padding:'20px 22px 30px',animation:'fadeIn .22s ease'}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:7,padding:'4px 10px',borderRadius:20,background:P.givre,marginBottom:12}}>
          <span style={atDot(insp.st)}/>
          <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'.11em',textTransform:'uppercase',color:P.petrole}}>{insp.kind}</span>
        </div>
        <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:20,lineHeight:1.25,color:P.abysse,margin:0}}>{insp.titre}</h2>
        <p style={{fontSize:12,color:P.textm,lineHeight:1.6,marginTop:8}}>{insp.desc}</p>

        <div style={{display:'flex',flexDirection:'column',gap:1,marginTop:18,borderTop:`1px solid ${P.border}`}}>
          {(insp.lignes||[]).map((l,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,padding:'9px 0',borderBottom:`1px solid ${P.border}`}}>
              <span style={{fontSize:11,color:AT.idleText,flexShrink:0}}>{l.k}</span>
              <span style={{fontSize:12.5,fontWeight:600,textAlign:'right',color:l.warn?AT.warnText:P.abysse}}>{l.v}</span>
            </div>
          ))}
        </div>

        {insp.chips&&insp.chips.length>0&&(
          <div style={{marginTop:16}}>
            <div style={{fontSize:9.5,fontWeight:600,letterSpacing:'.13em',textTransform:'uppercase',color:AT.idleText,marginBottom:9}}>{insp.chipsLabel}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {insp.chips.map((c,i)=><span key={i} style={{fontSize:11,fontWeight:600,padding:'4px 10px',borderRadius:20,background:P.givre,color:P.petrole}}>{c}</span>)}
            </div>
          </div>
        )}

        {insp.alerte&&(
          <div style={{marginTop:18,background:AT.warnBg,border:'1px solid rgba(232,155,119,.45)',borderRadius:12,padding:14}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:P.saumon}}/>
              <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'.11em',textTransform:'uppercase',color:AT.warnText}}>{insp.alerte.titre}</span>
            </div>
            <div style={{fontSize:12,color:P.abysse,lineHeight:1.55}}>{insp.alerte.txt}</div>
          </div>
        )}

        {insp.actions&&insp.actions.length>0&&(
          <div style={{marginTop:18,display:'flex',flexDirection:'column',gap:7}}>
            {insp.actions.map((a,i)=>(
              <button key={i} onClick={a.go} style={{width:'100%',fontSize:12,fontWeight:600,padding:11,borderRadius:10,cursor:'pointer',border:'none',
                background:a.primary?P.abysse:P.givre, color:a.primary?P.menthe:P.petrole}}>{a.t}</button>
            ))}
          </div>
        )}

        {insp.toast&&<div style={{marginTop:14,background:P.abysse,color:P.menthe,fontSize:11.5,padding:'10px 13px',borderRadius:10,lineHeight:1.5}}>{insp.toast}</div>}
      </div>
    </aside>
  )
}

/* Rail gauche partagé — brand, titre, rôle, stepper "3 temps", pied de page. */
function RailAtelier({titre,campus,rncp,periodeLabel,onMois,formations,formationId,onFormation,tempsDefs,temps,setTemps,roleButtons,anomalieFooter,user,onLogout,onRetour}){
  return (
    <aside style={{background:P.abysse,display:'flex',flexDirection:'column',padding:'26px 22px 20px',gap:26,borderRight:'1px solid rgba(227,255,240,.08)',overflowY:'auto'}}>
      {onRetour&&(
        <button onClick={onRetour} style={{alignSelf:'flex-start',fontSize:11,fontWeight:600,color:P.menthe,background:'rgba(93,226,152,.10)',padding:'5px 11px',borderRadius:8,cursor:'pointer',marginBottom:-14}}>← Direction</button>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:21,color:P.givre,lineHeight:1}}>Atlas</div>
          <div style={{fontSize:10,letterSpacing:'.18em',textTransform:'uppercase',color:P.menthe,marginTop:7}}>L'Atelier · Éminéo</div>
        </div>
        <button onClick={onLogout} title={`Déconnexion — ${user.prenom} ${user.nom}`} style={{color:'rgba(227,255,240,.35)',fontSize:15,cursor:'pointer'}}>⏻</button>
      </div>
      <div style={{borderTop:'1px solid rgba(227,255,240,.09)',paddingTop:18}}>
        <div style={{fontSize:15,color:P.givre,fontWeight:600,lineHeight:1.35}}>{titre}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:10}}>
          {rncp&&<span style={{fontSize:9.5,fontWeight:600,letterSpacing:'.05em',color:P.menthe,background:'rgba(93,226,152,.12)',padding:'3px 8px',borderRadius:20}}>RNCP {rncp}</span>}
          {campus&&<span style={{fontSize:9.5,fontWeight:600,letterSpacing:'.05em',color:'rgba(227,255,240,.6)',background:'rgba(227,255,240,.07)',padding:'3px 8px',borderRadius:20}}>{campus}</span>}
          {periodeLabel&&(onMois?(
            <span style={{display:'inline-flex',alignItems:'center',gap:2,background:'rgba(227,255,240,.07)',borderRadius:20,padding:'1px 3px'}}>
              <button onClick={()=>onMois(-1)} title="Mois précédent" style={{color:'rgba(227,255,240,.55)',fontSize:12,padding:'2px 6px',cursor:'pointer',lineHeight:1}}>‹</button>
              <span style={{fontSize:9.5,fontWeight:600,letterSpacing:'.05em',color:'rgba(227,255,240,.78)',minWidth:54,textAlign:'center'}}>{periodeLabel}</span>
              <button onClick={()=>onMois(1)} title="Mois suivant" style={{color:'rgba(227,255,240,.55)',fontSize:12,padding:'2px 6px',cursor:'pointer',lineHeight:1}}>›</button>
            </span>
          ):(
            <span style={{fontSize:9.5,fontWeight:600,letterSpacing:'.05em',color:'rgba(227,255,240,.6)',background:'rgba(227,255,240,.07)',padding:'3px 8px',borderRadius:20}}>{periodeLabel}</span>
          ))}
        </div>
        {formations.length>1&&(
          <select value={formationId||''} onChange={e=>onFormation(Number(e.target.value))}
            style={{marginTop:10,width:'100%',fontSize:11,padding:'6px 8px',borderRadius:7,background:'rgba(227,255,240,.07)',color:P.givre,border:'1px solid rgba(227,255,240,.12)'}}>
            {formations.map(x=><option key={x._id} value={x._id} style={{color:'#000'}}>{x.formation?.titre||`Titre ${x._id}`}</option>)}
          </select>
        )}
      </div>

      {roleButtons&&(
        <div>
          <div style={{fontSize:9.5,letterSpacing:'.16em',textTransform:'uppercase',color:'rgba(227,255,240,.35)',marginBottom:9}}>Poste de travail</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {roleButtons.map(b=>(
              <button key={b.id} onClick={b.go} style={{display:'flex',flexDirection:'column',textAlign:'left',padding:'10px 12px',borderRadius:10,cursor:'pointer',border:'none',
                background:b.active?'rgba(93,226,152,.13)':'transparent', color:b.active?P.givre:'rgba(227,255,240,.55)'}}>
                <span style={{fontSize:12.5,fontWeight:600}}>{b.label}</span>
                <span style={{fontSize:10.5,opacity:.62,marginTop:2}}>{b.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{flex:1}}>
        <div style={{fontSize:9.5,letterSpacing:'.16em',textTransform:'uppercase',color:'rgba(227,255,240,.35)',marginBottom:11}}>Le mois en 3 temps</div>
        <div style={{display:'flex',flexDirection:'column',gap:2}}>
          {tempsDefs.map(t=>(
            <button key={t.id} onClick={()=>setTemps(t.id)} style={{display:'flex',alignItems:'flex-start',gap:11,padding:'11px 12px',borderRadius:11,textAlign:'left',cursor:'pointer',border:'none',
              background:temps===t.id?'rgba(93,226,152,.13)':'transparent', color:temps===t.id?P.givre:'rgba(227,255,240,.5)'}}>
              <span style={{width:20,height:20,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10.5,fontWeight:700,marginTop:1,
                background:temps===t.id?P.menthe:'rgba(227,255,240,.10)', color:temps===t.id?P.abysse:'rgba(227,255,240,.55)'}}>{t.num}</span>
              <span style={{display:'flex',flexDirection:'column',gap:2}}>
                <span style={{fontSize:12.5,fontWeight:600}}>{t.label}</span>
                <span style={{fontSize:10.5,opacity:.6,lineHeight:1.4}}>{t.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={{borderTop:'1px solid rgba(227,255,240,.09)',paddingTop:14,display:'flex',alignItems:'center',gap:9}}>
        <span style={{width:7,height:7,borderRadius:'50%',background:P.saumon,flexShrink:0}}/>
        <span style={{fontSize:10.5,color:'rgba(227,255,240,.5)',lineHeight:1.45}}>{anomalieFooter}</span>
      </div>
    </aside>
  )
}

/* En-tête central partagé. */
function HeaderAtelier({tempsNum,roleLabel,pageTitle,pageSub,stats}){
  return (
    <header style={{padding:'26px 34px 20px',borderBottom:`1px solid ${P.border}`,background:P.surface,position:'sticky',top:0,zIndex:5}}>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:24,flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:10,letterSpacing:'.16em',textTransform:'uppercase',color:P.textm,marginBottom:6}}>Temps {tempsNum} — {roleLabel}</div>
          <h1 style={{fontFamily:"'DM Serif Display',serif",fontSize:26,lineHeight:1.15,color:P.abysse,margin:0}}>{pageTitle}</h1>
          <p style={{fontSize:12.5,color:P.textm,marginTop:6,maxWidth:'60ch',lineHeight:1.55}}>{pageSub}</p>
        </div>
        <div style={{display:'flex',gap:22,flexShrink:0,paddingBottom:3}}>
          {stats.map((s,i)=>(
            <div key={i} style={{textAlign:'right'}}>
              <div style={{fontFamily:"'DM Serif Display',serif",fontSize:23,lineHeight:1,color:s.warn?AT.warnText:P.abysse}}>{s.v}</div>
              <div style={{fontSize:9.5,letterSpacing:'.08em',textTransform:'uppercase',color:AT.idleText,marginTop:2}}>{s.k}</div>
            </div>
          ))}
        </div>
      </div>
    </header>
  )
}

const TEMPS_DEFS = [
  {id:'plan',num:'1',label:'Plan de cours',sub:'Ce qui est prévu'},
  {id:'deploiement',num:'2',label:'Déploiement',sub:'Ce qui est réellement couvert'},
  {id:'digest',num:'3',label:'Digest',sub:'Ce qui part aux intervenants'},
]

/* ═══ VUE INTERVENANT — mes modules en arborescence (lecture seule) ══════════ */
function VueIntervenant({user,onLogout}){
  const [formations,setFormations]=useState([])
  const [formationId,setFormationId]=useState(null)
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [temps,setTemps]=useState('plan')
  const [sel,setSel]=useState({kind:null,id:null})
  const [open,setOpen]=useState({})

  useEffect(()=>{
    api.getFormations().then(d=>{
      setFormations(d.formations||[])
      const first=(d.formations||[])[0]
      if(first) setFormationId(first._id); else setLoading(false)
    }).catch(e=>{setError(e.message);setLoading(false)})
  },[])

  function reload(){
    if(!formationId) return
    setLoading(true);setError('')
    return api.getFR(formationId).then(d=>{setData(d);setLoading(false)}).catch(e=>{setError(e.message);setLoading(false)})
  }
  useEffect(()=>{ reload() },[formationId])

  const f=formations.find(x=>x._id===formationId)||null
  const titre=f?.formation?.titre||'Atlas des compétences'
  const campus=f?._campus||''
  const blocsRaw=f?.blocs||[]
  const prevues=data?.seances_prevues||[]   // déjà scopées à moi côté serveur (role=intervenant)
  const ecarts=data?.ecarts||[]
  const digest=data?.digest||null
  const norm = normCode
  const couvertes = new Set((data?.mes_competences_couvertes||[]).map(norm))
  const modulesEnseignes = new Set(prevues.map(s=>s.module_ref))
  const deploy = temps==='deploiement'

  // Arborescence limitée à mes modules — déduits de mes séances prévisionnelles
  // de la période. Limite connue : un module sans séance ce mois-ci n'apparaît
  // pas ici (portée volontairement mensuelle, cf doc de session).
  const arbre = blocsRaw.map(b=>{
    const mods=(b.modules||[]).filter(m=>modulesEnseignes.has(m.id))
    if(!mods.length) return null
    return {
      id:b.id, titre:b.titre,
      meta: deploy ? mods.length+' module(s) · '+mods.reduce((n,m)=>n+(m.competences_liees||[]).length,0)+' compétence(s)' : mods.length+' module(s) prévu(s)',
      modules: mods.map(m=>{
        const seancesM = prevues.filter(s=>s.module_ref===m.id)
        const ecartsM = ecarts.filter(e=>modulesEnseignes.has(m.id)&&e.module_ref===m.id)
        const anyWarn = ecartsM.some(e=>e.etat!=='nominal')
        const competences = (b.competences||[]).filter(c=>(m.competences_liees||[]).some(cl=>norm(cl)===norm(c.id))).map(c=>{
          const ok = couvertes.has(norm(c.id))
          return {code:c.id, label:c.libelle, statut: ok?'Couverte':'Non couverte', st: ok?'ok':'idle'}
        })
        return {
          id:m.id, titre:m.titre, meta: seancesM.length+' séance(s) ce mois-ci',
          etat: anyWarn?'À arbitrer':(seancesM.length?'Conforme':'Planifié'), st: anyWarn?'warn':'ok',
          competences,
          seances: ecartsM.map(e=>({date:fmtCourt(e.date_prevue), titre:e.titre,
            etat: etatLabel(e.etat),
            st: e.etat==='nominal'?'ok':'warn', data:e})),
        }
      }),
    }
  }).filter(Boolean)

  function toggle(id){ setOpen(s=>({...s,[id]:s[id]===false?true:false})) }
  const openState = {}; arbre.forEach(b=>{ openState[b.id] = open[b.id]!==false })

  function buildInsp(){
    if(temps==='digest'){
      return {kind:'Diffusion', st:'ok', titre:'Votre digest du mois',
        desc:"Vous recevrez ce digest par email une fois validé par votre Formateur Référent.",
        lignes:[{k:'Statut',v:digest?.statut==='envoye'?'Envoyé':'En attente de validation',warn:digest?.statut!=='envoye'}], key:'digest'}
    }
    if(sel.kind==='module'){
      const m=sel.data
      return {kind:'Module', st:deploy?m.st:'idle', titre:m.titre, desc:`${m.competences.length} compétence(s) associée(s).`,
        lignes:[{k:'État',v:deploy?m.etat:'Planifié',warn:m.st==='warn'&&deploy}],
        chipsLabel:'Compétences associées', chips:m.competences.map(c=>c.code), key:'mod'+sel.id}
    }
    if(sel.kind==='comp'){
      const c=sel.data
      return {kind:'Compétence', st:deploy?c.st:'idle', titre:c.code+' — '+c.label,
        desc:`Compétence du référentiel RNCP, rattachée au module « ${sel.mod||''} ».`,
        lignes:[{k:'Module',v:sel.mod||'—'},{k:'Bloc',v:sel.bloc||'—'},{k:'Statut',v:deploy?c.statut:'Prévue',warn:c.st==='idle'&&deploy}], key:'comp'+sel.id}
    }
    if(sel.kind==='seance'){
      const s=sel.data
      return {kind:'Séance', st:s.st||'ok', titre:(s.date||'')+' — '+(s.titre||''), desc:s.data?.detail||'',
        lignes:[{k:'État',v:s.etat,warn:s.st==='warn'}],
        alerte: s.st==='warn'?{titre:'Écart détecté',txt:s.data?.detail||''}:null, key:'seance'+sel.id}
    }
    return {kind:'Mes modules', st:'ok', titre, desc:'Sélectionnez un module, une compétence ou une séance.', lignes:[], key:'root'}
  }
  const insp = buildInsp()

  if(loading&&!data) return <div style={{minHeight:'100vh',background:P.abysse,display:'flex',alignItems:'center',justifyContent:'center'}}><Spinner/></div>
  if(error) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><Empty icon="⚠" titre="Erreur de chargement" msg={error}/></div>
  if(!f) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><Empty icon="📋" titre="Aucun titre" msg="Aucun titre ne vous est rattaché."/></div>

  const nbMod=arbre.reduce((n,b)=>n+b.modules.length,0)
  const nbComp=arbre.reduce((n,b)=>n+b.modules.reduce((m,mo)=>m+mo.competences.length,0),0)
  const nbAlertesInt=ecarts.filter(e=>modulesEnseignes.has(e.module_ref)&&e.etat!=='nominal').length
  const stats = temps==='digest'
    ? [{k:'statut',v:digest?.statut==='envoye'?'Envoyé':'En attente'}]
    : temps==='plan'
      ? [{k:'modules',v:String(nbMod)},{k:'compétences',v:String(nbComp)}]
      : [{k:'séances',v:String(ecarts.length)},{k:'à traiter',v:String(nbAlertesInt),warn:nbAlertesInt>0}]

  const pageTitles={
    plan:['Mes modules, tels qu\u2019ils sont prévus',"Vos blocs, modules et compétences associées — l\u2019arborescence est dépliée sur la page, rien n\u2019est caché derrière un clic."],
    deploiement:['Mes modules, séance après séance',"La même arborescence, augmentée du réel : statut de chaque compétence et de chaque séance déclarée."],
    digest:['Le digest que vous allez recevoir',"Écran verrouillé : UI de production, en lecture seule."],
  }
  const [pageTitle,pageSub]=pageTitles[temps]

  return (
    <div style={{display:'grid',gridTemplateColumns:'252px minmax(0,1fr) 336px',height:'100vh',width:'100%',minWidth:1280,background:P.abysse,overflow:'hidden',fontFamily:"'DM Sans',sans-serif"}}>
      <RailAtelier titre={titre} campus={campus} rncp={f?.formation?.rncp} periodeLabel={abregeMois(data?.periode?.label)} formations={formations} formationId={formationId}
        onFormation={id=>{setFormationId(id);setSel({kind:null,id:null})}} tempsDefs={TEMPS_DEFS} temps={temps} setTemps={setTemps}
        user={user} onLogout={onLogout} roleButtons={null}
        anomalieFooter={`${nbAlertesInt} anomalie${nbAlertesInt>1?'s':''} détectée${nbAlertesInt>1?'s':''} ce mois-ci`}/>

      <main style={{background:'#F4FBF7',overflowY:'auto',display:'flex',flexDirection:'column'}}>
        <HeaderAtelier tempsNum={TEMPS_DEFS.find(t=>t.id===temps).num} roleLabel="Intervenant" pageTitle={pageTitle} pageSub={pageSub} stats={stats}/>
        <div key={temps} style={{padding:'26px 34px 46px',animation:'fadeIn .28s ease'}} className="fi">
          {temps!=='digest'&&(
            arbre.length===0?(
              <Empty icon="📋" titre="Aucun module ce mois-ci" msg="Aucune séance prévisionnelle rattachée à votre compte pour ce titre, sur la période en cours."/>
            ):(
              <Arbre2 arbre={arbre} mode={temps} open={openState} toggle={toggle} sel={sel} onSelect={setSel}/>
            )
          )}
          {temps==='digest'&&(
            <div style={{maxWidth:640,margin:'0 auto'}}>
              {!digest?(
                <Empty icon="✉" titre="Digest non encore généré" msg="Votre Formateur Référent n'a pas encore généré le digest de ce mois."/>
              ):(
                <DigestPreview digest={digest} titre={titre} campus={campus} fr="votre Formateur Référent" readOnly/>
              )}
              <p style={{fontSize:11,color:AT.idleText,textAlign:'center',marginTop:14,lineHeight:1.6}}>Écran verrouillé — UI de production reprise telle quelle.</p>
            </div>
          )}
        </div>
      </main>

      <Inspecteur insp={insp}/>
    </div>
  )
}
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
/* ═══ VUE FORMATEUR RÉFÉRENT — poste de travail L'Atelier ════════════════════ */
function VueFR({user,onLogout,onRetour}){
  const [formations,setFormations]=useState([])
  const [formationId,setFormationId]=useState(null)
  const [data,setData]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [generating,setGenerating]=useState(false)
  const [genError,setGenError]=useState('')
  const [temps,setTemps]=useState('plan')
  const [viewRole,setViewRole]=useState('fr')
  const [sel,setSel]=useState({kind:null,id:null})
  const [toast,setToast]=useState(null)
  /* Mois consulté. Défaut : le mois en cours. Le FR doit pouvoir revenir sur le
     mois précédent (digest déjà parti, écarts arbitrés) sans attendre. */
  const [periode,setPeriode]=useState(()=>new Date().toISOString())
  function decalerMois(n){
    const d=new Date(periode)
    setPeriode(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,15)).toISOString())
    setSel({kind:null,id:null})
  }

  useEffect(()=>{
    api.getFormations().then(d=>{
      setFormations(d.formations||[])
      const first=(d.formations||[])[0]
      if(first) setFormationId(first._id); else setLoading(false)
    }).catch(e=>{setError(e.message);setLoading(false)})
  },[])

  function reload(){
    if(!formationId) return
    setLoading(true);setError('')
    return api.getFR(formationId,periode).then(d=>{setData(d);setLoading(false);return d}).catch(e=>{setError(e.message);setLoading(false)})
  }
  useEffect(()=>{ reload() },[formationId,periode])

  const f=formations.find(x=>x._id===formationId)||null
  const titre=f?.formation?.titre||'Atlas des compétences'
  const campus=f?._campus||''
  const blocsRaw=f?.blocs||[]
  const prevues=data?.seances_prevues||[]
  const ecarts=data?.ecarts||[]
  const digest=data?.digest||null
  const avancementBlocs=data?.avancement_blocs||[]
  /* Toute séance non conforme est une anomalie à arbitrer : non déclarée,
     écart + ou écart −. Avant le 25/08/2026 seul l'état 'alerte' était compté,
     si bien que le rail annonçait « 2 anomalies » pendant que le panneau
     « Anomalies à arbitrer » en listait 4. */
  const nbAlertes=ecarts.filter(e=>e.etat!=='nominal').length
  const nbNonDeclarees=ecarts.filter(e=>e.etat==='alerte').length
  const modToBloc=moduleToBlocMap(blocsRaw)
  const deploy = temps==='deploiement'

  async function genererDigest(){
    setGenerating(true);setGenError('')
    try{ await api.generateDigest(formationId,campus,periode); await reload(); setTemps('digest') }
    catch(e){ setGenError(e.message) } finally{ setGenerating(false) }
  }
  async function validerEnvoyer(noteFr){
    if(!digest) return
    await api.validerEnvoyerDigest(digest.id,noteFr)
    await reload()
  }

  const blocs = blocsRaw.map(b=>{
    const anomsBloc = ecarts.filter(e=>e.etat!=='nominal' && modToBloc[e.module_ref]===b.id)
    const quiSet = new Set(prevues.filter(s=>modToBloc[s.module_ref]===b.id).map(s=>s.intervenant_nom).filter(Boolean))
    const pct = avancementBlocs.find(a=>a.id===b.id)?.pct ?? 0
    const anom = anomsBloc.length
    const st = anom>0?'warn':(pct>0?'ok':'idle')
    return {id:b.id, titre:b.titre, comp:(b.competences||[]).length, mods:(b.modules||[]).length, pct, anom, st,
      qui: quiSet.size?Array.from(quiSet).join(' · '):'Non affecté',
      desc:`${(b.competences||[]).length} compétence(s) au référentiel de ce bloc.`}
  })

  const seancesJournal = ecarts.map(e=>({
    ...e, st: e.etat==='nominal'?'ok':'warn',
    etatLabel: etatLabel(e.etat),
    blocId: modToBloc[e.module_ref]||'—',
  }))
  const anomalies = seancesJournal.filter(s=>s.st==='warn')

  // Aperçu "vue intervenant" — arborescence tous modules confondus (FR n'a pas
  // de personne unique à prévisualiser, contrairement à un compte intervenant réel).
  const [openApercu,setOpenApercu]=useState({})
  const arbreApercu = blocsRaw.map(b=>{
    const mods=b.modules||[]
    if(!mods.length) return null
    return {
      id:b.id, titre:b.titre,
      meta: deploy ? mods.length+' module(s) · '+(b.competences||[]).length+' compétence(s)' : mods.length+' module(s) prévu(s)',
      modules: mods.map(m=>{
        const ecartsM = ecarts.filter(e=>e.module_ref===m.id)
        const seancesM = prevues.filter(s=>s.module_ref===m.id)
        const anyWarn = ecartsM.some(e=>e.etat!=='nominal')
        const competences = (b.competences||[]).filter(c=>(m.competences_liees||[]).some(cl=>normCode(cl)===normCode(c.id))).map(c=>{
          const couverte = ecartsM.some(e=>e.etat!=='alerte')
          return {code:c.id, label:c.libelle, statut: couverte?'Couverte':'Non couverte', st: couverte?'ok':'idle'}
        })
        return {
          id:m.id, titre:m.titre, meta: seancesM.length+' séance(s) ce mois-ci',
          etat: anyWarn?'À arbitrer':(seancesM.length?'Conforme':'Planifié'), st: anyWarn?'warn':'ok',
          competences,
          seances: ecartsM.map(e=>({date:fmtCourt(e.date_prevue), titre:e.titre,
            etat: etatLabel(e.etat),
            st: e.etat==='nominal'?'ok':'warn', data:e})),
        }
      }),
    }
  }).filter(Boolean)
  function toggleApercu(id){ setOpenApercu(s=>({...s,[id]:s[id]===false?true:false})) }
  const openApercuState = {}; arbreApercu.forEach(b=>{ openApercuState[b.id] = openApercu[b.id]!==false })

  function buildInsp(){
    if(temps==='digest'){
      return {kind:'Diffusion', st:'ok', titre:'Digest du mois',
        desc:"Le digest part aux intervenants du titre une fois validé. La note de coordination est le seul champ libre.",
        lignes:[
          {k:'Statut',v:digest?.statut==='envoye'?'Envoyé':digest?'Prêt à valider':'Non généré', warn:digest?.statut!=='envoye'},
          {k:'Anomalies citées',v:String(nbAlertes),warn:nbAlertes>0},
          {k:'Séances non déclarées',v:String(nbNonDeclarees),warn:nbNonDeclarees>0},
        ], key:'digest'}
    }
    if(sel.kind==='bloc'){
      const b=blocs.find(x=>x.id===sel.id)
      if(!b) return {kind:'Bloc',st:'idle',titre:titre,desc:'Sélectionnez un bloc de la cartographie.',lignes:[],key:'none'}
      const lignes = deploy
        ? [{k:'Compétences',v:b.comp+' au référentiel'},{k:'Couverture réelle',v:b.pct+' %',warn:b.st==='warn'},{k:'Anomalies',v:b.anom===0?'aucune':b.anom+' à arbitrer',warn:b.anom>0},{k:'Intervenants',v:b.qui}]
        : [{k:'Compétences',v:b.comp+' au référentiel'},{k:'Modules prévus',v:String(b.mods)},{k:'Intervenants',v:b.qui}]
      return {kind:'Bloc de compétences', st:deploy?b.st:'idle', titre:b.id+' — '+b.titre, desc:b.desc, lignes,
        alerte: (b.anom>0&&deploy) ? {titre:b.anom+' anomalie(s)', txt:'Ouvrez le journal des séances pour arbitrer bloc par bloc.'} : null,
        actions: (b.anom>0&&deploy) ? [{t:'Notifier les intervenants du bloc', primary:true, go:()=>setToast('Relance envoyée aux intervenants de '+b.id+'.')}] : [],
        key:'bloc'+b.id+temps}
    }
    if(sel.kind==='seance'){
      const s=sel.data||{}
      return {kind:'Séance', st:s.st||'ok', titre:(s.date_prevue?fmtCourt(s.date_prevue):'')+' — '+(s.titre||''), desc:s.detail||'',
        lignes:[{k:'Bloc',v:s.blocId||'—'},{k:'Intervenant',v:s.intervenant_nom||'—'},{k:'État',v:s.etatLabel||'—',warn:s.st==='warn'}],
        alerte: s.st==='warn' ? {titre:'Écart détecté', txt:s.detail||''} : null,
        actions: s.st==='warn' ? [
          {t:'Arbitrer et notifier', primary:true, go:()=>setToast('Arbitrage consigné, intervenants notifiés.')},
          {t:'Reporter au digest', go:()=>setToast('Anomalie ajoutée au digest du mois.')},
        ] : [], key:'seance'+sel.id}
    }
    if(sel.kind==='module'){
      const m=sel.data
      return {kind:'Module', st:deploy?m.st:'idle', titre:m.titre, desc:`${m.competences.length} compétence(s) associée(s).`,
        lignes:[{k:'État',v:deploy?m.etat:'Planifié',warn:m.st==='warn'&&deploy}],
        chipsLabel:'Compétences associées', chips:m.competences.map(c=>c.code), key:'mod'+sel.id}
    }
    if(sel.kind==='comp'){
      const c=sel.data
      return {kind:'Compétence', st:deploy?c.st:'idle', titre:c.code+' — '+c.label,
        desc:`Compétence du référentiel RNCP, rattachée au module « ${sel.mod||''} ».`,
        lignes:[{k:'Module',v:sel.mod||'—'},{k:'Bloc',v:sel.bloc||'—'},{k:'Statut',v:deploy?c.statut:'Prévue',warn:c.st==='idle'&&deploy}], key:'comp'+sel.id}
    }
    return {kind:'Titre', st:'ok', titre, desc:'Sélectionnez un élément de la cartographie.', lignes:[], key:'root'}
  }
  const insp = {...buildInsp(), toast}

  if(loading&&!data) return <div style={{minHeight:'100vh',background:P.abysse,display:'flex',alignItems:'center',justifyContent:'center'}}><Spinner/></div>
  if(error) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><Empty icon="⚠" titre="Erreur de chargement" msg={error}/></div>
  if(!f) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><Empty icon="📋" titre="Aucun titre" msg="Aucun titre ne vous est rattaché. Contactez la Direction des programmes."/></div>

  const nbModApercu=arbreApercu.reduce((n,b)=>n+b.modules.length,0)
  const nbCompApercu=arbreApercu.reduce((n,b)=>n+b.modules.reduce((m,mo)=>m+mo.competences.length,0),0)

  const stats = viewRole==='intervenant'
    ? (temps==='digest'
        ? [{k:'destinataires',v:String((digest?.destinataires||[]).length||'—')}]
        : temps==='plan'
          ? [{k:'modules',v:String(nbModApercu)},{k:'compétences',v:String(nbCompApercu)}]
          : [{k:'séances',v:String(ecarts.length)},{k:'à traiter',v:String(nbAlertes),warn:nbAlertes>0}])
    : temps==='digest'
      ? [{k:'destinataires',v:String((digest?.destinataires||[]).length||'—')},{k:'anomalies',v:String(nbAlertes),warn:nbAlertes>0}]
      : temps==='plan'
        ? [{k:'blocs',v:String(blocs.length)},{k:'compétences',v:String(blocs.reduce((n,b)=>n+b.comp,0))},{k:'modules',v:String(blocs.reduce((n,b)=>n+b.mods,0))}]
        : [{k:'séances',v:String(ecarts.length)},{k:'conformes',v:String(ecarts.filter(e=>e.etat==='nominal').length)},{k:'anomalies',v:String(nbAlertes),warn:nbAlertes>0}]

  const pageTitlesFR = {
    plan:['Le titre tel qu\u2019il a été planifié',"Cartographie des blocs de compétences du titre, avant toute séance déclarée ce mois-ci."],
    deploiement:['Ce que la promo a réellement couvert',"La même cartographie, remplie par les déclarations de séances. L\u2019anneau mesure la couverture réelle."],
    digest:['La synthèse envoyée aux intervenants',"Écran verrouillé : UI de production, seule la note de coordination est éditable."],
  }
  const pageTitlesInt = {
    plan:['Aperçu — modules du titre, tels que prévus',"Vue que vous consultez pour vérifier ce que les intervenants voient — tous modules confondus, arborescence dépliée."],
    deploiement:['Aperçu — modules, séance après séance',"Même arborescence, augmentée du réel déclaré par les intervenants."],
    digest:['Aperçu du digest tel que reçu par les intervenants',"Écran verrouillé, lecture seule dans cet aperçu — repassez sur « Responsable pédagogique » pour valider et envoyer."],
  }
  const [pageTitle,pageSub] = (viewRole==='intervenant'?pageTitlesInt:pageTitlesFR)[temps]
  const roleLabelHeader = viewRole==='intervenant' ? 'Aperçu intervenant' : 'Formateur référent'

  return (
    <div style={{display:'grid',gridTemplateColumns:'252px minmax(0,1fr) 336px',height:'100vh',width:'100%',minWidth:1280,background:P.abysse,overflow:'hidden',fontFamily:"'DM Sans',sans-serif"}}>
      <RailAtelier titre={titre} campus={campus} rncp={f?.formation?.rncp} periodeLabel={abregeMois(data?.periode?.label)}
        onMois={decalerMois} formations={formations} formationId={formationId}
        onFormation={id=>{setFormationId(id);setSel({kind:null,id:null})}} tempsDefs={TEMPS_DEFS} temps={temps} setTemps={setTemps}
        user={user} onLogout={onLogout} onRetour={onRetour}
        roleButtons={[
          {id:'fr',active:viewRole==='fr',label:'Responsable pédagogique',sub:`${user.prenom} ${user.nom} · cartographie du titre`,go:()=>{setViewRole('fr');setSel({kind:null,id:null})}},
          {id:'intervenant',active:viewRole==='intervenant',label:'Intervenant',sub:'Aperçu · tous modules',go:()=>{setViewRole('intervenant');setSel({kind:null,id:null})}},
        ]}
        anomalieFooter={`${nbAlertes} anomalie${nbAlertes>1?'s':''} à arbitrer${nbNonDeclarees?` · ${nbNonDeclarees} non déclarée${nbNonDeclarees>1?'s':''}`:''}`}/>

      <main style={{background:'#F4FBF7',overflowY:'auto',display:'flex',flexDirection:'column'}}>
        <HeaderAtelier tempsNum={TEMPS_DEFS.find(t=>t.id===temps).num} roleLabel={roleLabelHeader} pageTitle={pageTitle} pageSub={pageSub} stats={stats}/>

        <div key={temps+viewRole} style={{padding:'26px 34px 46px',animation:'fadeIn .28s ease'}} className="fi">
          {viewRole==='intervenant'&&temps!=='digest'&&(
            arbreApercu.length===0?(
              <Empty icon="📋" titre="Aucun module ce mois-ci" msg="Aucune séance prévisionnelle sur la période en cours pour ce titre."/>
            ):(
              <Arbre2 arbre={arbreApercu} mode={temps} open={openApercuState} toggle={toggleApercu} sel={sel} onSelect={setSel}/>
            )
          )}
          {viewRole==='fr'&&temps!=='digest'&&<>
            <Cartographie2 blocs={blocs} mode={temps} sel={sel} onSelect={setSel} titre={titre}/>

            {deploy&&(
              <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.45fr) minmax(0,1fr)',gap:18,marginTop:20}}>
                <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,overflow:'hidden'}}>
                  <div style={{padding:'13px 18px',borderBottom:`1px solid ${P.border}`,fontSize:11,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:P.petrole}}>Journal des séances déclarées</div>
                  {seancesJournal.length===0?<div style={{padding:'2rem',textAlign:'center',color:P.textm,fontSize:13}}>Aucune séance ce mois-ci.</div>:
                    seancesJournal.map(s=>(
                      <button key={s.previsionnel_id} onClick={()=>setSel({kind:'seance',id:s.previsionnel_id,data:s})}
                        style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'11px 18px',borderBottom:`1px solid ${P.border}`,cursor:'pointer',border:'none',
                          background:sel.kind==='seance'&&sel.id===s.previsionnel_id?'#F1FCF6':'transparent'}}>
                        <span style={{fontSize:11,color:AT.idleText,width:52,flexShrink:0,textAlign:'left'}}>{fmtCourt(s.date_prevue)}</span>
                        <span style={{fontSize:10,fontWeight:700,color:P.petrole,background:P.givre,padding:'3px 7px',borderRadius:6,flexShrink:0}}>{s.blocId}</span>
                        <span style={{flex:1,textAlign:'left',fontSize:12.5,color:P.abysse,lineHeight:1.4}}>{s.titre}</span>
                        <span style={{fontSize:11,color:P.textm,flexShrink:0}}>{s.intervenant_nom}</span>
                        <span style={atTag(s.st)}>{s.etatLabel}</span>
                      </button>
                    ))}
                </div>
                <div style={{background:P.abysse,borderRadius:16,padding:'18px 20px 20px'}}>
                  <div style={{fontSize:11,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:P.menthe,marginBottom:14}}>Anomalies à arbitrer</div>
                  {anomalies.length===0?<div style={{fontSize:12,color:'rgba(227,255,240,.4)'}}>Aucune anomalie ce mois-ci.</div>:(
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {anomalies.map(a=>(
                        <button key={a.previsionnel_id} onClick={()=>setSel({kind:'seance',id:a.previsionnel_id,data:a})}
                          style={{display:'block',width:'100%',textAlign:'left',padding:'13px 14px',borderRadius:12,cursor:'pointer',border:'1px solid',
                            background:sel.id===a.previsionnel_id?'rgba(93,226,152,.10)':'rgba(227,255,240,.05)',
                            borderColor:sel.id===a.previsionnel_id?'rgba(93,226,152,.35)':'rgba(227,255,240,.08)'}}>
                          <span style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                            <span style={{width:6,height:6,borderRadius:'50%',background:P.saumon}}/>
                            <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'.11em',textTransform:'uppercase',color:P.saumon}}>{a.etatLabel}</span>
                          </span>
                          <span style={{display:'block',fontSize:12.5,color:P.givre,lineHeight:1.45}}>{a.titre}</span>
                          <span style={{display:'block',fontSize:11,color:'rgba(227,255,240,.45)',marginTop:5}}>{fmtCourt(a.date_prevue)} · {a.intervenant_nom} · {a.blocId}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!deploy&&(
              <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,marginTop:20,overflow:'hidden'}}>
                <div style={{padding:'13px 18px',borderBottom:`1px solid ${P.border}`,fontSize:11,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:P.petrole}}>Ce qui est prévu — répartition des intervenants</div>
                {blocs.map(b=>(
                  <button key={b.id} onClick={()=>setSel({kind:'bloc',id:b.id})}
                    style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'12px 18px',borderBottom:`1px solid ${P.border}`,cursor:'pointer',border:'none',
                      background:sel.kind==='bloc'&&sel.id===b.id?'#F1FCF6':'transparent'}}>
                    <span style={{fontSize:11,fontWeight:700,color:P.petrole,background:P.givre,padding:'4px 9px',borderRadius:7,flexShrink:0}}>{b.id}</span>
                    <span style={{flex:1,textAlign:'left',fontSize:12.5,color:P.abysse}}>{b.titre}</span>
                    <span style={{fontSize:11,color:P.textm,width:104,textAlign:'left'}}>{b.comp} compétences</span>
                    <span style={{fontSize:11,color:P.textm,width:96,textAlign:'left'}}>{b.mods} modules</span>
                    <span style={{fontSize:11,color:P.petrole,flexShrink:0}}>{b.qui}</span>
                  </button>
                ))}
              </div>
            )}
          </>}

          {temps==='digest'&&(
            <div style={{maxWidth:640,margin:'0 auto'}}>
              {viewRole==='fr'&&<div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
                <button onClick={genererDigest} disabled={generating}
                  style={{background:P.petrole,color:P.givre,border:'none',borderRadius:8,padding:'8px 16px',fontSize:12,fontWeight:500,cursor:'pointer',opacity:generating?0.6:1,display:'flex',alignItems:'center',gap:8}}>
                  {generating?<Spinner size={14}/>:null}{digest?'↻ Régénérer le digest':'Générer le digest du mois'}
                </button>
              </div>}
              {genError&&<div style={{...card(),border:`1px solid ${P.red}`,color:'#8B1A1A',fontSize:12,marginBottom:16}}>⚠ {genError}</div>}
              {!digest?(
                <Empty icon="✉" titre="Aucun digest généré" msg="Générez le digest du mois pour ce titre — il s'appuie sur les séances déclarées de la période en cours."/>
              ):(
                <DigestPreview digest={digest} titre={titre} campus={campus} fr={`${user.prenom} ${user.nom}`} onValiderEnvoyer={validerEnvoyer} readOnly={viewRole==='intervenant'}/>
              )}
              <p style={{fontSize:11,color:AT.idleText,textAlign:'center',marginTop:14,lineHeight:1.6}}>Écran verrouillé — UI de production reprise telle quelle.</p>
            </div>
          )}
        </div>
      </main>

      <Inspecteur insp={insp}/>
    </div>
  )
}

/* ── Aperçu digest — reproduit la maquette validée, alimenté par digest.contenu_genere ── */
function DigestPreview({digest,titre,campus,fr,onValiderEnvoyer,readOnly=false}){
  const c=digest.contenu_genere||{}
  const D={abysse:P.abysse,petrole:P.petrole,menthe:P.menthe,saumon:P.saumon}
  const avancementBlocs=c.avancement_blocs||[]
  const quiAEnseigne=c.qui_a_enseigne||[]
  const coordination=c.coordination||[]
  const sequencesAVenir=c.sequences_a_venir||[]
  const kpis=c.kpis||{intervenants:0,seances:0,coordination:coordination.length}
  const periodeLabel=c.periode?.label||''
  const sectStyle={padding:'1.25rem 1.75rem',borderBottom:'1px solid rgba(255,255,255,0.06)',background:D.abysse}
  const labelStyle={fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.28)',marginBottom:'0.75rem'}
  const pill={display:'inline-block',padding:'1px 8px',borderRadius:20,fontSize:10,fontWeight:600,background:'rgba(93,226,152,0.12)',color:D.menthe,border:'1px solid rgba(93,226,152,0.22)',marginRight:3,marginTop:4}
  const item={display:'flex',alignItems:'flex-start',gap:'0.85rem',padding:'0.55rem 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}
  const itTitle={fontSize:13,fontWeight:500,color:'#fff',lineHeight:1.4}
  const itSub={fontSize:11,color:'rgba(255,255,255,0.38)',marginTop:2,lineHeight:1.5}
  const statutLabel={genere:'Prêt à valider',valide:'Validé',envoye:'Envoyé'}[digest.statut]||digest.statut

  const [note,setNote]=useState(c.note_fr||c.note_fr_suggestion||'')
  const [sending,setSending]=useState(false)
  const [sendError,setSendError]=useState('')
  useEffect(()=>{ setNote(c.note_fr||c.note_fr_suggestion||''); setSendError('') },[digest.id])

  const dejaEnvoye=digest.statut==='envoye'

  async function handleValider(){
    setSending(true);setSendError('')
    try{ await onValiderEnvoyer(note) }
    catch(e){ setSendError(e.message) }
    finally{ setSending(false) }
  }

  return(
    <>
      <div style={{...card({background:'rgba(93,226,152,0.10)',border:`1px solid ${P.borderm}`}),display:'flex',alignItems:'flex-start',gap:'0.6rem'}}>
        <span style={{fontSize:14}}>{dejaEnvoye?'✓':'✉'}</span>
        <div style={{fontSize:13,color:P.petrole,lineHeight:1.6}}>
          Digest {statutLabel.toLowerCase()}{periodeLabel?` — ${periodeLabel}`:''}. Relisez l'aperçu ci-dessous tel que les intervenants le recevront
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
          <div style={{fontFamily:'Georgia,serif',fontSize:22,color:'#fff',fontWeight:400,lineHeight:1.25,marginBottom:'0.35rem'}}>{c.titre||'Ce que la promo a traversé'}</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,0.35)'}}>Généré par Atlas · Validé avant envoi · Répondez à ce mail pour contacter {fr}</div>
          <div style={{display:'flex',gap:'1.5rem',marginTop:'1.25rem',paddingTop:'1.25rem',borderTop:'1px solid rgba(255,255,255,0.07)'}}>
            <div><div style={{fontSize:22,fontWeight:700,color:D.menthe}}>{kpis.intervenants}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Intervenants actifs</div></div>
            <div><div style={{fontSize:22,fontWeight:700,color:D.menthe}}>{kpis.seances}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Séances réalisées</div></div>
            <div><div style={{fontSize:22,fontWeight:700,color:D.saumon}}>{kpis.coordination}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Points de coordination</div></div>
          </div>
        </div>

        <div style={sectStyle}>
          <div style={labelStyle}>Avancement RNCP par bloc</div>
          {avancementBlocs.length===0?<div style={itSub}>Aucun bloc de compétences sur ce titre.</div>:avancementBlocs.map(b=>(
            <div key={b.id} style={{marginBottom:'0.55rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'rgba(255,255,255,0.75)',marginBottom:3}}>
                <span>{b.id} — {b.titre}</span><span style={{color:D.menthe,fontWeight:600}}>{b.pct==null?'—':`${b.pct}%`}</span>
              </div>
              <div style={{background:'rgba(255,255,255,0.08)',borderRadius:99,height:4,overflow:'hidden'}}>
                <div style={{width:`${b.pct||0}%`,height:'100%',background:D.menthe,borderRadius:99}}/>
              </div>
            </div>
          ))}
        </div>

        <div style={sectStyle}>
          <div style={labelStyle}>Qui a enseigné quoi ce mois-ci</div>
          {quiAEnseigne.length===0?<div style={itSub}>Aucune séance réalisée cette période.</div>:quiAEnseigne.map((t,i)=>(
            <div key={i} style={item}>
              <div style={{width:7,height:7,borderRadius:'50%',background:D.menthe,flexShrink:0,marginTop:4}}/>
              <div><div style={itTitle}>{t.module}</div>
                <div style={itSub}>{t.intervenant}{t.modalite?` · ${t.modalite}`:''}</div>
                <div>{(t.competences||[]).map(cp=><span key={cp} style={pill}>{cp}</span>)}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={sectStyle}>
          <div style={labelStyle}>Point de coordination — {fr}, FR</div>
          {!dejaEnvoye&&!readOnly?(
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Note de coordination (modifiable avant envoi)…"
              style={{width:'100%',minHeight:70,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,padding:'0.6rem',fontSize:12,color:'#fff',resize:'vertical',outline:'none',lineHeight:1.6,marginBottom:coordination.length?'0.75rem':0}}/>
          ):note&&(
            <div style={{background:'rgba(232,155,119,0.08)',border:'1px solid rgba(232,155,119,0.2)',borderRadius:8,padding:'0.85rem 1rem',marginBottom:coordination.length?'0.75rem':0}}>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.62)',lineHeight:1.65}}>{note}</div>
            </div>
          )}
          {coordination.map((co,i)=>(
            <div key={i} style={{...item,padding:'0.4rem 0'}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:D.saumon,flexShrink:0,marginTop:4}}/>
              <div><div style={{...itTitle,fontSize:12}}>{co.titre}</div><div style={itSub}>{co.detail}</div></div>
            </div>
          ))}
        </div>

        {sequencesAVenir.length>0&&(
          <div style={sectStyle}>
            <div style={labelStyle}>Ce qui arrive le mois prochain</div>
            {sequencesAVenir.map((s,i)=>(
              <div key={i} style={item}>
                <div style={{width:7,height:7,borderRadius:'50%',background:'rgba(93,226,152,0.3)',flexShrink:0,marginTop:4}}/>
                <div><div style={itTitle}>{s.module}</div><div style={itSub}>{s.date?`${s.date} · `:''}{s.intervenant}</div><div>{(s.competences||[]).map(cp=><span key={cp} style={pill}>{cp}</span>)}</div></div>
              </div>
            ))}
          </div>
        )}

        <div style={{background:D.petrole,padding:'1.25rem 1.75rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem'}}>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',lineHeight:1.5}}>Répondre à ce mail = contacter {fr} directement.<br/>Atlas des compétences · Éminéo · {titre}</div>
          {dejaEnvoye?(
            <span style={{color:D.menthe,fontSize:13,fontWeight:700,whiteSpace:'nowrap'}}>✓ Envoyé</span>
          ):readOnly?(
            <span style={{color:'rgba(255,255,255,0.35)',fontSize:12}}>En attente de validation</span>
          ):(
            <button onClick={handleValider} disabled={sending}
              style={{background:D.menthe,color:P.abysse,border:'none',borderRadius:6,padding:'9px 20px',fontWeight:700,fontSize:13,cursor:sending?'default':'pointer',whiteSpace:'nowrap',opacity:sending?0.7:1,display:'flex',alignItems:'center',gap:'0.5rem'}}>
              {sending?<Spinner size={14}/>:null}{sending?'Envoi…':'✓ Valider et envoyer'}
            </button>
          )}
        </div>
      </div>
      {sendError&&<p style={{textAlign:'center',fontSize:12,color:P.red,marginTop:'0.75rem'}}>⚠ {sendError}</p>}
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
