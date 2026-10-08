import { useState, useEffect } from 'react'
import { api, apiFetch, setToken, clearToken, getToken, apparierIntervenants,
         seanceDepuisCesar, groupesDepuisCesar } from './api.js'

const P = {
  abysse:'#0B2B2D',petrole:'#134547',menthe:'#5DE298',givre:'#E3FFF0',eau:'#9DF0C4',saumon:'#E89B77',
  surface:'#FFFFFF',surface2:'#F5FDF8',border:'rgba(19,69,71,0.12)',borderm:'rgba(93,226,152,0.28)',
  textm:'#4A706E',textl:'rgba(11,43,45,0.40)',amber:'#EF9F27',amberbg:'#FFF8ED',red:'#E24B4A',redbg:'#FEF2F2',
}
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
   IMPORT CSV — intervenants
   Format CRM Éminéo : CSV séparateur ";" UTF-8 BOM
   Colonnes : Nom;Prénom;Matières;Email école
     → Claude apparie les matières CRM aux modules du titre choisi.

   L'import des étudiants a été retiré le 05/10/2026 : le dispositif ne
   fonctionne qu'en digest intervenants + RP, aucun compte étudiant n'est créé
   au pilote. Proposer l'import revenait à annoncer une voie sans destination.
═══════════════════════════════════════════════════════════════════════════ */

function genPassword(){
  const chars='abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({length:8},()=>chars[Math.floor(Math.random()*chars.length)]).join('')
}

// Parser CSV séparateur ";" — gère les champs entre guillemets et le BOM UTF-8
function parseCSV(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
  if(!lines.length)return[]
  // Le separateur etait fige sur le point-virgule. Un export a virgules — le
  // cas le plus repandu, et celui que produit une conversion de tableur — se
  // retrouvait alors en une seule colonne : aucune ligne valide, sans que rien
  // n'indique pourquoi. On le deduit desormais de la ligne d'en-tete, hors
  // guillemets, en retenant le caractere le plus frequent.
  function compter(line,sep){
    let n=0,inQ=false
    for(let i=0;i<line.length;i++){
      const c=line[i]
      if(c==='"'){ if(inQ&&line[i+1]==='"'){i++} else inQ=!inQ }
      else if(c===sep&&!inQ)n++
    }
    return n
  }
  const SEP=[';',',','\t'].reduce((meilleur,sep)=>
    compter(lines[0],sep)>compter(lines[0],meilleur)?sep:meilleur,';')
  function splitLine(line){
    const cols=[];let cur='',inQ=false
    for(let i=0;i<line.length;i++){
      const c=line[i]
      if(c==='"'&&!inQ){inQ=true}
      else if(c==='"'&&inQ&&line[i+1]==='"'){cur+='"';i++}
      else if(c==='"'&&inQ){inQ=false}
      else if(c===SEP&&!inQ){cols.push(cur.trim());cur=''}
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
        if(!parsed.length){setErr('Aucune ligne exploitable dans ce fichier.');return}
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
    fichierVersTexte(file).then(t=>r.onload({target:{result:t}})).catch(e=>setErr(e.message))
  }

  // Appariement sémantique via Claude (passe par /api/ingest mode prompt)
  async function apparier(){
    if(!allModules.length){setErr('Aucune formation sélectionnée — impossible d\'apparier les modules.');return}
    setAppLoading(true);setErr('')
    try{
      const parsed=await apparierIntervenants(
        allModules.map(m=>({id:m.id,titre:m.titre,bloc:m.bloc})),
        rows.map(r=>({prenom:r.prenom,nom:r.nom,matieres:r.matieres}))
      )
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
      {/* Le bandeau « sélectionnez d'abord une formation dans l'onglet Mes
          formations » a été supprimé le 05/10/2026 : il désignait un ailleurs
          sans y mener. Le titre se choisit désormais au-dessus, dans cet
          écran. Il reste donc toujours un titre sélectionné ici — sauf si le
          périmètre est vide, cas traité par le conteneur. */}
      <div onClick={()=>formation&&document.getElementById('csv-int').click()}
        style={{border:`2px dashed ${formation?P.borderm:P.border}`,borderRadius:12,padding:'1.75rem',textAlign:'center',cursor:formation?'pointer':'not-allowed',background:formation?'rgba(93,226,152,0.03)':'rgba(19,69,71,0.02)',marginBottom:'0.75rem',opacity:formation?1:0.55}}>
        <input id="csv-int" type="file" accept=".csv,.txt,.xlsx,.xlsm" style={{display:'none'}} onChange={e=>e.target.files[0]&&parseFile(e.target.files[0])}/>
        <div style={{fontSize:22,opacity:0.4,marginBottom:'0.35rem'}}>👨‍🏫</div>
        <div style={{fontSize:13,fontWeight:500,color:P.petrole}}>Fichier intervenants (.csv ou .xlsx)</div>
        <div style={{fontSize:11,color:P.textm,marginTop:4}}>Nom · Prénom · Matières · Email école</div>
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

/* ── Campus d'une formation (le champ est tantôt une chaîne, tantôt un JSON) ── */
function premierCampusDe(f){
  if(!f)return ''
  const c=f._campus
  if(Array.isArray(c))return c[0]||''
  try{const p=JSON.parse(c);if(Array.isArray(p))return p[0]||''}catch(_){}
  return String(c||'').split(',')[0].trim()
}

/* ── ImportCSV : import des intervenants, titre choisi sur place ─────────────
   Trois corrections du 05/10/2026, toutes au même endroit :

   1. L'onglet « Étudiants » disparaît. Aucun compte étudiant n'est créé au
      pilote ; la voie était ouverte sans destination.
   2. Le choix du titre se fait ici, par simple clic sur une vignette. Il
      passait auparavant par un menu déroulant, et seulement quand plusieurs
      titres étaient disponibles — sinon rien n'était cliquable et l'écran
      affichait « — aucun titre — » sans recours.
   3. L'écran charge lui-même la liste des titres si l'appelant ne la fournit
      pas. La Direction y arrivait avec un tableau vide (formations={[]}) :
      l'appariement ne pouvait aboutir, quel que soit le fichier déposé.

   Le campus retenu pour les comptes créés est celui de l'appelant si connu
   (cas du RP), sinon celui du titre choisi. Un intervenant sans campus ne
   verrait aucune formation : api/formations.js filtre dessus. */
function ImportCSV({campus,formations,formation:formationProp,onDone}){
  const fournies=(formations&&formations.length)?formations:(formationProp?[formationProp]:[])
  const [chargees,setChargees]=useState(null)
  const [selId,setSelId]=useState(formationProp?._id||null)

  useEffect(()=>{
    if(fournies.length)return
    let vivant=true
    api.getFormations().then(d=>{if(vivant)setChargees(d.formations||[])}).catch(()=>{if(vivant)setChargees([])})
    return()=>{vivant=false}
  },[fournies.length])

  const titres=fournies.length?fournies:(chargees||[])
  useEffect(()=>{
    if(!titres.length)return
    if(!titres.some(t=>t._id===selId))setSelId(titres[0]._id)
  },[titres.length])

  const formation=titres.find(t=>t._id===selId)||null
  const campusCible=campus||premierCampusDe(formation)
  const enChargement=!fournies.length&&chargees===null

  if(enChargement)return <div style={{textAlign:'center',padding:'2rem'}}><Spinner/></div>

  if(!titres.length)return(
    <Empty icon="🎓" titre="Aucun titre accessible"
      msg="Aucun titre n'est rattaché à votre périmètre. Contactez la Direction des programmes pour en faire rattacher un — l'import sera alors disponible ici."/>
  )

  return(
    <div>
      {/* 1 · Titre de destination — toujours visible, toujours cliquable */}
      <div style={{marginBottom:'1.25rem'}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:P.textm,marginBottom:'0.5rem'}}>
          1 · Titre de destination
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem'}}>
          {titres.map(t=>{
            const on=t._id===selId
            const nbMod=(t.blocs||[]).flatMap(b=>b.modules||[]).length
            return(
              <button key={t._id} onClick={()=>setSelId(t._id)}
                style={{textAlign:'left',padding:'8px 14px',borderRadius:10,cursor:'pointer',
                  border:`1px solid ${on?P.petrole:P.border}`,
                  background:on?P.petrole:P.surface,
                  boxShadow:on?'0 3px 14px rgba(19,69,71,0.22)':'none',transition:'all .16s'}}>
                <span style={{display:'block',fontSize:13,fontWeight:600,color:on?P.menthe:P.abysse}}>
                  {t.formation?.titre||t._titre_court||`Titre ${t._id}`}
                </span>
                <span style={{display:'block',fontSize:11,marginTop:2,color:on?'rgba(227,255,240,.55)':P.textm}}>
                  {nbMod} module{nbMod>1?'s':''}{premierCampusDe(t)?' · '+premierCampusDe(t):''}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Rappel de destination — une seule ligne, sans avertissement orange */}
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',padding:'0.65rem 0.9rem',
        background:'rgba(93,226,152,0.08)',border:`1px solid ${P.borderm}`,borderRadius:10,marginBottom:'1.25rem'}}>
        <span style={{fontSize:12,color:P.textm}}>Les comptes créés seront rattachés à</span>
        <strong style={{fontSize:13,color:P.abysse}}>{formation?.formation?.titre||'—'}</strong>
        {campusCible&&<span style={{fontSize:12,color:P.textm}}>· campus <strong style={{color:P.abysse}}>{campusCible}</strong></span>}
      </div>

      {/* 2 · Fichier */}
      <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:P.textm,marginBottom:'0.5rem'}}>
        2 · Fichier intervenants
      </div>
      <ImportIntervenants campus={campusCible} formation={formation} onDone={onDone}/>
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
        {[{id:'manuel',l:'Création manuelle'},{id:'excel',l:'Import intervenants'}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:'5px 14px',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer',border:`1px solid ${tab===t.id?P.borderm:P.border}`,background:tab===t.id?'rgba(93,226,152,0.12)':P.surface,color:tab===t.id?P.petrole:P.textm}}>{t.l}</button>)}
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
          {/* Aucune liste n'est passée : ImportCSV charge lui-même les titres.
              En lui transmettant un tableau vide, la Direction se retrouvait
              devant « — aucun titre — », sans appariement possible. */}
          <ImportCSV onDone={()=>{api.getUsers().then(d=>setUsers(d.users)).catch(()=>{})}}/>
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

/* ═══ CARTOGRAPHIE D'UN TITRE — Direction et RP ═════════════════════════════
   Remplace GrapheCanvas (05/10/2026). L'ancien graphe dessinait des cercles de
   taille voisine reliés par les notions communes aux modules. Or les
   référentiels versionnés ne portent aucune notion : le champ notions_cles est
   constant et vide (api/_lib/referentiels.js), parce que l'extracteur ne lit
   que le plan de formation. Aucun trait n'était donc jamais tracé, et la carte
   se réduisait à des ronds muets.

   On réutilise ici la rosace de L'Atelier, déjà en production côté Formateur
   Référent : hub au sigle du titre, un cercle par bloc, détail au survol
   (intitulé complet, compétences, modules, épreuves), contour saumon pour les
   parcours au choix. Mode 'plan' — contours pointillés — tant qu'aucune séance
   n'est déclarée : la carte annonce la structure prévue, elle ne prétend pas
   décrire du réalisé.

   Un même composant pour la Direction, le RP et le FR : une seule règle
   visuelle à maintenir. */
function CartographieTitre({formation}){
  const [sel,setSel]=useState({kind:null,id:null})
  const blocsRaw=formation?.blocs||[]
  const titre=formation?.formation?.titre||''

  const blocs=blocsRaw.map(b=>{
    const mods=b.modules||[]
    const qui=Array.from(new Set(mods.map(m=>m.intervenant).filter(Boolean)))
    return{
      id:b.id, titre:b.titre,
      comp:(b.competences||[]).length,
      mods:mods.length,
      pct:0, anom:0, st:'idle',
      nature:b.nature==='option'?'option':'obligatoire',
      optGroupe:b.option_groupe||'',
      epreuves:b.epreuves||[],
      qui:qui.length?qui.join(' · '):'Non affecté',
    }
  })

  const blocSel=sel.kind==='bloc'?blocsRaw.find(b=>b.id===sel.id):null

  if(!blocs.length)return(
    <Empty icon="🗺" titre="Aucun bloc de compétences"
      msg="Ce titre n'a pas encore de référentiel chargé. Lancez la synchronisation depuis le dépôt."/>
  )

  return(
    <>
      <Cartographie2 blocs={blocs} mode="plan" sel={sel} titre={titre}
        onSelect={x=>setSel(p=>p.kind==='bloc'&&p.id===x.id?{kind:null,id:null}:x)}/>

      {/* Trame transversale — ce que plusieurs modules enseignent en commun.
          La rosace montre les blocs ; elle ne peut pas montrer ce qui les
          traverse. C'est pourtant là que se joue la coordination : une famille
          portée par quatre modules de trois blocs différents est soit un
          approfondissement voulu, soit quatre fois le même cours. */}
      {(formation?.notions_transversales || []).length > 0 && (
        <div style={{...card({marginTop:'0.9rem'})}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:P.textm,marginBottom:'0.1rem'}}>
            Notions transversales
          </div>
          <p style={{fontSize:12,color:P.textm,margin:'0 0 0.75rem',lineHeight:1.6}}>
            {formation.notions_transversales.length} familles de notions sont portées par plusieurs modules.
            {(formation.liens_blocs || []).length > 0 && ' ' + formation.liens_blocs.length + ' relient des blocs distincts.'}
          </p>
          {formation.notions_transversales.map(n => {
            const traverse = (n.blocs || []).length > 1
            return (
              <div key={n.libelle} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'7px 0',borderBottom:`1px solid ${P.border}`}}>
                <span style={{flexShrink:0,display:'flex',gap:3,flexWrap:'wrap',width:96}}>
                  {(n.blocs || []).map(b => <Tag key={b} label={b} small/>)}
                </span>
                <span style={{flex:1,minWidth:0}}>
                  <span style={{fontSize:13,fontWeight:traverse?600:400,color:P.abysse}}>{n.libelle}</span>
                  <span style={{fontSize:11,color:P.textm}}> · {n.modules.length} modules</span>
                  <div style={{fontSize:11,color:P.textm,marginTop:2,lineHeight:1.5}}>{n.modules.join(' · ')}</div>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Détail du bloc retenu — dépliage sous la carte plutôt qu'en panneau
          flottant : la lecture reste dans le flux de la page. */}
      {blocSel&&(
        <div style={{...card({marginTop:'0.9rem'}),borderLeft:`3px solid ${blocSel.nature==='option'?P.saumon:P.menthe}`}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:'0.75rem'}}>
            <div>
              <Tag label={blocSel.id} small/>
              <span style={{marginLeft:'0.5rem',fontSize:15,fontWeight:600,color:P.abysse}}>{blocSel.titre}</span>
              {blocSel.nature==='option'&&(
                <div style={{fontSize:11,fontWeight:700,letterSpacing:'.05em',textTransform:'uppercase',color:AT.warnText,marginTop:3}}>
                  Parcours au choix{blocSel.option_groupe?' · '+blocSel.option_groupe:''}
                </div>
              )}
            </div>
            <button onClick={()=>setSel({kind:null,id:null})} style={{color:P.textm,fontSize:18,cursor:'pointer',lineHeight:1}}>×</button>
          </div>

          {(blocSel.epreuves||[]).length>0&&(
            <div style={{padding:'0.55rem 0.8rem',background:P.surface2,borderRadius:8,marginBottom:'0.75rem',fontSize:12,color:P.petrole,lineHeight:1.6}}>
              {blocSel.epreuves.map((e,i)=>(
                <div key={i}><strong>{e.intitule}</strong>{e.modalite?' · '+e.modalite:''}{e.duree?' · '+e.duree+' h':''}{e.date?' · le '+e.date:''}</div>
              ))}
            </div>
          )}

          <div style={{fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:P.textm,marginBottom:'0.4rem'}}>
            Compétences du référentiel
          </div>
          {(blocSel.competences||[]).length===0
            ? <div style={{fontSize:12,color:P.textm,marginBottom:'0.75rem'}}>Aucune compétence rattachée à ce bloc.</div>
            : <div style={{marginBottom:'0.9rem'}}>
                {blocSel.competences.map(c=>(
                  <div key={c.id} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'4px 0',borderBottom:`1px solid ${P.border}`}}>
                    <span style={{flexShrink:0}}><Tag label={c.id} small/></span>
                    <span style={{fontSize:12,color:P.abysse,lineHeight:1.5}}>{c.libelle||'—'}</span>
                  </div>
                ))}
              </div>}

          <div style={{fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:P.textm,marginBottom:'0.4rem'}}>
            Modules ({(blocSel.modules||[]).length})
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'0.35rem'}}>
            {(blocSel.modules||[]).map(m=>(
              <span key={m.id} style={{fontSize:11.5,padding:'4px 10px',borderRadius:8,background:P.surface2,border:`1px solid ${P.border}`,color:P.abysse}}>
                {m.titre}
                {m.intervenant&&<span style={{color:P.textm}}> · {m.intervenant}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

/* ═══ COUVERTURE — L'ANNONCÉ CONFRONTÉ AU RÉALISÉ ═══════════════════════════
   La raison d'être d'Atlas. Le plan de formation et les syllabi disent ce que
   l'école s'engage à enseigner ; l'émargement dit ce qui a réellement eu lieu.
   Tout ce qui s'affiche ici naît de la différence entre les deux, et rien
   n'a été demandé à un intervenant.

   Le compte rendu de séance, quand il existe, s'ajoute en complément. Il ne
   conditionne aucune mesure : s'il disparaît, la couverture tient toujours. */
function VueCouverture({formations=[],formationId:initial}){
  const [d,setD]=useState(null)
  const [erreur,setErreur]=useState('')
  const [onglet,setOnglet]=useState('couverture')
  const [ouvert,setOuvert]=useState({})
  const [formationId,setFormationId]=useState(initial||null)
  // Quelles promotions ont réellement des séances ? Sans cette information,
  // l'écran s'ouvrait sur la première de la liste — souvent vide — et
  // annonçait « aucune séance importée » alors que l'import avait réussi
  // ailleurs. On interroge l'état de l'émargement pour ouvrir sur une
  // promotion qui a de quoi s'afficher.
  const [avecSeances,setAvecSeances]=useState(null)

  useEffect(()=>{
    api.cesarEtat().then(e=>{
      const titres=new Set((e.groupes_planning||[]).filter(g=>g.seances_prevues>0&&g.titre).map(g=>g.titre))
      setAvecSeances(titres)
      if(!initial||!formations.some(f=>f._id===initial&&titres.has(f._titre_court))){
        const f=formations.find(x=>titres.has(x._titre_court))
        if(f)setFormationId(f._id)
      }
    }).catch(()=>setAvecSeances(new Set()))
  },[formations.length])

  useEffect(()=>{
    if(!formationId){setD(null);return}
    setD(null);setErreur('')
    api.cesarCouverture(formationId).then(setD).catch(e=>setErreur(e.message))
  },[formationId])

  const selecteur=formations.length>1?(
    <div style={{display:'flex',gap:'0.35rem',flexWrap:'wrap',marginBottom:'1.1rem'}}>
      {formations.map(f=>{
        const on=f._id===formationId
        const garni=avecSeances?avecSeances.has(f._titre_court):true
        return(
          <button key={f._id} onClick={()=>setFormationId(f._id)}
            style={{padding:'6px 13px',borderRadius:9,fontSize:12.5,fontWeight:on?600:500,
              background:on?P.petrole:P.surface,color:on?P.menthe:(garni?P.textm:P.border),
              border:`1px solid ${on?P.petrole:P.border}`,opacity:garni?1:0.55}}>
            {f._titre_court||f.formation?.titre||'—'}{garni?'':' ·'}
          </button>
        )
      })}
    </div>
  ):null

  if(!formationId)return <div className="fi">{selecteur}<Empty icon="📐" titre="Choisissez une promotion" msg="La couverture se calcule promotion par promotion."/></div>
  if(erreur)return <div className="fi">{selecteur}<div style={{padding:'0.8rem 1rem',background:P.amberbg,border:`1px solid ${P.amber}`,borderRadius:10,fontSize:12.5,color:'#7A4A00'}}>{erreur}</div></div>
  if(!d)return <div className="fi">{selecteur}<div style={{textAlign:'center',padding:'2rem'}}><Spinner/></div></div>

  const R=d.resume
  const tous=[...d.blocs.flatMap(b=>b.modules.map(m=>({...m,bloc:b.id}))),...(d.modules_hors_bloc||[]).map(m=>({...m,bloc:'HB'}))]
  if(!R.heures_programmees&&!R.modules_programmes)
    return <div className="fi">{selecteur}<Empty icon="📐" titre="Aucune séance importée pour cette promotion"
      msg="Les promotions grisées ci-dessus n’ont pas encore d’émargement. Importez-le dans l’onglet Émargement, puis arbitrez les matières."/></div>

  const pct=R.heures_programmees?Math.round(100*R.heures_faites/R.heures_programmees):0
  const etat=m=>!m.programme?{c:'jamais',l:'jamais programmé',col:P.saumon}
    :!m.seances_faites?{c:'avenir',l:'à venir',col:P.border}
    :m.seances_faites>=m.seances_programmees?{c:'termine',l:'terminé',col:P.menthe}
    :{c:'encours',l:'en cours',col:P.petrole}

  const carte=m=>{
    const e=etat(m)
    const p=m.heures_programmees?Math.round(100*m.heures_faites/m.heures_programmees):0
    const ecart=m.volume_annonce!=null&&m.heures_programmees?Math.round((m.heures_programmees-m.volume_annonce)*10)/10:null
    const cle=m.bloc+'|'+m.titre
    return(
      <div key={cle} style={{...card({marginBottom:'0.5rem',background:e.c==='jamais'?'rgba(232,155,119,0.07)':'#fff'}),borderLeft:`3px solid ${e.col}`}}>
        <div onClick={()=>setOuvert(o=>({...o,[cle]:!o[cle]}))} style={{display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap',cursor:'pointer'}}>
          <div style={{flex:1,minWidth:230}}>
            <div style={{fontSize:13.5,fontWeight:600,color:P.abysse}}>{m.titre}</div>
            <div style={{fontSize:11.5,color:P.textm,marginTop:2}}>
              {m.volume_annonce!=null?m.volume_annonce+' h au plan':'volume non précisé'}
              {m.programme?' · '+m.heures_programmees+' h programmées':''}
              {ecart?' · écart '+(ecart>0?'+':'')+ecart+' h':''}
              {m.intervenants.length?' · '+m.intervenants.join(', '):''}
            </div>
          </div>
          {m.programme&&<span style={{fontSize:13,fontWeight:600,color:P.abysse,whiteSpace:'nowrap'}}>{m.heures_faites} / {m.heures_programmees} h</span>}
          <Tag label={e.l} small color={e.c==='jamais'?'amber':e.c==='termine'?'teal':'blue'}/>
        </div>
        {m.programme&&<div style={{height:5,borderRadius:99,background:P.border,overflow:'hidden',marginTop:9}}>
          <div style={{width:p+'%',height:'100%',background:P.menthe}}/></div>}
        {ouvert[cle]&&(
          <div style={{marginTop:'0.7rem',paddingTop:'0.7rem',borderTop:`1px solid ${P.border}`}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:P.textm,marginBottom:'0.35rem'}}>
              Annoncé — {m.notions.length} notions
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:'0.6rem'}}>
              {m.notions.length?m.notions.map(n=><span key={n} style={{fontSize:11.5,padding:'3px 9px',borderRadius:99,background:P.surface2,border:`1px solid ${P.border}`}}>{n}</span>)
                :<span style={{fontSize:12,color:P.textm}}>aucune notion au syllabus</span>}
            </div>
            {m.comptes_rendus.length>0&&(
              <>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:P.textm,marginBottom:'0.35rem'}}>
                  Comptes rendus — {m.comptes_rendus.length}
                </div>
                {m.comptes_rendus.map((c,i)=>(
                  <div key={i} style={{background:P.surface2,borderRadius:9,padding:'8px 11px',marginBottom:5,fontSize:12.5,lineHeight:1.55}}>
                    <div style={{fontSize:11,color:P.textm,marginBottom:3}}>{c.date} · {c.intervenant}</div>
                    <div style={{whiteSpace:'pre-wrap'}}>{c.texte}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return(
    <div className="fi">
      {selecteur}
      <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.3rem'}}>
        Couverture — {d.formation.titre_court||d.formation.titre}
      </h2>
      <p style={{fontSize:12.5,color:P.textm,marginBottom:'1rem',lineHeight:1.7,maxWidth:'72ch'}}>
        Arrêté au {d.arrete_au}. Le plan de formation et les syllabi d’un côté, l’émargement de l’autre.
        Aucune saisie n’a été demandée aux intervenants.
      </p>

      <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',marginBottom:'1.25rem'}}>
        {[[R.heures_faites+' h','sur '+R.heures_programmees+' h programmées',false],
          [R.modules_demarres+' / '+R.modules_programmes,'modules démarrés',false],
          [R.modules_termines,'modules terminés',false],
          [R.intervenants,'intervenants',false],
          [R.jamais_programmes,'jamais programmés',R.jamais_programmes>0],
          [d.croisements.length,'familles à plusieurs intervenants',d.croisements.length>0]].map(([v,l,al])=>(
          <div key={l} style={{background:al?'rgba(232,155,119,0.1)':P.surface,border:`1px solid ${al?P.saumon:P.border}`,
            borderLeft:al?`3px solid ${P.saumon}`:`1px solid ${P.border}`,borderRadius:12,padding:'10px 15px',minWidth:126}}>
            <div style={{fontSize:21,fontWeight:600,color:al?'#A85B34':P.abysse,lineHeight:1.15}}>{v}</div>
            <div style={{fontSize:11.5,color:P.textm}}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',gap:'0.4rem',flexWrap:'wrap',marginBottom:'1.25rem'}}>
        {[['couverture','Couverture'],['jamais','Jamais programmés ('+R.jamais_programmes+')'],
          ['croisements','Croisements ('+d.croisements.length+')']].map(([id,l])=>(
          <button key={id} onClick={()=>setOnglet(id)} className="tab-btn"
            style={{background:onglet===id?P.petrole:P.surface,color:onglet===id?P.menthe:P.textm,
              border:`1px solid ${onglet===id?P.petrole:P.border}`,borderRadius:9,padding:'7px 14px',fontSize:13,fontWeight:500}}>{l}</button>
        ))}
      </div>

      {onglet==='couverture'&&d.blocs.map(b=>(
        <div key={b.id}>
          <div style={{display:'flex',alignItems:'baseline',gap:9,margin:'1.1rem 0 0.5rem'}}>
            <Tag label={b.id} small/><span style={{fontSize:14.5,fontWeight:600,color:P.abysse}}>{b.titre}</span>
          </div>
          {b.modules.map(m=>carte({...m,bloc:b.id}))}
        </div>
      ))}
      {onglet==='couverture'&&(d.modules_hors_bloc||[]).length>0&&(
        <div>
          <div style={{display:'flex',alignItems:'baseline',gap:9,margin:'1.1rem 0 0.5rem'}}>
            <Tag label="HB" small/><span style={{fontSize:14.5,fontWeight:600,color:P.abysse}}>Hors bloc</span>
          </div>
          {d.modules_hors_bloc.map(m=>carte({...m,bloc:'HB'}))}
        </div>
      )}

      {onglet==='jamais'&&(
        <>
          <p style={{fontSize:12.5,color:P.textm,marginBottom:'0.9rem',lineHeight:1.7,maxWidth:'72ch'}}>
            Ces modules figurent au plan et n’apparaissent dans aucun créneau de l’année. Sans décision, ils ne
            seront jamais enseignés. Une partie peut relever d’un parcours au choix que ce groupe ne suit pas :
            à vérifier module par module.
          </p>
          {tous.filter(m=>!m.programme).map(carte)}
          {!R.jamais_programmes&&<div style={{...card()}}>Tous les modules du plan sont programmés.</div>}
        </>
      )}

      {onglet==='croisements'&&(
        <>
          <p style={{fontSize:12.5,color:P.textm,marginBottom:'0.9rem',lineHeight:1.7,maxWidth:'72ch'}}>
            Une même famille de notions enseignée par des intervenants différents. Ce n’est pas une faute :
            c’est soit un approfondissement voulu, soit deux fois le même cours. Atlas pose la question avec
            les éléments, il ne tranche pas.
          </p>
          {d.croisements.map(x=>(
            <div key={x.famille} style={{...card({marginBottom:'0.5rem'}),borderLeft:`3px solid ${P.saumon}`}}>
              <div style={{fontSize:14,fontWeight:600,color:P.abysse,marginBottom:3}}>{x.famille}</div>
              <div style={{fontSize:12.5,color:P.abysse}}>{x.intervenants.length} intervenants : <strong>{x.intervenants.join(' · ')}</strong></div>
              <div style={{fontSize:12,color:P.textm,marginTop:3}}>{x.modules.join(' · ')}</div>
              <div style={{fontSize:11.5,color:P.textm,marginTop:2}}>du {x.debut} au {x.fin}</div>
            </div>
          ))}
          {!d.croisements.length&&<div style={{...card()}}>Aucune famille n’est portée par plusieurs intervenants.</div>}
        </>
      )}
    </div>
  )
}

/* ── Proposition de rattachement d'un intitulé CESAR à un module du plan ─────
   Mêmes règles que le lecteur hors ligne, qui a rattaché 108 séances sur 108
   du groupe Créa sans exception. Par ordre de sûreté décroissante :

     1. le code de compétence en tête de l'intitulé — « C7 Audio-Vidéo » et
        le module C7 du plan. C'est la clé la plus fiable, déjà saisie par la
        scolarité, et elle ne dépend d'aucune orthographe.
     2. le libellé exact, une fois retirés les préfixes de parcours
        (« Spé Créa : ») et les numérotations.
     3. le mot qui suit « hackathon » : CESAR nomme ces séances par leur
        contenu quand le plan nomme le module.
     4. le recouvrement de mots signifiants, et seulement au-delà de 60 %.

   Aucune de ces règles n'écrit quoi que ce soit : elles proposent. La
   correspondance ne devient effective qu'au clic. */
const VIDES_ARB = new Set(['de','du','des','la','le','les','et','en','pour','au','aux','d','l','un','une','a','sur'])
const cleLib = t => String(t || '')
  .replace(/^\s*(?:Sp[ée]\s+[^:]*:|Hackathon\b)\s*/i, '')
  .replace(/^\s*C\s?\d{1,3}[a-z]?\s*[-–—:.]?\s*/i, '')
  .replace(/^\s*Module\s*\d+\s*[:.\-–—]\s*/i, '')
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()
const motsArb = t => cleLib(t).split(' ').filter(w => w.length > 2 && !VIDES_ARB.has(w))

function proposerModule(libelleCesar, modules){
  const code=(String(libelleCesar).match(/^\s*C\s?(\d{1,3})/i)||[])[1]
  if(code){
    const m=modules.find(x=>(String(x.titre).match(/^\s*C\s?(\d{1,3})/i)||[])[1]===code)
    if(m)return{module:m,motif:'code C'+code,sur:true}
  }
  const k=cleLib(libelleCesar)
  const exact=modules.find(x=>cleLib(x.titre)===k)
  if(exact)return{module:exact,motif:'intitulé identique',sur:true}

  const h=String(libelleCesar).match(/hackathon\s+([a-zéèêàâîïôûüç]+)/i)
  if(h){
    const mot=h[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,5)
    const m=modules.find(x=>{
      const t=x.titre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      return /hackathon/.test(t)&&t.includes(mot)
    })
    if(m)return{module:m,motif:'hackathon '+h[1],sur:true}
  }
  const A=new Set(motsArb(libelleCesar))
  let best=null,score=0
  for(const m of modules){
    const B=new Set(motsArb(m.titre))
    if(!A.size||!B.size)continue
    let c=0; for(const w of A) if(B.has(w)) c++
    const v=(2*c)/(A.size+B.size)
    if(v>score){score=v;best=m}
  }
  if(score>=0.6)return{module:best,motif:'intitulé proche ('+Math.round(score*100)+' %)',sur:false}
  return{module:null,motif:'aucune correspondance',sur:false}
}

/* ═══ ARBITRAGE DES INTITULÉS DE MATIÈRE ════════════════════════════════════
   CESAR nomme ses matières comme la scolarité les a saisies ; le plan de
   formation les nomme comme le certificateur les attend. Tant que les deux ne
   sont pas reliés, Atlas sait qu'une séance a eu lieu sans savoir de quel
   module il s'agit — et la comparaison annoncé/réalisé reste vide.

   C'est la seule porte par laquelle une correspondance devient effective, et
   elle est volontairement humaine. */
function ArbitrageMatieres(){
  const [matieres,setMatieres]=useState(null)
  const [formations,setFormations]=useState([])
  const [choix,setChoix]=useState({})      // id de matière -> titre de module
  const [occupe,setOccupe]=useState('')
  const [erreur,setErreur]=useState('')
  const [fait,setFait]=useState(0)
  const [diag,setDiag]=useState(null)
  const [dernier,setDernier]=useState(null)

  useEffect(()=>{charger()},[])
  function charger(){
    setErreur('')
    Promise.all([api.cesarMatieres('&a_arbitrer=1'),api.getFormations()])
      .then(([m,f])=>{
        const fs=f.formations||[]
        setFormations(fs)
        // Diagnostic conservé : quand rien ne se rattache, il faut pouvoir dire
        // si c'est la formation qui manque ou les modules qui sont vides,
        // plutôt que de relire le code à l'aveugle.
        setDiag({
          formations:fs.length,
          ids_formations:fs.map(y=>y._id).join(', '),
          ids_matieres:[...new Set((m.matieres||[]).map(x=>x.formation_id))].join(', '),
        })
        const liste=(m.matieres||[]).map(x=>{
          // /api/formations préfixe les champs de la ligne pour les distinguer
          // du contenu du référentiel : l'identifiant est _id, pas id. Chercher
          // id laissait la liste des modules vide et tous les boutons inertes.
          let fo=fs.find(y=>Number(y._id)===Number(x.formation_id))
          // Repli : certaines réponses ne portent pas l'identifiant attendu.
          // Plutôt que de laisser l'écran muet, on propose alors les modules de
          // toutes les promotions — le choix reste humain, et l'origine du
          // repli est visible dans le diagnostic ci-dessus.
          if(!fo&&fs.length===1)fo=fs[0]
          const mods=fo?[...(fo.blocs||[]).flatMap(b=>(b.modules||[]).map(mm=>({...mm,bloc:b.id}))),
                         ...((fo.modules_hors_bloc||[]).map(mm=>({...mm,bloc:'HB'})))]:[]
          const p=proposerModule(x.libelle_cesar,mods)
          return {...x,modules:mods,titre_formation:fo?._titre_court||fo?.formation?.titre||'',proposition:p}
        })
        setMatieres(liste)
        setChoix(Object.fromEntries(liste.filter(x=>x.proposition.module).map(x=>[x.id,x.proposition.module.titre])))
      })
      .catch(e=>setErreur(e.message))
  }

  async function valider(liste){
    setOccupe('envoi');setErreur('')
    let n=0
    try{
      let prev=0,real=0
      for(const m of liste){
        const t=choix[m.id]
        if(!t)continue
        const r=await api.cesarArbitrer(m.formation_id,m.libelle_cesar,t)
        if(r&&r.detail){prev+=r.detail.previsionnel||0;real+=r.detail.realise||0}
        n++
      }
      setFait(f=>f+n)
      // Le rattrapage est la vraie mesure de l'arbitrage : valider sans
      // rattacher aucune séance ne servirait à rien, et devait se voir.
      setDernier({intitules:n,previsionnel:prev,realise:real})
      charger()
    }catch(e){setErreur(e.message)}
    setOccupe('')
  }

  if(matieres===null)return <div style={{textAlign:'center',padding:'2rem'}}><Spinner/></div>

  const sures=matieres.filter(m=>m.proposition.sur&&choix[m.id])
  const douteuses=matieres.filter(m=>!m.proposition.sur)

  return(
    <div className="fi">
      <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.5rem'}}>Arbitrage des matières</h2>
      <p style={{fontSize:13,color:P.textm,marginBottom:'1.25rem',lineHeight:1.7,maxWidth:'72ch'}}>
        CESAR nomme ses matières comme la scolarité les a saisies, le plan de formation comme le certificateur
        les attend. Tant que les deux ne sont pas reliés, une séance émargée reste orpheline et la couverture
        ne se calcule pas. Les propositions ci-dessous viennent du code de compétence quand il existe,
        de l’intitulé sinon — rien ne s’applique sans votre clic.
      </p>

      {erreur&&<div style={{padding:'0.7rem 1rem',background:P.amberbg,border:`1px solid ${P.amber}`,borderRadius:10,fontSize:12.5,color:'#7A4A00',marginBottom:'1rem'}}>{erreur}</div>}

      {diag&&matieres.some(m=>!m.modules.length)&&(
        <div style={{padding:'0.7rem 1rem',background:P.surface2,border:`1px solid ${P.border}`,borderRadius:10,
          fontSize:12,color:P.textm,marginBottom:'0.75rem',fontFamily:'ui-monospace,Menlo,monospace',lineHeight:1.7}}>
          formations chargées : {diag.formations} · identifiants : {diag.ids_formations||'aucun'}<br/>
          formation_id des matières : {diag.ids_matieres||'aucun'}<br/>
          modules trouvés : {matieres.filter(m=>m.modules.length).length} / {matieres.length}
        </div>
      )}

      {matieres.some(m=>!m.modules.length)&&(
        <div style={{padding:'0.7rem 1rem',background:P.amberbg,border:`1px solid ${P.amber}`,borderRadius:10,
          fontSize:12.5,color:'#7A4A00',marginBottom:'1rem',lineHeight:1.6}}>
          {matieres.filter(m=>!m.modules.length).length} intitulés n’ont aucun module à proposer : leur promotion
          n’a pas été retrouvée. Vérifiez que le groupe planning est bien rattaché dans l’onglet Émargement.
        </div>
      )}

      {dernier&&(
        <div style={{padding:'0.7rem 1rem',background:'rgba(93,226,152,0.12)',border:`1px solid ${P.borderm}`,
          borderRadius:10,fontSize:12.5,color:P.abysse,marginBottom:'1rem',lineHeight:1.6}}>
          {dernier.intitules} intitulés arbitrés — {dernier.previsionnel} séances du prévisionnel
          et {dernier.realise} du réalisé rattachées à leur module.
        </div>
      )}

      {matieres.length===0&&(
        <div style={card()}>
          <div style={{fontSize:14,fontWeight:600,color:P.abysse}}>Aucune matière en attente</div>
          <p style={{fontSize:12.5,color:P.textm,margin:'0.3rem 0 0'}}>
            {fait>0?fait+' intitulés arbitrés. ':''}Toutes les matières importées sont rattachées à un module du plan.
          </p>
        </div>
      )}

      {sures.length>0&&(
        <div style={{display:'flex',alignItems:'center',gap:'0.75rem',flexWrap:'wrap',marginBottom:'1rem'}}>
          <button onClick={()=>valider(sures)} disabled={!!occupe}
            style={{background:P.petrole,color:P.menthe,border:'none',borderRadius:9,padding:'9px 18px',
              fontSize:13,fontWeight:600,opacity:occupe?0.6:1}}>
            {occupe?'Envoi…':'Valider les '+sures.length+' correspondances sûres'}
          </button>
          <span style={{fontSize:12.5,color:P.textm}}>
            {douteuses.length>0?douteuses.length+' demandent votre lecture':'toutes les propositions sont sûres'}
          </span>
        </div>
      )}

      {matieres.map(m=>{
        const p=m.proposition
        return(
          <div key={m.id} style={{...card(),borderLeft:`3px solid ${p.sur?P.menthe:P.saumon}`}}>
            <div style={{display:'flex',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:250}}>
                <div style={{fontSize:13.5,fontWeight:600,color:P.abysse}}>{m.libelle_cesar}</div>
                <div style={{fontSize:11.5,color:P.textm,marginTop:2}}>
                  {m.occurrences} séance{m.occurrences>1?'s':''} · {m.titre_formation} · {p.motif}
                </div>
              </div>
              <button onClick={()=>valider([m])} disabled={!choix[m.id]||!!occupe}
                style={{background:choix[m.id]?P.surface:P.surface2,border:`1px solid ${P.border}`,borderRadius:8,
                  padding:'6px 14px',fontSize:12.5,fontWeight:500,opacity:choix[m.id]&&!occupe?1:0.45,
                  cursor:choix[m.id]?'pointer':'not-allowed'}}>Valider</button>
            </div>
            <select value={choix[m.id]||''} onChange={e=>setChoix(c=>({...c,[m.id]:e.target.value}))}
              style={{width:'100%',marginTop:'0.6rem',padding:'8px 11px',borderRadius:9,
                border:`1px solid ${P.border}`,background:P.surface2,fontSize:13,color:P.abysse}}>
              <option value="">— aucun module, laisser en attente —</option>
              {m.modules.map(x=>(
                <option key={x.bloc+'|'+x.titre} value={x.titre}>{x.bloc} — {x.titre}</option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}

/* ═══ IMPORT DE L'ÉMARGEMENT CESAR ══════════════════════════════════════════
   Le réalisé factuel — qui a enseigné quoi, quand, combien d'heures — est la
   seule source qui ne demande rien à personne. Elle arrive aujourd'hui en deux
   fichiers produits par la DSI : la liste des groupes planning, et les séances
   d'un groupe avec leur compte rendu.

   Trois temps, dans cet ordre, parce qu'aucun ne vaut sans le précédent :

     1. les groupes planning entrent en base et sont rattachés à une promotion.
        Une séance dont le groupe n'est pas rattaché est rejetée — c'est voulu :
        mieux vaut un rejet lisible qu'un rattachement deviné.
     2. un essai à blanc montre exactement ce qui serait écrit, sans rien
        écrire. À faire systématiquement sur un export qu'on voit pour la
        première fois.
     3. l'écriture, idempotente : rejouer le même export met à jour, ne
        duplique pas.

   Le prévisionnel reçoit toutes les séances de l'année, y compris celles qui
   n'ont pas encore eu lieu — c'est lui qui permettra d'alerter un intervenant
   avant sa séance. Le réalisé ne reçoit que les séances déjà tenues.

   Ce flux restera manuel tant que la DSI n'expose pas son API de lecture ;
   l'endpoint et les tables sont les mêmes dans les deux cas. */
function ImportCesar({onFini}){
  const [groupes,setGroupes]=useState(null)        // contenu de planning_groups
  const [table,setTable]=useState(null)            // table de rattachement
  const [nomT,setNomT]=useState('')
  const [seances,setSeances]=useState(null)        // contenu de l'export de séances
  const [nomG,setNomG]=useState(''); const [nomS,setNomS]=useState('')
  const [etat,setEtat]=useState(null)
  const [bilan,setBilan]=useState(null)
  const [occupe,setOccupe]=useState('')
  const [erreur,setErreur]=useState('')
  const [formations,setFormations]=useState([])

  useEffect(()=>{
    api.getFormations().then(d=>setFormations(d.formations||[])).catch(()=>{})
    rafraichir()
  },[])
  function rafraichir(){ api.cesarEtat().then(setEtat).catch(()=>setEtat(null)) }

  function lire(fichier,quoi){
    const fr=new FileReader()
    fr.onload=()=>{
      try{
        const d=JSON.parse(fr.result)
        if(quoi==='table'){
          if(!d||!Array.isArray(d.groupes))throw new Error('table de rattachement attendue')
          setTable(d);setNomT(fichier.name);setErreur('');setBilan(null);return
        }
        if(!Array.isArray(d))throw new Error('le fichier doit contenir une liste')
        if(quoi==='groupes'){setGroupes(d);setNomG(fichier.name)}
        else{setSeances(d);setNomS(fichier.name)}
        setErreur('');setBilan(null)
      }catch(e){setErreur(fichier.name+' : '+e.message)}
    }
    fr.readAsText(fichier)
  }

  // Le rattachement d'un groupe à une promotion ne se devine pas : il se lit
  // dans referentiels/groupes-planning-<campus>.json, table produite par
  // l'outil de rattachement et relue à la main. Une première version de cet
  // écran reconnaissait le libellé CESAR par motifs — « mastere 2 » et
  // « ressources humaines » donnant M2 MRH. Ça marchait sur les onze groupes
  // du Mans et aurait échoué au premier libellé tordu, sans rien signaler.
  // Un groupe absent de la table reste à rattacher : c'est un fait à constater,
  // pas un trou à combler par un motif.
  function titreCourtPour(codeCesar){
    if(!table)return ''
    const g=(table.groupes||[]).find(x=>x.code_cesar===codeCesar)
    return g&&g.statut==='rattache'?g.titre_court:''
  }

  async function poserGroupes(){
    if(!groupes||!table)return
    setOccupe('groupes');setErreur('')
    try{
      // Le rattachement se fait au dépôt, pas après : l'endpoint accepte un
      // titre court avec chaque groupe et le résout lui-même. Une première
      // version enchaînait un second appel par groupe, protégé par un test
      // comparant le titre court à un champ absent de /api/formations — le
      // test échouait toujours, aucun groupe n'était rattaché, et les 145
      // séances étaient rejetées pour « groupe non rattaché à un titre ».
      const liste=groupesDepuisCesar(groupes).map(g=>({...g,titre_court:titreCourtPour(g.code_cesar)}))
      const r=await api.cesarPoserGroupes(liste)
      const vises=liste.filter(g=>g.titre_court).length
      const rattaches=r&&typeof r.rattaches==='number'?r.rattaches:vises
      setBilan({titre:'Groupes planning',lignes:[
        ['Groupes déposés',liste.length],
        ['Visés par la table',vises],
        ['Rattachés par le serveur',rattaches],
        ['Hors périmètre',liste.length-vises],
      ],rejets:(r&&r.rejets||[]).slice(0,6).map(x=>({ligne:x.code_cesar||'—',motif:x.motif}))})
      rafraichir()
    }catch(e){setErreur(e.message)}
    setOccupe('')
  }

  async function importer(dry){
    if(!seances)return
    setOccupe(dry?'essai':'ecriture');setErreur('')
    try{
      const aujourdhui=new Date().toISOString().slice(0,10)
      const toutes=seances.map(seanceDepuisCesar).filter(s=>s.date)
      const passees=toutes.filter(s=>s.date<=aujourdhui)
      const prev=await api.cesarImporter('previsionnel',toutes,dry)
      const real=await api.cesarImporter('realise',passees,dry)
      const b=x=>x&&x.bilan?x.bilan:x||{}
      const p=b(prev),r=b(real)
      setBilan({titre:dry?'Essai à blanc — rien n’a été écrit':'Import effectué',lignes:[
        ['Séances de l’année',toutes.length],
        ['Dont déjà tenues',passees.length],
        ['Prévisionnel — créées',p.creees||0],
        ['Prévisionnel — mises à jour',p.mises_a_jour||0],
        ['Prévisionnel — rejetées',p.rejetees||0],
        ['Réalisé — créées',r.creees||0],
        ['Réalisé — avec compte rendu',r.avec_compte_rendu||0],
        ['Intitulés de matière nouveaux',(p.nouveaux_intitules||[]).length],
        ['Groupes inconnus',(p.groupes_inconnus||[]).join(', ')||'aucun'],
      ],rejets:(p.rejets||[]).slice(0,6)})
      if(!dry){rafraichir();onFini&&onFini()}
    }catch(e){setErreur(e.message)}
    setOccupe('')
  }

  const zone=(id,label,nom,quoi)=>(
    <div onClick={()=>document.getElementById(id).click()}
      style={{flex:1,minWidth:230,border:`2px dashed ${nom?P.borderm:P.border}`,borderRadius:12,padding:'1.1rem',
        textAlign:'center',cursor:'pointer',background:nom?'rgba(93,226,152,0.06)':'transparent'}}>
      <input id={id} type="file" accept=".json" style={{display:'none'}}
        onChange={e=>e.target.files[0]&&lire(e.target.files[0],quoi)}/>
      <div style={{fontSize:12.5,fontWeight:600,color:P.abysse}}>{label}</div>
      <div style={{fontSize:11.5,color:nom?P.petrole:P.textm,marginTop:3}}>{nom||'Aucun fichier'}</div>
    </div>
  )

  return(
    <div className="fi">
      <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.5rem'}}>Émargement CESAR</h2>
      <p style={{fontSize:13,color:P.textm,marginBottom:'1.25rem',lineHeight:1.7,maxWidth:'70ch'}}>
        Le réalisé factuel : quelles séances ont eu lieu, quand, avec quel intervenant, pour combien d’heures.
        Croisé au plan de formation, c’est ce qui donne la couverture réelle d’une promotion — sans rien demander
        aux intervenants.
      </p>

      {etat&&(
        <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',marginBottom:'1.25rem'}}>
          {[['Groupes en base',(etat.groupes_planning||[]).length],
            ['Rattachés',(etat.groupes_planning||[]).filter(g=>g.statut==='rattache').length],
            ['Séances prévues',(etat.groupes_planning||[]).reduce((n,g)=>n+(g.seances_prevues||0),0)],
            ['Séances réalisées',etat.realise?.seances_importees??0],
            ['Comptes rendus',etat.realise?.avec_compte_rendu??0],
            ['Matières à arbitrer',etat.matieres?.a_arbitrer??0]].map(([l,v])=>(
            <div key={l} style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:10,padding:'8px 14px',minWidth:120}}>
              <div style={{fontSize:19,fontWeight:600,color:P.abysse,lineHeight:1.2}}>{v}</div>
              <div style={{fontSize:11,color:P.textm}}>{l}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{fontSize:11,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:P.textm,marginBottom:'0.5rem'}}>
        1 · Les deux fichiers de la DSI, et la table de rattachement
      </div>
      <div style={{display:'flex',gap:'0.6rem',flexWrap:'wrap',marginBottom:'0.9rem'}}>
        {zone('f-groupes','Groupes planning (.json)',nomG,'groupes')}
        {zone('f-seances','Séances du groupe (.json)',nomS,'seances')}
        {zone('f-table','Table de rattachement (.json)',nomT,'table')}
      </div>

      <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap',marginBottom:'1.5rem'}}>
        <button onClick={poserGroupes} disabled={!groupes||!table||!!occupe}
          style={{background:groupes?P.surface:P.surface2,border:`1px solid ${P.border}`,borderRadius:9,
            padding:'8px 16px',fontSize:13,fontWeight:500,opacity:groupes&&table&&!occupe?1:0.5,cursor:groupes&&table?'pointer':'not-allowed'}}>
          {occupe==='groupes'?'Dépôt en cours…':'Déposer et rattacher les groupes'}
        </button>
        <button onClick={()=>importer(true)} disabled={!seances||!!occupe}
          style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:9,padding:'8px 16px',
            fontSize:13,fontWeight:500,opacity:seances&&!occupe?1:0.5,cursor:seances?'pointer':'not-allowed'}}>
          {occupe==='essai'?'Essai en cours…':'Essai à blanc'}
        </button>
        <button onClick={()=>importer(false)} disabled={!seances||!!occupe}
          style={{background:P.petrole,color:P.menthe,border:'none',borderRadius:9,padding:'8px 18px',
            fontSize:13,fontWeight:600,opacity:seances&&!occupe?1:0.5,cursor:seances?'pointer':'not-allowed'}}>
          {occupe==='ecriture'?'Import en cours…':'Importer'}
        </button>
      </div>

      {erreur&&(
        <div style={{padding:'0.7rem 1rem',background:P.amberbg,border:`1px solid ${P.amber}`,borderRadius:10,
          fontSize:12.5,color:'#7A4A00',marginBottom:'1rem'}}>{erreur}</div>
      )}

      {bilan&&(
        <div style={card()}>
          <div style={{fontSize:14,fontWeight:600,color:P.abysse,marginBottom:'0.6rem'}}>{bilan.titre}</div>
          {bilan.lignes.map(([l,v])=>(
            <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${P.border}`}}>
              <span style={{fontSize:12.5,color:P.textm}}>{l}</span>
              <span style={{fontSize:12.5,fontWeight:600,color:P.abysse}}>{String(v)}</span>
            </div>
          ))}
          {(bilan.rejets||[]).length>0&&(
            <div style={{marginTop:'0.75rem'}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:P.textm,marginBottom:'0.3rem'}}>Premiers rejets</div>
              {bilan.rejets.map((r,i)=>(
                <div key={i} style={{fontSize:11.5,color:'#7A4A00'}}>ligne {r.ligne} — {r.motif}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ═══ VUE DIRECTION DES PROGRAMMES ════════════════════════════════════════ */
function VueDir({user,onLogout}){
  const [atelierOpen,setAtelierOpen]=useState(false)
  const [onglet,setOnglet]=useState('formations')
  const [formations,setFormations]=useState([])
  const [loading,setLoading]=useState(true)
  const [syncEnCours,setSyncEnCours]=useState(false)
  const [syncRapport,setSyncRapport]=useState(null)
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
        onglets={[{id:'formations',label:'Formations'},{id:'cesar',label:'Émargement'},{id:'matieres',label:'Matières'},{id:'couverture',label:'Couverture'},{id:'cartographie',label:'Cartographie'},{id:'digest',label:'Digest'},{id:'alertes',label:`Alertes (${totalAlertes})`},{id:'groupes',label:'Groupes'},{id:'comptes',label:'Comptes'}]}/>
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

        {onglet==='cesar'&&<ImportCesar/>}
        {onglet==='matieres'&&<ArbitrageMatieres/>}
        {onglet==='couverture'&&<VueCouverture formations={formations} formationId={fCarto?._id}/>}
        {onglet==='formations'&&(
          <div className="fi">
            <div style={{marginBottom:'1.25rem'}}>
              <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,margin:0,fontSize:24}}>Référentiels</h2>
              <p style={{fontSize:13,color:P.textm,marginTop:'0.25rem'}}>{formations.length} promotion{formations.length>1?'s':''} en base · campus modifiable par titre</p>
            </div>

            {/* Synchronisation depuis le dépôt — voie unique depuis le
                05/10/2026. Le dépôt de fichiers analysé par Claude dans le
                navigateur a été retiré : ses résultats s'empilaient dans le
                même data_json sans jamais rien retirer (blocs en double du
                07/09), et la première synchronisation les effaçait de toute
                façon. La structure d'un titre vient des référentiels
                versionnés : reproductible, relisible en diff, remplacée en
                bloc. */}
            <div style={card({marginBottom:'1.25rem',background:'rgba(93,226,152,0.06)',border:`1px solid ${P.borderm}`})}>
              <div style={{fontSize:12,fontWeight:600,color:P.abysse,marginBottom:'0.35rem'}}>Référentiels du dépôt</div>
              <p style={{fontSize:12,color:P.textm,margin:'0 0 0.7rem',lineHeight:1.6}}>
                Remplace intégralement la structure des promotions par les fichiers de <code style={{fontSize:11}}>referentiels/</code>, produits par l'extracteur et validés en commit. Efface tout résidu d'ingestion antérieure.
              </p>
              <button disabled={syncEnCours} onClick={async()=>{
                setSyncEnCours(true);setError('');setSyncRapport(null)
                try{ const r=await api.synchroniserReferentiels(); setSyncRapport(r.rapport||[]); await loadFormations() }
                catch(e){ setError('Synchronisation : '+(e&&e.message?e.message:String(e))) }
                finally{ setSyncEnCours(false) }
              }} style={{padding:'0.6rem 1.4rem',borderRadius:8,border:'none',fontSize:13,fontWeight:600,cursor:syncEnCours?'wait':'pointer',
                background:`linear-gradient(135deg,${P.petrole},${P.menthe})`,color:P.abysse}}>
                {syncEnCours?'Synchronisation…':'Synchroniser depuis le dépôt'}
              </button>
              {syncRapport&&(
                <div style={{marginTop:'0.75rem',fontSize:12,color:P.abysse,lineHeight:1.7}}>
                  {syncRapport.map((r,i)=>(
                    <div key={i} style={{paddingTop:4,borderTop:i?`1px solid ${P.border}`:'none'}}>
                      <strong>{r.promotion||r.cle}</strong> — {r.etat}
                      {r.blocs!==undefined&&<span style={{color:P.textm}}> · {r.blocs} blocs, {r.modules} modules, {r.competences} compétences{r.notions?', ':''}{r.notions?<strong style={{color:P.petrole}}>{r.notions} notions</strong>:null}{r.signaux?<span style={{color:P.textm}}>, {r.signaux} signaux</span>:null}{r.controles_ok?'':' · contrôles en écart'}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loading?<div style={{textAlign:'center',padding:'2rem'}}><Spinner/></div>:
              formations.length===0?<Empty icon="🎓" titre="Aucun référentiel en base" msg="Lancez la synchronisation depuis le dépôt ci-dessus."/>:
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

        {onglet==='cartographie'&&(
          <div className="fi">
            {formations.length===0?<Empty icon="🗺" titre="Aucune formation" msg="Aucun référentiel en base — synchroniser depuis le dépôt dans l'onglet Formations." action="Formations →" onClick={()=>setOnglet('formations')}/>:<>
              {formations.length>1&&<div style={{display:'flex',gap:'0.4rem',marginBottom:'1rem',flexWrap:'wrap'}}>{formations.map(f=><button key={f._id} onClick={()=>setSelF(f)} style={{padding:'5px 14px',borderRadius:8,fontSize:12,fontWeight:500,cursor:'pointer',border:`1px solid ${fCarto?._id===f._id?P.borderm:P.border}`,background:fCarto?._id===f._id?'rgba(93,226,152,0.12)':P.surface,color:fCarto?._id===f._id?P.petrole:P.textm}}>{f.formation?.titre||'?'}</button>)}</div>}
              <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>{fCarto?.formation?.titre||'Cartographie'}</h2>
              <CartographieTitre formation={fCarto}/>
            </>}
          </div>
        )}

        {onglet==='digest'&&(
          <div className="fi">
            {formations.length===0?<Empty icon="✉" titre="Aucune formation" msg="Aucun référentiel en base — synchroniser depuis le dépôt dans l'onglet Formations." action="Formations →" onClick={()=>setOnglet('formations')}/>:<>
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

        {onglet==='groupes'&&<GroupesOptions formations={formations}/>}
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
        onglets={[{id:'formations',label:'Mes formations'},{id:'cartographie',label:'Cartographie'},{id:'blocs',label:'Blocs'},{id:'alertes',label:`Alertes (${alertes.length})`},{id:'groupes',label:'Groupes'},{id:'comptes',label:'Comptes'}]}/>
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
          {onglet==='cartographie'&&<div className="fi"><h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>{f.formation?.titre}</h2><CartographieTitre formation={f}/></div>}
          {onglet==='blocs'&&<div className="fi"><h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>Blocs</h2>{(f.blocs||[]).map(b=><details key={b.id} style={{...card(),marginBottom:'0.6rem'}}><summary style={{listStyle:'none',display:'flex',justifyContent:'space-between',cursor:'pointer'}}><div><Tag label={b.id} small/><span style={{marginLeft:'0.5rem',fontSize:14,fontWeight:600,color:P.abysse}}>{b.titre}</span><div style={{fontSize:11,color:P.textm,marginTop:3}}>{(b.competences||[]).length}C · {(b.modules||[]).length}M</div></div><span style={{fontSize:18,color:P.textm}}>▾</span></summary><div style={{marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:`1px solid ${P.border}`}}>{(b.modules||[]).map(m=><div key={m.id} style={{background:P.surface2,borderRadius:8,padding:'0.5rem 0.75rem',marginBottom:'0.35rem',border:`1px solid ${P.border}`}}><div style={{fontSize:13,fontWeight:500,color:P.abysse}}>{m.titre}</div>{m.intervenant&&<div style={{fontSize:11,color:P.textm}}>{m.intervenant}</div>}{m.notions_cles?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'0.25rem',marginTop:'0.3rem'}}>{m.notions_cles.map(n=><Tag key={n} label={n} small/>)}</div>}</div>)}</div></details>)}</div>}
          {onglet==='alertes'&&<div className="fi"><h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.5rem'}}>Alertes</h2><p style={{fontSize:12,color:P.textm,marginBottom:'1.25rem'}}>Ignorez les alertes non pertinentes — elles restent réactivables.</p><AlertesList formations={[f]} showFormationTitle={false}/></div>}
          {onglet==='groupes'&&<GroupesOptions formations={formations}/>}
          {onglet==='comptes'&&(
            <div className="fi">
              <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.75rem'}}>Comptes intervenants</h2>
              <p style={{fontSize:13,color:P.textm,marginBottom:'1.25rem',lineHeight:1.7}}>Choisissez le titre, déposez l'export du CRM : Claude apparie les matières aux modules, vous créez les comptes. Les mots de passe ne s'affichent qu'une fois.</p>
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
/* Rattachement d'une séance à son module. Le pont CESAR écrit dans
   `module_ref` l'INTITULÉ du module du plan de formation — c'est ce que
   l'arbitrage des matières envoie (module.titre). L'ancienne UI comparait ce
   champ à l'identifiant interne ("B01-M1"), hérité du modèle déclaratif :
   aucune séance émargée ne se rattachait donc à son bloc, le journal affichait
   « — » et l'arborescence restait vide. On accepte les deux formes. */
function cleModule(v){ return String(v==null?'':v).trim().toLowerCase() }
function moduleIndex(blocs,horsBloc){
  const idx={}
  const poser=(e,m)=>{ idx[cleModule(m.titre)]=e; idx[cleModule(m.id)]=e }
  ;(blocs||[]).forEach(b=>(b.modules||[]).forEach(m=>poser({bloc:b.id,blocTitre:b.titre,module:m},m)))
  ;(horsBloc||[]).forEach(m=>poser({bloc:'HB',blocTitre:'Hors bloc',module:m},m))
  return idx
}
function memeModule(ref,m){
  const k=cleModule(ref)
  return !!k&&(k===cleModule(m.titre)||k===cleModule(m.id))
}
function normCode(c){ return String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'') }

/* Les 4 états du journal des séances (cf api/fr.js calculerJournal), refondus
   le 07/10/2026. Les anciens — Conforme / Écart + / Écart − / Non déclarée —
   comparaient deux champs du modèle déclaratif que le pont CESAR n'alimente
   pas : toute séance émargée s'affichait « Conforme » et toute séance à venir
   passait en alerte. Ici, un seul état est un signal : `manquante`.
   Les clés `nominal` et `alerte` restent reconnues le temps qu'un cache serveur
   ou un digest déjà généré finisse de s'écouler. */
const ETATS_SEANCE={
  tenue_cr:{label:'Tenue · CR',st:'ok'},
  tenue:{label:'Tenue',st:'ok'},
  a_venir:{label:'À venir',st:'idle'},
  manquante:{label:'Non émargée',st:'warn'},
  nominal:{label:'Tenue',st:'ok'},
  alerte:{label:'Non émargée',st:'warn'},
}
function etatLabel(etat){ return (ETATS_SEANCE[etat]||{}).label||'—' }
function etatSt(etat){ return (ETATS_SEANCE[etat]||{}).st||'idle' }

/* Verdict par compétence, cumulé depuis septembre et arrêté à la fin du mois
   affiché. `absente` est l'écart qui engage la certification : il ne se lit
   nulle part ailleurs dans le système d'information. */
const ETATS_COMP={
  couverte:{label:'Couverte',st:'ok'},
  programmee:{label:'Programmée',st:'idle'},
  absente:{label:'Sans créneau',st:'warn'},
}
function compLabel(e){ return (ETATS_COMP[e]||{}).label||'—' }
function compSt(e){ return (ETATS_COMP[e]||{}).st||'idle' }

/* Distorsion entre le volume du plan de formation et celui du calendrier. */
const ETATS_DIST={
  jamais_programme:'Jamais programmé',
  sous_volume:'Sous-volume',
  sur_volume:'Sur-volume',
}
function distLabel(e){ return ETATS_DIST[e]||'Écart' }
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
/* ── Groupes d'options intensives ────────────────────────────────────────────
   Les étudiants choisissent individuellement leur option ; une fois les choix
   connus, chaque option donne lieu à un ou plusieurs groupes que le RP
   alimente. Le rattachement se fait par identifiant de groupe, ce qui permet
   de renommer un groupe sans perdre ses membres. */
// Les imports de comptes annoncent .csv, .xlsx et .xls, mais ne lisaient le
// fichier qu'en texte brut : un classeur Excel y arrivait sous forme d'archive
// binaire, et l'analyse echouait sur « Fichier vide » sans dire pourquoi. Ce
// pont convertit un tableur en CSV avant analyse, et refuse explicitement les
// formats qu'on ne sait pas ouvrir.
async function fichierVersTexte(file){
  const ext=String(file.name||'').split('.').pop().toLowerCase()
  if(ext==='xlsx'||ext==='xlsm'){
    const {lireClasseur}=await import('./lire-xlsx.js')
    const buf=await file.arrayBuffer()
    const brut=await lireClasseur(buf)
    // lireClasseur separe les colonnes par « | » et prefixe chaque feuille ;
    // parseCSV attend des virgules et pas d'en-tete de feuille.
    return brut.split('\n').filter(l=>!l.startsWith('### FEUILLE'))
      .map(l=>l.split(' | ').map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n')
  }
  if(ext==='xls')throw new Error('Le format .xls (ancien binaire) n\'est pas lisible. Réenregistrer en .xlsx ou .csv.')
  return await file.text()
}

function GroupesOptions({formations}){
  // Les formations arrivent de facon asynchrone : a la premiere image la liste
  // est vide, donc initialiser fid depuis formations[0] le laissait a null pour
  // toujours. Le titre affiche dans le menu n'etait alors pas celui charge, et
  // le premier de la liste restait inatteignable — aucun changement de valeur
  // ne declenchant onChange.
  const [fid,setFid]=useState(null)
  const [data,setData]=useState(null)
  const [busy,setBusy]=useState(false)
  const [err,setErr]=useState('')
  const [nouveau,setNouveau]=useState('')

  async function charger(id){
    if(!id)return
    setErr('')
    try{ setData(await api.getGroupes(id)) }
    catch(e){ setErr(e.message); setData(null) }
  }
  useEffect(()=>{ if(fid==null&&formations.length) setFid(formations[0]._id) },[formations,fid])
  useEffect(()=>{charger(fid)},[fid])

  async function agir(fn){
    setBusy(true);setErr('')
    try{ await fn(); await charger(fid) }
    catch(e){ setErr(e.message) }
    finally{ setBusy(false) }
  }

  const groupes=data?.groupes||[]
  const etudiants=data?.etudiants||[]
  const sansGroupe=data?.options_sans_groupe||[]
  const nonAffectes=etudiants.filter(e=>!e.groupe_id)

  return (
    <div className="fi">
      <h2 style={{fontFamily:'Georgia,serif',fontWeight:400,color:P.abysse,marginTop:0,fontSize:24,marginBottom:'0.4rem'}}>Groupes d'options</h2>
      <p style={{fontSize:13,color:P.textm,marginBottom:'1.5rem',lineHeight:1.7}}>
        Chaque étudiant suit une seule option intensive. Le rattacher à son groupe permet de ne compter, dans sa couverture, que l'option qu'il suit réellement.
      </p>

      <div style={card({marginBottom:'1rem'})}>
        <div style={{fontSize:12,fontWeight:600,color:P.abysse,marginBottom:'0.6rem'}}>Titre</div>
        <select value={fid||''} onChange={e=>setFid(Number(e.target.value))}
          style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:8,padding:'0.6rem 0.8rem',fontSize:13,color:P.abysse,background:P.surface,outline:'none'}}>
          {formations.map(f=><option key={f._id} value={f._id}>{f._titre_court||f.formation?.titre||'Sans titre'}</option>)}
        </select>
      </div>

      {err&&<div style={{marginBottom:'1rem',padding:'0.75rem 1rem',background:P.redbg,border:`1px solid ${P.red}`,borderRadius:8,fontSize:12,color:'#8B1A1A'}}>{err}</div>}

      {sansGroupe.length>0&&(
        <div style={{marginBottom:'1rem',padding:'0.85rem 1rem',background:'#FDF1EB',border:'1px solid #E89B77',borderRadius:8,fontSize:12,color:'#B5643C',lineHeight:1.6}}>
          {sansGroupe.length} option(s) du référentiel sans groupe : {sansGroupe.map(o=>o.titre).join(' · ')}.
          <button disabled={busy} onClick={()=>agir(()=>api.syncGroupes(fid))}
            style={{marginLeft:8,padding:'3px 12px',borderRadius:20,border:'1px solid #E89B77',background:P.surface,color:'#B5643C',fontSize:11,fontWeight:600,cursor:busy?'wait':'pointer'}}>Créer les groupes</button>
        </div>
      )}

      {data&&groupes.length===0&&sansGroupe.length===0&&(
        <div style={card()}><div style={{fontSize:13,color:P.textm}}>Ce titre ne comporte aucune option au référentiel. Rien à répartir.</div></div>
      )}

      {groupes.map(g=>{
        const membres=etudiants.filter(e=>e.groupe_id===g.id)
        return (
          <div key={g.id} style={card({marginBottom:'0.75rem'})}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:'0.6rem'}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:P.abysse}}>{g.nom}</div>
                <div style={{fontSize:11,color:P.textm,marginTop:2}}>{g.bloc_id||'—'}{g.option_groupe?' · '+g.option_groupe:''} · {g.effectif} étudiant(s)</div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button disabled={busy} onClick={()=>{const n=window.prompt('Nouveau nom du groupe',g.nom);if(n&&n.trim())agir(()=>api.renommerGroupe(g.id,n.trim()))}}
                  style={{padding:'4px 12px',borderRadius:20,border:`1px solid ${P.border}`,background:P.surface,color:P.textm,fontSize:11,cursor:'pointer'}}>Renommer</button>
                <button disabled={busy} onClick={()=>{if(window.confirm('Supprimer « '+g.nom+' » ? Les étudiants seront détachés, pas supprimés.'))agir(()=>api.supprimerGroupe(g.id))}}
                  style={{padding:'4px 12px',borderRadius:20,border:`1px solid ${P.red}`,background:P.surface,color:P.red,fontSize:11,cursor:'pointer'}}>Supprimer</button>
              </div>
            </div>
            {membres.length===0
              ? <div style={{fontSize:12,color:P.textm,fontStyle:'italic'}}>Aucun étudiant rattaché.</div>
              : <div style={{display:'flex',flexWrap:'wrap',gap:'0.35rem'}}>
                  {membres.map(m=>(
                    <span key={m.inscription_id} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 6px 3px 12px',borderRadius:20,background:'rgba(93,226,152,0.12)',border:`1px solid ${P.borderm}`,fontSize:12,color:P.petrole}}>
                      {m.prenom} {m.nom}
                      <button disabled={busy} title="Retirer du groupe" onClick={()=>agir(()=>api.affecterEtudiant(m.inscription_id,null))}
                        style={{color:P.textm,fontSize:14,lineHeight:1,padding:'0 4px',cursor:'pointer'}}>×</button>
                    </span>
                  ))}
                </div>}
          </div>
        )
      })}

      {groupes.length>0&&(
        <div style={card({marginBottom:'0.75rem'})}>
          <div style={{fontSize:12,fontWeight:600,color:P.abysse,marginBottom:'0.6rem'}}>Étudiants sans groupe <span style={{fontWeight:400,color:P.textm}}>({nonAffectes.length})</span></div>
          {etudiants.length===0
            ? <div style={{fontSize:12,color:P.textm,fontStyle:'italic'}}>Aucun étudiant inscrit à ce titre. Les importer depuis l'écran Comptes.</div>
            : nonAffectes.length===0
              ? <div style={{fontSize:12,color:P.petrole}}>Tous les étudiants sont répartis.</div>
              : nonAffectes.map(e=>(
                  <div key={e.inscription_id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'0.4rem 0',borderBottom:`1px solid ${P.border}`}}>
                    <span style={{fontSize:13,color:P.abysse}}>{e.prenom} {e.nom} <span style={{fontSize:11,color:P.textm}}>{e.email}</span></span>
                    <select disabled={busy} defaultValue="" onChange={ev=>{const v=ev.target.value;if(v)agir(()=>api.affecterEtudiant(e.inscription_id,Number(v)))}}
                      style={{border:`1px solid ${P.border}`,borderRadius:8,padding:'4px 8px',fontSize:12,color:P.abysse,background:P.surface,outline:'none'}}>
                      <option value="">Affecter à…</option>
                      {groupes.map(g=><option key={g.id} value={g.id}>{g.nom}</option>)}
                    </select>
                  </div>
                ))}
        </div>
      )}

      <div style={card()}>
        <div style={{fontSize:12,fontWeight:600,color:P.abysse,marginBottom:'0.5rem'}}>Groupe supplémentaire <span style={{fontWeight:400,color:P.textm}}>(dédoubler une option à fort effectif)</span></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <input value={nouveau} onChange={e=>setNouveau(e.target.value)} placeholder="Ex : Option Création — groupe B"
            style={{flex:1,minWidth:220,border:`1px solid ${P.border}`,borderRadius:8,padding:'0.55rem 0.8rem',fontSize:13,color:P.abysse,outline:'none'}}/>
          <button disabled={busy||!nouveau.trim()||!fid} onClick={()=>agir(async()=>{await api.creerGroupe(fid,nouveau.trim(),'','');setNouveau('')})}
            style={{padding:'0.55rem 1.2rem',borderRadius:8,border:'none',fontSize:13,fontWeight:600,cursor:(nouveau.trim()&&fid)?'pointer':'not-allowed',
              background:(nouveau.trim()&&fid)?`linear-gradient(135deg,${P.petrole},${P.menthe})`:'rgba(19,69,71,0.08)',color:(nouveau.trim()&&fid)?P.abysse:P.textm}}>Créer</button>
        </div>
      </div>
    </div>
  )
}

function Cartographie2({blocs,mode,sel,onSelect,titre}){
  const deploy = mode==='deploiement'
  const n = blocs.length||1
  const [survol,setSurvol] = useState(null)

  // Rosace : un cercle par bloc de compétences, rien d'autre.
  //
  // La version précédente empilait sur la même image les nœuds, une couronne de
  // satellites par compétence, un libellé complet et un badge « au choix ». À
  // vingt-et-un blocs, ces quatre couches se recouvraient au point que la carte
  // ne se lisait plus. Seuls les blocs constituent la cartographie : le détail
  // se révèle au survol, où il dispose de toute la place voulue.
  const rNode = n<=8 ? 40 : n<=14 ? 33 : 27
  const ecart = 16                              // respiration entre deux cercles
  const sin   = Math.sin(Math.PI/Math.max(n,2))
  const R     = Math.max(150, Math.ceil((rNode+ecart/2)/sin))
  const marge = rNode + 26
  const W     = Math.round(2*(R+marge))
  const H     = Math.round(2*(R+marge))
  const cx = W/2, cy = H/2
  const rCentre = Math.min(54, Math.max(34, R*0.22))

  // Identifiants longs (B04_OPT_EVENEMENTIELLE) abrégés pour tenir dans le
  // cercle. L'intitulé complet reste accessible au survol.
  function codeCourt(id){
    const s=String(id||'').replace(/^B\d+[_-]/,'').replace(/^BLC/,'')||String(id||'')
    return s.length>8 ? s.slice(0,7)+'…' : s
  }

  const positioned = blocs.map((b,i)=>{
    const a = -Math.PI/2 + i*(2*Math.PI/n)
    return {...b, x:+(cx+Math.cos(a)*R).toFixed(1), y:+(cy+Math.sin(a)*R).toFixed(1), ang:a}
  })
  const actif = positioned.find(b=>b.id===survol)

  return (
    <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 18px',borderBottom:`1px solid ${P.border}`,flexWrap:'wrap',gap:8}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:P.petrole}}>Cartographie du titre</div>
        <div style={{fontSize:11,color:AT.idleText}}>{n} bloc{n>1?'s':''} · survoler pour le détail</div>
      </div>

      <div style={{position:'relative',padding:'8px 12px 4px'}}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto',display:'block'}}>
          {/* Rayons discrets vers le centre : ils donnent la forme de rosace
              sans prétendre représenter une relation entre blocs. */}
          {positioned.map(b=>(
            <line key={'r'+b.id} x1={cx} y1={cy} x2={b.x} y2={b.y} stroke="#E2ECE8" strokeWidth={1}/>
          ))}

          {positioned.map(b=>{
            const option = b.nature==='option'
            const vise   = survol===b.id || (sel&&sel.kind==='bloc'&&sel.id===b.id)
            const col    = deploy ? (b.st==='warn'?AT.warn:b.st==='idle'?AT.idle:AT.ok) : (option?'#E89B77':'#CBDCD7')
            return (
              <g key={b.id} style={{cursor:'pointer'}}
                onMouseEnter={()=>setSurvol(b.id)} onMouseLeave={()=>setSurvol(null)}
                onClick={()=>onSelect({kind:'bloc',id:b.id})}>
                {vise&&<circle cx={b.x} cy={b.y} r={rNode+8} fill="none" stroke={col} strokeWidth={1} opacity={0.45}/>}
                {deploy&&(
                  <circle cx={b.x} cy={b.y} r={rNode+6} fill="none" stroke="#EAF3EF" strokeWidth={4}/>
                )}
                {deploy&&(
                  <circle cx={b.x} cy={b.y} r={rNode+6} fill="none" stroke={col} strokeWidth={4} strokeLinecap="round"
                    strokeDasharray={`${(2*Math.PI*(rNode+6)*(b.pct||0)/100).toFixed(1)} ${(2*Math.PI*(rNode+6)).toFixed(1)}`}
                    transform={`rotate(-90 ${b.x} ${b.y})`}/>
                )}
                <circle cx={b.x} cy={b.y} r={rNode}
                  fill={option?'#FDF6F2':(vise?'#F2FAF6':P.surface)}
                  stroke={option?'#E89B77':(deploy?col:'#CBDCD7')}
                  strokeWidth={vise?2:1.3}
                  strokeDasharray={deploy?'none':(option?'2 4':'5 4')}/>
                <text x={b.x} y={b.y-3} textAnchor="middle"
                  style={{font:`700 ${n<=8?13:11.5}px 'DM Sans',system-ui`,fill:P.abysse,pointerEvents:'none'}}>
                  {codeCourt(b.id)}
                </text>
                <text x={b.x} y={b.y+12} textAnchor="middle"
                  style={{font:`600 ${n<=8?11:10}px 'DM Sans',system-ui`,fill:option?'#B5643C':AT.idleText,pointerEvents:'none'}}>
                  {deploy?(b.pct||0)+' %':(b.comp||0)+' comp.'}
                </text>
                {deploy&&b.anom>0&&(
                  <g pointerEvents="none">
                    <circle cx={b.x+rNode*0.72} cy={b.y-rNode*0.72} r={9} fill={AT.warn}/>
                    <text x={b.x+rNode*0.72} y={b.y-rNode*0.72+3.5} textAnchor="middle"
                      style={{font:"700 10px 'DM Sans'",fill:P.abysse}}>{b.anom}</text>
                  </g>
                )}
              </g>
            )
          })}

          <circle cx={cx} cy={cy} r={rCentre} fill={P.abysse}/>
          <text x={cx} y={cy-4} textAnchor="middle" style={{font:"600 12px 'DM Sans'",fill:P.menthe}}>{titreCourt(titre)}</text>
          <text x={cx} y={cy+12} textAnchor="middle" style={{font:"400 10px 'DM Sans'",fill:'rgba(227,255,240,.5)'}}>{n} bloc{n>1?'s':''}</text>
        </svg>

        {/* Détail au survol, ancré sous le centre : position fixe, donc jamais
            hors cadre et jamais superposé à un autre libellé. */}
        <div style={{minHeight:64,margin:'2px 4px 6px',padding:'10px 14px',borderRadius:10,
          background:actif?(actif.nature==='option'?'#FDF6F2':'#F2FAF6'):'transparent',
          border:`1px solid ${actif?(actif.nature==='option'?'#E89B77':P.borderm):'transparent'}`,
          transition:'background .12s'}}>
          {actif ? (
            <>
              <div style={{display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:'.06em',textTransform:'uppercase',color:AT.idleText}}>{actif.id}</span>
                {actif.nature==='option'&&<span style={{fontSize:9.5,fontWeight:700,letterSpacing:'.05em',textTransform:'uppercase',color:'#B5643C'}}>parcours au choix{actif.optGroupe?' · '+actif.optGroupe:''}</span>}
              </div>
              <div style={{fontSize:13.5,fontWeight:600,color:P.abysse,lineHeight:1.35,marginTop:2}}>{actif.titre}</div>
              <div style={{fontSize:11.5,color:P.textm,marginTop:3}}>
                {actif.comp||0} compétence{(actif.comp||0)>1?'s':''} · {actif.mods||0} module{(actif.mods||0)>1?'s':''}
                {deploy?` · couverture ${actif.pct||0} %`:''}
                {deploy&&actif.anom>0?` · ${actif.anom} anomalie${actif.anom>1?'s':''}`:''}
                {actif.qui?` · ${actif.qui}`:''}
              </div>
              {/* Un bloc se définit par son épreuve : c'est l'information la
                  plus structurante, elle passe avant les compteurs. */}
              {(actif.epreuves||[]).length>0&&(
                <div style={{marginTop:5,paddingTop:5,borderTop:`1px solid ${P.border}`,fontSize:11.5,color:P.petrole,lineHeight:1.5}}>
                  {actif.epreuves.map((e,i)=>(
                    <div key={i}>
                      <strong>{e.intitule}</strong>
                      {e.modalite?' · '+e.modalite:''}
                      {e.duree?' · '+e.duree+' h':''}
                      {e.date?' · le '+e.date:''}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{fontSize:12,color:AT.idleText,paddingTop:6}}>Survoler un bloc pour en voir le détail · cliquer pour l'ouvrir dans l'Inspecteur.</div>
          )}
        </div>
      </div>

      <div style={{padding:'10px 18px',borderTop:`1px solid ${P.border}`,fontSize:10.5,color:AT.idleText}}>
        {(deploy?"Anneau = couverture réelle du bloc · pastille = anomalies":"Contours pointillés = structure planifiée, aucune séance encore déclarée")+(blocs.some(b=>b.nature==='option')?" · contour saumon = parcours au choix, un seul suivi par étudiant":"")}
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

        {insp.texte&&(
          <div style={{marginTop:16}}>
            <div style={{fontSize:9.5,fontWeight:600,letterSpacing:'.13em',textTransform:'uppercase',color:AT.idleText,marginBottom:9}}>{insp.texteLabel||'Texte'}</div>
            <div style={{fontSize:12,color:P.abysse,lineHeight:1.6,whiteSpace:'pre-wrap',background:P.givre,borderRadius:10,padding:'12px 14px',maxHeight:240,overflowY:'auto'}}>{insp.texte}</div>
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

        {insp.arbitrage&&<BlocArbitrage key={insp.key} arb={insp.arbitrage}/>}

        {insp.toast&&<div style={{marginTop:14,background:P.abysse,color:P.menthe,fontSize:11.5,padding:'10px 13px',borderRadius:10,lineHeight:1.5}}>{insp.toast}</div>}
      </div>
    </aside>
  )
}

/* Arbitrage d'un signal — deux décisions, aucun envoi.
   « Classer » fait taire CE signal tant que ses chiffres ne bougent pas ;
   « Porter au digest » en fait un point de coordination du mail du mois. Le
   mail part une fois par mois et c'est le seul canal : aucun bouton d'ici
   n'écrit à qui que ce soit. */
function BlocArbitrage({arb}){
  const [note,setNote]=useState(arb.courant?.note||'')
  const [occupe,setOccupe]=useState('')
  const [err,setErr]=useState('')
  async function go(decision){
    setOccupe(decision);setErr('')
    try{ await arb.onDecision(decision,note) }
    catch(e){ setErr(e.message) }
    finally{ setOccupe('') }
  }
  const bouton=(primary)=>({width:'100%',fontSize:12,fontWeight:600,padding:11,borderRadius:10,
    cursor:occupe?'default':'pointer',border:'none',opacity:occupe?0.6:1,
    background:primary?P.abysse:P.givre,color:primary?P.menthe:P.petrole})

  if(arb.courant) return (
    <div style={{marginTop:18,borderTop:`1px solid ${P.border}`,paddingTop:16}}>
      <div style={{fontSize:9.5,fontWeight:600,letterSpacing:'.13em',textTransform:'uppercase',color:AT.idleText,marginBottom:9}}>Arbitré</div>
      <div style={{background:P.givre,borderRadius:10,padding:'12px 14px',fontSize:12,color:P.abysse,lineHeight:1.6}}>
        {arb.courant.decision==='classe'?'Classé — ce signal se taira tant que ses chiffres ne bougeront pas.':'Porté au digest du mois comme point de coordination.'}
        {arb.courant.note&&<div style={{marginTop:8,color:P.textm,whiteSpace:'pre-wrap'}}>{arb.courant.note}</div>}
      </div>
      <button onClick={()=>go('annule')} disabled={!!occupe} style={{...bouton(false),marginTop:9}}>
        {occupe?'…':'Revenir sur cet arbitrage'}
      </button>
      {err&&<div style={{fontSize:11,color:P.red,marginTop:8}}>⚠ {err}</div>}
    </div>
  )

  return (
    <div style={{marginTop:18,borderTop:`1px solid ${P.border}`,paddingTop:16}}>
      <div style={{fontSize:9.5,fontWeight:600,letterSpacing:'.13em',textTransform:'uppercase',color:AT.idleText,marginBottom:9}}>Arbitrer</div>
      <textarea value={note} onChange={e=>setNote(e.target.value)}
        placeholder="Note — reprise telle quelle dans le digest si vous l'y portez."
        style={{width:'100%',minHeight:62,background:'#F7FBF9',border:`1px solid ${P.border}`,borderRadius:10,
          padding:'9px 11px',fontSize:12,color:P.abysse,resize:'vertical',outline:'none',lineHeight:1.55,
          fontFamily:"'DM Sans',sans-serif",marginBottom:9}}/>
      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        <button onClick={()=>go('digest')} disabled={!!occupe} style={bouton(true)}>
          {occupe==='digest'?'…':'Porter au digest du mois'}
        </button>
        <button onClick={()=>go('classe')} disabled={!!occupe} style={bouton(false)}>
          {occupe==='classe'?'…':'Classer — rien à signaler'}
        </button>
      </div>
      <div style={{fontSize:10.5,color:AT.idleText,marginTop:9,lineHeight:1.5}}>
        Aucun mail n'est envoyé ici. Le digest du mois est le seul canal vers les intervenants.
      </div>
      {err&&<div style={{fontSize:11,color:P.red,marginTop:8}}>⚠ {err}</div>}
    </div>
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
  const journal=data?.journal||[]           // déjà scopé à moi côté serveur (role=intervenant)
  const competences=data?.competences||[]
  const digest=data?.digest||null
  const norm = normCode
  const compParCode={}; competences.forEach(c=>{compParCode[norm(c.code)]=c})
  const couvertes = new Set((data?.mes_competences_couvertes||[]).map(norm))
  const deploy = temps==='deploiement'

  // Arborescence limitée à mes modules — déduits de mes séances prévisionnelles
  // de la période. Limite connue : un module sans séance ce mois-ci n'apparaît
  // pas ici (portée volontairement mensuelle, cf doc de session).
  const arbre = blocsRaw.map(b=>{
    const mods=(b.modules||[]).filter(m=>journal.some(j=>memeModule(j.module_ref,m)))
    if(!mods.length) return null
    return {
      id:b.id, titre:b.titre,
      meta: deploy ? mods.length+' module(s) · '+mods.reduce((n,m)=>n+(m.competences_liees||[]).length,0)+' compétence(s)' : mods.length+' module(s) prévu(s)',
      modules: mods.map(m=>{
        const seancesM = journal.filter(j=>memeModule(j.module_ref,m))
        const manquantes = seancesM.filter(j=>j.etat==='manquante').length
        const faites = seancesM.filter(j=>j.etat==='tenue'||j.etat==='tenue_cr').length
        const competences = (b.competences||[]).filter(c=>(m.competences_liees||[]).some(cl=>norm(cl)===norm(c.id))).map(c=>{
          const etat = (compParCode[norm(c.id)]||{}).etat || (couvertes.has(norm(c.id))?'couverte':'programmee')
          return {code:c.id, label:c.libelle, statut: compLabel(etat), st: compSt(etat), etat}
        })
        return {
          id:m.id, titre:m.titre, meta: seancesM.length+' séance(s) ce mois-ci',
          etat: manquantes?'Séance non émargée':(faites?'En cours':'Planifié'),
          st: manquantes?'warn':(faites?'ok':'idle'),
          competences,
          seances: seancesM.map(j=>({date:fmtCourt(j.date_seance||j.date_prevue), titre:j.titre,
            etat: etatLabel(j.etat), st: etatSt(j.etat), data:j})),
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
      return {kind:'Séance', st:s.st||'idle', titre:(s.date||'')+' — '+(s.titre||''), desc:s.data?.detail||'',
        lignes:[{k:'État',v:s.etat,warn:s.st==='warn'},
                {k:'Durée',v:s.data?.duree_minutes?Math.round(s.data.duree_minutes/60*10)/10+' h':'—'}],
        texte:s.data?.compte_rendu||'', texteLabel:'Compte rendu de séance',
        alerte: s.data?.etat==='manquante'
          ? {titre:'Séance non émargée',txt:"Le créneau est passé et aucun émargement ne lui correspond."}
          : null, key:'seance'+sel.id}
    }
    return {kind:'Mes modules', st:'ok', titre, desc:'Sélectionnez un module, une compétence ou une séance.', lignes:[], key:'root'}
  }
  const insp = buildInsp()

  if(loading&&!data) return <div style={{minHeight:'100vh',background:P.abysse,display:'flex',alignItems:'center',justifyContent:'center'}}><Spinner/></div>
  if(error) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><Empty icon="⚠" titre="Erreur de chargement" msg={error}/></div>
  if(!f) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><Empty icon="📋" titre="Aucun titre" msg="Aucun titre ne vous est rattaché."/></div>

  const nbMod=arbre.reduce((n,b)=>n+b.modules.length,0)
  const nbComp=arbre.reduce((n,b)=>n+b.modules.reduce((m,mo)=>m+mo.competences.length,0),0)
  const nbNonEmargeesInt=journal.filter(j=>j.etat==='manquante').length
  const nbTenuesInt=journal.filter(j=>j.etat==='tenue'||j.etat==='tenue_cr').length
  const stats = temps==='digest'
    ? [{k:'statut',v:digest?.statut==='envoye'?'Envoyé':'En attente'}]
    : temps==='plan'
      ? [{k:'modules',v:String(nbMod)},{k:'compétences',v:String(nbComp)}]
      : [{k:'séances tenues',v:String(nbTenuesInt)},{k:'non émargées',v:String(nbNonEmargeesInt),warn:nbNonEmargeesInt>0}]

  const pageTitles={
    plan:['Mes modules, tels qu\u2019ils sont prévus',"Vos blocs, modules et compétences associées — l\u2019arborescence est dépliée sur la page, rien n\u2019est caché derrière un clic."],
    deploiement:['Mes modules, séance après séance',"La même arborescence, augmentée du réel : statut de chaque compétence et de chaque séance émargée."],
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
/* ═══ L'ATELIER — poste de travail du Formateur Référent ════════════════════
   Recâblé le 07/10/2026 sur les signaux de l'émargement (Bloc 2).

   L'écran comparait auparavant, séance par séance, ce que l'intervenant avait
   annoncé à ce qu'il déclarait avoir traité. Le pont CESAR ne porte ni l'un ni
   l'autre : un export de planning donne une date, une matière, un intervenant,
   une durée et un compte rendu. L'unité de jugement a donc changé de grain.

     Temps 1 — le plan. Ce que la maquette du titre promet, et ce qu'elle ne
     couvre pas : compétences sans aucun créneau à l'année, modules du plan de
     formation jamais programmés.

     Temps 2 — le réel. Le journal des séances en quatre états factuels, et
     les deux signaux qui appellent un arbitrage : la distorsion de volume
     entre le plan et le calendrier, et la redite d'une même famille de
     notions par deux intervenants dans le mois.

   Les actions d'arbitrage ne sont pas encore persistées — c'est l'objet du
   Bloc 3. L'écran est donc en lecture, sans bouton qui promettrait un envoi
   qui n'aurait pas lieu. */
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
  const horsBlocRaw=f?.modules_hors_bloc||[]
  const digest=data?.digest||null
  const avancementBlocs=data?.avancement_blocs||[]

  /* Les quatre signaux renvoyés par api/fr.js depuis la refonte du Bloc 1. */
  const journal=data?.journal||[]
  const competences=data?.competences||[]
  const distorsions=data?.distorsions||[]
  const redites=data?.redites||[]

  const idx=moduleIndex(blocsRaw,horsBlocRaw)
  const blocDe=ref=>(idx[cleModule(ref)]||{}).bloc||'—'
  const deploy = temps==='deploiement'

  /* Compteurs. Une séance encore à venir n'est pas une anomalie : c'était le
     second faux signal de l'ancienne version, qui mettait en alerte tout ce
     qui n'avait simplement pas encore eu lieu. */
  /* Un signal arbitré « classé » ne disparaît pas : il est rangé derrière un
     dépliant, parce que le FR doit pouvoir revenir sur sa décision et parce
     qu'un signal qu'on ne retrouve plus est un signal qu'on ne peut plus
     annuler. */
  const [voirClasses,setVoirClasses]=useState(false)
  async function arbitrer(sig,decision,note){
    await api.arbitrerSignal({formationId, type:sig.type, cle:sig.cle, empreinte:sig.empreinte,
      decision, note, periode, annee:undefined})
    const d=await reload()
    /* La sélection pointe sur un objet figé : on la rafraîchit depuis les
       données rechargées, sinon l'inspecteur continuerait d'afficher l'état
       d'avant la décision. */
    if(d){
      const source = sig.type==='redite' ? (d.redites||[]) : (d.distorsions||[])
      const maj = source.find(x=>x.cle===sig.cle)
      if(maj) setSel(s=>({...s,data:maj}))
    }
  }
  const estClasse = s => !!(s.arbitrage && s.arbitrage.decision==='classe')

  const nonEmargees = journal.filter(j=>j.etat==='manquante')
  const tenues = journal.filter(j=>j.etat==='tenue'||j.etat==='tenue_cr')
  const jamaisProgrammes = distorsions.filter(d=>d.etat==='jamais_programme')
  const ecartsVolume = distorsions.filter(d=>d.etat!=='jamais_programme')
  const compAbsentes = competences.filter(c=>c.etat==='absente')
  /* Le compteur ne compte que ce qui reste à traiter : un signal classé ou
     déjà porté au digest a été vu, il ne doit plus réclamer d'attention. */
  const signauxOuverts = [...ecartsVolume,...redites].filter(s=>!s.arbitrage)
  const signauxTraites = [...ecartsVolume,...redites].filter(s=>!!s.arbitrage)
  const nbSignaux = signauxOuverts.length

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

  // Dénominateur de couverture — les options ne s'additionnent pas.
  // Un étudiant suit une seule option intensive : compter les trois reviendrait
  // à exiger une couverture que personne n'atteindra. On retient donc, par
  // groupe d'options mutuellement exclusives, la moyenne des modules plutôt
  // que leur somme. Le compte est indicatif au niveau de la promotion ; la
  // couverture exacte par étudiant se lira via son groupe.
  const blocsOblig = blocsRaw.filter(b=>b.nature!=='option')
  const blocsOpt   = blocsRaw.filter(b=>b.nature==='option')
  const modsDe = arr => arr.reduce((n,b)=>n+((b.modules||[]).length),0)
  const parGroupeOpt = {}
  for(const b of blocsOpt){ const k=b.option_groupe||'Options'; (parGroupeOpt[k]=parGroupeOpt[k]||[]).push(b) }
  const modulesOptRetenus = Object.values(parGroupeOpt)
    .reduce((n,arr)=>n+Math.round(modsDe(arr)/Math.max(arr.length,1)),0)
  const totauxTitre = {
    blocsOblig: blocsOblig.length,
    blocsOption: blocsOpt.length,
    modulesAttendus: modsDe(blocsOblig)+modulesOptRetenus,
    modulesTotal: modsDe(blocsRaw),
  }

  const blocs = blocsRaw.map(b=>{
    const pct = avancementBlocs.find(a=>a.id===b.id)?.pct ?? 0
    const absentesBloc = compAbsentes.filter(c=>c.bloc_id===b.id).length
    const distorsionsBloc = distorsions.filter(d=>d.bloc_id===b.id).length
    const quiSet = new Set(journal.filter(j=>blocDe(j.module_ref)===b.id).map(j=>j.intervenant_nom).filter(x=>x&&x!=='—'))
    /* En Temps 1 le signal est le trou du plan ; en Temps 2 l'écart de volume. */
    const anom = deploy ? distorsionsBloc : absentesBloc
    const st = anom>0?'warn':(deploy?(pct>0?'ok':'idle'):'idle')
    return {id:b.id, titre:b.titre, comp:(b.competences||[]).length, mods:(b.modules||[]).length,
      pct, anom, st, absentes:absentesBloc, distorsions:distorsionsBloc,
      nature:b.nature==='option'?'option':'obligatoire', optGroupe:b.option_groupe||'',
      epreuves:b.epreuves||[],
      qui: quiSet.size?Array.from(quiSet).join(' · '):'Non affecté',
      desc:`${(b.competences||[]).length} compétence(s) au référentiel de ce bloc.`}
  })

  const seancesJournal = journal.map(j=>({
    ...j, st: etatSt(j.etat), etatLabel: etatLabel(j.etat), blocId: blocDe(j.module_ref),
    dateAffichee: fmtCourt(j.date_seance||j.date_prevue),
  }))

  // Aperçu "vue intervenant" — arborescence tous modules confondus (FR n'a pas
  // de personne unique à prévisualiser, contrairement à un compte intervenant réel).
  const [openApercu,setOpenApercu]=useState({})
  const compParCode={}; competences.forEach(c=>{compParCode[normCode(c.code)]=c})
  const arbreApercu = blocsRaw.map(b=>{
    const mods=b.modules||[]
    if(!mods.length) return null
    return {
      id:b.id, titre:b.titre,
      meta: deploy ? mods.length+' module(s) · '+(b.competences||[]).length+' compétence(s)' : mods.length+' module(s) prévu(s)',
      modules: mods.map(m=>{
        const seancesM = seancesJournal.filter(s=>cleModule(s.module_ref)===cleModule(m.titre)||cleModule(s.module_ref)===cleModule(m.id))
        const manquantes = seancesM.filter(s=>s.etat==='manquante').length
        const faites = seancesM.filter(s=>s.etat==='tenue'||s.etat==='tenue_cr').length
        const comps = (b.competences||[])
          .filter(c=>(m.competences_liees||[]).some(cl=>normCode(cl)===normCode(c.id)))
          .map(c=>{
            const etat=(compParCode[normCode(c.id)]||{}).etat||'programmee'
            return {code:c.id, label:c.libelle, statut:compLabel(etat), st:compSt(etat), etat}
          })
        return {
          id:m.id, titre:m.titre, meta: seancesM.length+' séance(s) ce mois-ci',
          etat: manquantes?'Séance non émargée':(faites?'En cours':'Planifié'),
          st: manquantes?'warn':(faites?'ok':'idle'),
          competences: comps,
          seances: seancesM.map(s=>({date:s.dateAffichee, titre:s.titre, etat:s.etatLabel, st:s.st, data:s})),
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
          {k:'Redites citées',v:String(redites.length),warn:redites.length>0},
          {k:'Séances non émargées',v:String(nonEmargees.length),warn:nonEmargees.length>0},
        ], key:'digest'}
    }
    if(sel.kind==='bloc'){
      const b=blocs.find(x=>x.id===sel.id)
      if(!b) return {kind:'Bloc',st:'idle',titre:titre,desc:'Sélectionnez un bloc de la cartographie.',lignes:[],key:'none'}
      const lignes = deploy
        ? [{k:'Compétences',v:b.comp+' au référentiel'},{k:'Couverture réelle',v:b.pct+' %'},
           {k:'Écarts de volume',v:b.distorsions===0?'aucun':b.distorsions+' module(s)',warn:b.distorsions>0},
           {k:'Intervenants',v:b.qui}]
        : [{k:'Compétences',v:b.comp+' au référentiel'},{k:'Modules prévus',v:String(b.mods)},
           {k:'Non couvertes',v:b.absentes===0?'aucune':b.absentes+' compétence(s)',warn:b.absentes>0}]
      return {kind:'Bloc de compétences', st:b.st, titre:b.id+' — '+b.titre, desc:b.desc, lignes,
        alerte: (!deploy&&b.absentes>0)
          ? {titre:b.absentes+' compétence(s) sans créneau', txt:"Aucune séance de l'année ne porte ces compétences. C'est un trou du plan, pas un retard."}
          : (deploy&&b.distorsions>0)
            ? {titre:b.distorsions+' module(s) en écart de volume', txt:'Le calendrier ne tient pas le volume annoncé au plan de formation.'}
            : null,
        key:'bloc'+b.id+temps}
    }
    if(sel.kind==='seance'){
      const s=sel.data||{}
      return {kind:'Séance', st:s.st||'idle', titre:(s.dateAffichee||'')+' — '+(s.titre||''),
        desc:s.detail||'',
        lignes:[
          {k:'Bloc',v:s.blocId||'—'},
          {k:'Module',v:s.module_ref||'Non rattaché',warn:!s.module_ref},
          {k:'Intervenant',v:s.intervenant_nom||'—'},
          {k:'Durée',v:s.duree_minutes?Math.round(s.duree_minutes/60*10)/10+' h':'—'},
          {k:'État',v:s.etatLabel||'—',warn:s.st==='warn'},
        ],
        alerte: s.etat==='manquante'
          ? {titre:'Séance non émargée', txt:"Le créneau est passé et aucun émargement ne lui correspond : soit le cours n'a pas eu lieu, soit il n'a pas été saisi."}
          : s.hors_previsionnel
            ? {titre:'Hors prévisionnel', txt:"Séance émargée sans créneau correspondant au plan. Souvent un intitulé de matière arbitré après l'import."}
            : null,
        texte: s.compte_rendu||'', texteLabel:'Compte rendu de séance',
        key:'seance'+(s.declaration_id||s.previsionnel_id)}
    }
    if(sel.kind==='distorsion'){
      const d=sel.data||{}
      return {kind:'Distorsion de volume', st:d.arbitrage?'idle':'warn', titre:d.module, desc:d.detail||'',
        arbitrage:{courant:d.arbitrage||null,onDecision:(dec,note)=>arbitrer(d,dec,note)},
        lignes:[
          {k:'Bloc',v:(d.bloc_id||'—')+(d.bloc_titre?' — '+d.bloc_titre:'')},
          {k:'Plan de formation',v:d.volume_annonce==null?'non chiffré':d.volume_annonce+' h'},
          {k:'Au calendrier',v:d.heures_programmees+' h',warn:true},
          {k:'Déjà tenu',v:d.heures_faites+' h'},
          {k:'Intervenants',v:(d.intervenants||[]).join(' · ')||'Non affecté'},
        ],
        chipsLabel:'Compétences portées', chips:d.competences||[],
        alerte: d.rouvert?{titre:'Signal rouvert',txt:d.rouvert_detail||"Les chiffres ont changé depuis votre arbitrage."}:null,
        key:'dist'+d.cle+(d.arbitrage?d.arbitrage.decision:'')}
    }
    if(sel.kind==='redite'){
      const r=sel.data||{}
      return {kind:'Redite', st:r.arbitrage?'idle':'warn', titre:r.famille, desc:r.detail||'',
        lignes:[
          {k:'Modules',v:(r.modules||[]).join(' · ')},
          {k:'Intervenants',v:(r.intervenants||[]).join(' · ')},
        ],
        arbitrage:{courant:r.arbitrage||null,onDecision:(dec,note)=>arbitrer(r,dec,note)},
        alerte: r.rouvert
          ? {titre:'Signal rouvert',txt:r.rouvert_detail||"Les chiffres ont changé depuis votre arbitrage."}
          : {titre:'Point de coordination', txt:"Une même famille de notions traitée le même mois par deux intervenants. À confirmer avec eux : complémentarité voulue, ou répétition subie."},
        key:'redite'+r.cle+(r.arbitrage?r.arbitrage.decision:'')}
    }
    if(sel.kind==='module'){
      const m=sel.data
      return {kind:'Module', st:deploy?m.st:'idle', titre:m.titre, desc:`${m.competences.length} compétence(s) associée(s).`,
        lignes:[{k:'État',v:deploy?m.etat:'Planifié',warn:m.st==='warn'&&deploy}],
        chipsLabel:'Compétences associées', chips:m.competences.map(c=>c.code), key:'mod'+sel.id}
    }
    if(sel.kind==='comp'){
      const c=sel.data||{}
      const etat=c.etat||((compParCode[normCode(c.code)]||{}).etat)||'programmee'
      return {kind:'Compétence', st:compSt(etat), titre:(c.code||'')+' — '+(c.label||c.libelle||''),
        desc:`Compétence du référentiel RNCP${sel.mod?`, rattachée au module « ${sel.mod} »`:''}.`,
        lignes:[
          {k:'Module',v:sel.mod||'—'},
          {k:'Bloc',v:sel.bloc||c.bloc_id||'—'},
          {k:'Statut',v:compLabel(etat),warn:etat==='absente'},
        ],
        alerte: etat==='absente'
          ? {titre:'Ni couverte, ni programmée', txt:"Aucune séance tenue et aucun créneau à l'année ne porte cette compétence. C'est le seul écart qui ne se voit nulle part ailleurs."}
          : null,
        key:'comp'+(c.code||sel.id)}
    }
    return {kind:'Titre', st:'ok', titre, desc:'Sélectionnez un élément de la cartographie.', lignes:[], key:'root'}
  }
  const insp = buildInsp()

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
          : [{k:'séances',v:String(journal.length)},{k:'tenues',v:String(tenues.length)}])
    : temps==='digest'
      ? [{k:'destinataires',v:String((digest?.destinataires||[]).length||'—')},{k:'redites',v:String(redites.length),warn:redites.length>0}]
      : temps==='plan'
        ? [{k:'blocs',v:totauxTitre.blocsOption?`${totauxTitre.blocsOblig} + ${totauxTitre.blocsOption} au choix`:String(totauxTitre.blocsOblig)},
           {k:'compétences',v:String(blocs.reduce((n,b)=>n+b.comp,0))},
           {k:'sans créneau',v:String(compAbsentes.length),warn:compAbsentes.length>0}]
        : [{k:'séances tenues',v:String(tenues.length)},
           {k:'non émargées',v:String(nonEmargees.length),warn:nonEmargees.length>0},
           {k:'signaux',v:String(nbSignaux),warn:nbSignaux>0}]

  const pageTitlesFR = {
    plan:['Le titre tel qu\u2019il a été planifié',"Cartographie des blocs, et ce que le calendrier de l\u2019année ne couvre pas."],
    deploiement:['Ce que la promo a réellement couvert',"La même cartographie, remplie par l\u2019émargement. L\u2019anneau mesure la couverture réelle."],
    digest:['La synthèse envoyée aux intervenants',"Écran verrouillé : UI de production, seule la note de coordination est éditable."],
  }
  const pageTitlesInt = {
    plan:['Aperçu — modules du titre, tels que prévus',"Vue que vous consultez pour vérifier ce que les intervenants voient — tous modules confondus, arborescence dépliée."],
    deploiement:['Aperçu — modules, séance après séance',"Même arborescence, augmentée des séances réellement émargées."],
    digest:['Aperçu du digest tel que reçu par les intervenants',"Écran verrouillé, lecture seule dans cet aperçu — repassez sur « Responsable pédagogique » pour valider et envoyer."],
  }
  const [pageTitle,pageSub] = (viewRole==='intervenant'?pageTitlesInt:pageTitlesFR)[temps]
  const roleLabelHeader = viewRole==='intervenant' ? 'Aperçu intervenant' : 'Formateur référent'

  const footerRail = deploy
    ? `${nbSignaux} signal${nbSignaux>1?'aux':''} à arbitrer${nonEmargees.length?` · ${nonEmargees.length} séance${nonEmargees.length>1?'s':''} non émargée${nonEmargees.length>1?'s':''}`:''}`
    : (()=>{ const n=jamaisProgrammes.filter(d=>!d.arbitrage).length
        return `${compAbsentes.length} compétence${compAbsentes.length>1?'s':''} sans créneau${n?` · ${n} module${n>1?'s':''} jamais programmé${n>1?'s':''}`:''}` })()

  /* Panneau sombre réutilisé par les deux temps : un titre, des entrées
     cliquables, un message quand il n'y a rien à montrer. */
  const EntreeSignal = ({e})=>{
    const teinte = e.traite?'rgba(227,255,240,.45)':P.saumon
    return (
      <button onClick={e.go}
        style={{display:'block',width:'100%',textAlign:'left',padding:'13px 14px',borderRadius:12,cursor:'pointer',border:'1px solid',
          opacity:e.traite?0.72:1,
          background:e.actif?'rgba(93,226,152,.10)':'rgba(227,255,240,.05)',
          borderColor:e.actif?'rgba(93,226,152,.35)':'rgba(227,255,240,.08)'}}>
        <span style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:teinte}}/>
          <span style={{fontSize:9.5,fontWeight:700,letterSpacing:'.11em',textTransform:'uppercase',color:teinte}}>{e.categorie}</span>
          {e.marque&&<span style={{fontSize:9,fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:P.menthe,background:'rgba(93,226,152,.12)',padding:'2px 7px',borderRadius:20}}>{e.marque}</span>}
        </span>
        <span style={{display:'block',fontSize:12.5,color:P.givre,lineHeight:1.45}}>{e.titre}</span>
        <span style={{display:'block',fontSize:11,color:'rgba(227,255,240,.45)',marginTop:5}}>{e.sous}</span>
      </button>
    )
  }

  const PanneauSignaux = ({label,entrees,vide,traites})=>(
    <div style={{background:P.abysse,borderRadius:16,padding:'18px 20px 20px'}}>
      <div style={{fontSize:11,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:P.menthe,marginBottom:14}}>{label}</div>
      {entrees.length===0?<div style={{fontSize:12,color:'rgba(227,255,240,.4)'}}>{vide}</div>:(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {entrees.map(e=><EntreeSignal key={e.cle} e={e}/>)}
        </div>
      )}
      {(traites||[]).length>0&&(
        <div style={{marginTop:14,borderTop:'1px solid rgba(227,255,240,.08)',paddingTop:12}}>
          <button onClick={()=>setVoirClasses(v=>!v)}
            style={{background:'none',border:'none',padding:0,cursor:'pointer',fontSize:11,color:'rgba(227,255,240,.55)'}}>
            {voirClasses?'▾':'▸'} {traites.length} signal{traites.length>1?'aux':''} déjà arbitré{traites.length>1?'s':''}
          </button>
          {voirClasses&&(
            <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:10}}>
              {traites.map(e=><EntreeSignal key={e.cle} e={e}/>)}
            </div>
          )}
        </div>
      )}
    </div>
  )

  const marqueDe = s => !s.arbitrage ? '' : (s.arbitrage.decision==='classe'?'Classé':'Au digest')
  const entreeDistorsion = d=>({cle:'d'+d.cle, categorie:distLabel(d.etat), titre:d.module,
    sous:`${d.bloc_id} · ${d.detail}`, actif:sel.kind==='distorsion'&&sel.id===d.cle,
    traite:!!d.arbitrage, marque:marqueDe(d),
    go:()=>setSel({kind:'distorsion',id:d.cle,data:d})})
  const entreeRedite = r=>({cle:'r'+r.cle, categorie:'Redite', titre:r.famille,
    sous:(r.intervenants||[]).join(' · '), actif:sel.kind==='redite'&&sel.id===r.cle,
    traite:!!r.arbitrage, marque:marqueDe(r),
    go:()=>setSel({kind:'redite',id:r.cle,data:r})})
  const entree = s => s.type==='redite'?entreeRedite(s):entreeDistorsion(s)

  const entreesTemps2 = signauxOuverts.map(entree)
  const traitesTemps2 = signauxTraites.map(entree)
  /* Un module jamais programmé s'arbitre comme un écart de volume : c'est la
     même nature de signal, vu depuis le plan plutôt que depuis le réel. Une
     compétence sans créneau, en revanche, ne s'arbitre pas — elle se corrige
     dans le plan de formation ou dans le calendrier, pas dans Atlas. */
  const entreeCompetence = c=>({cle:'c'+c.code, categorie:'Compétence sans créneau',
    titre:c.code+' — '+(c.libelle||''), sous:`${c.bloc_id} — ${c.bloc_titre}`,
    actif:sel.kind==='comp'&&sel.id===c.code,
    go:()=>setSel({kind:'comp',id:c.code,data:{...c,label:c.libelle},bloc:c.bloc_id})})
  const entreesTemps1 = [
    ...jamaisProgrammes.filter(d=>!d.arbitrage).map(entreeDistorsion),
    ...compAbsentes.map(entreeCompetence),
  ]
  const traitesTemps1 = jamaisProgrammes.filter(d=>!!d.arbitrage).map(entreeDistorsion)

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
        anomalieFooter={footerRail}/>

      <main style={{background:'#F4FBF7',overflowY:'auto',display:'flex',flexDirection:'column'}}>
        <HeaderAtelier tempsNum={TEMPS_DEFS.find(t=>t.id===temps).num} roleLabel={roleLabelHeader} pageTitle={pageTitle} pageSub={pageSub} stats={stats}/>

        <div key={temps+viewRole} style={{padding:'26px 34px 46px',animation:'fadeIn .28s ease'}} className="fi">
          {viewRole==='intervenant'&&temps!=='digest'&&(
            arbreApercu.length===0?(
              <Empty icon="📋" titre="Aucun module ce mois-ci" msg="Aucune séance sur la période en cours pour ce titre."/>
            ):(
              <Arbre2 arbre={arbreApercu} mode={temps} open={openApercuState} toggle={toggleApercu} sel={sel} onSelect={setSel}/>
            )
          )}
          {viewRole==='fr'&&temps!=='digest'&&<>
            <Cartographie2 blocs={blocs} mode={temps} sel={sel} onSelect={setSel} titre={titre}/>
            {/* Enseignements rattachés à aucun bloc : hors de la rosace, parce
                qu'aucune épreuve ne les sanctionne — mais bien dans la
                formation, donc listés juste en dessous. */}
            {horsBlocRaw.length>0&&(
              <div style={{marginTop:'0.75rem',background:P.surface,border:`1px solid ${P.border}`,borderRadius:14,padding:'12px 18px'}}>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:AT.idleText,marginBottom:6}}>
                  Modules hors bloc · {horsBlocRaw.reduce((n,m)=>n+(m.volume||0),0)} h
                </div>
                <div style={{fontSize:12,color:P.textm,marginBottom:8,lineHeight:1.55}}>Enseignements sans épreuve de certification rattachée. Ils ne constituent pas un bloc.</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'0.35rem'}}>
                  {horsBlocRaw.map((m,i)=>(
                    <span key={i} title={(m.competences_liees||[]).join(', ')}
                      style={{padding:'4px 12px',borderRadius:20,border:`1px solid ${P.border}`,background:P.surface,fontSize:12,color:P.abysse}}>
                      {m.titre}<span style={{color:AT.idleText,marginLeft:6}}>{m.volume} h</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {deploy&&(
              <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.45fr) minmax(0,1fr)',gap:18,marginTop:20}}>
                <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,overflow:'hidden'}}>
                  <div style={{padding:'13px 18px',borderBottom:`1px solid ${P.border}`,fontSize:11,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:P.petrole}}>Journal des séances</div>
                  {seancesJournal.length===0?<div style={{padding:'2rem',textAlign:'center',color:P.textm,fontSize:13}}>Aucune séance ce mois-ci.</div>:
                    seancesJournal.map(s=>(
                      <button key={(s.declaration_id?'d':'p')+(s.declaration_id||s.previsionnel_id)} onClick={()=>setSel({kind:'seance',id:s.declaration_id||s.previsionnel_id,data:s})}
                        style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'11px 18px',borderBottom:`1px solid ${P.border}`,cursor:'pointer',border:'none',
                          background:sel.kind==='seance'&&sel.id===(s.declaration_id||s.previsionnel_id)?'#F1FCF6':'transparent'}}>
                        <span style={{fontSize:11,color:AT.idleText,width:52,flexShrink:0,textAlign:'left'}}>{s.dateAffichee}</span>
                        <span style={{fontSize:10,fontWeight:700,color:P.petrole,background:P.givre,padding:'3px 7px',borderRadius:6,flexShrink:0}}>{s.blocId}</span>
                        <span style={{flex:1,textAlign:'left',fontSize:12.5,color:P.abysse,lineHeight:1.4}}>
                          {s.titre}
                          {s.hors_previsionnel&&<span style={{color:AT.idleText,marginLeft:6,fontSize:11}}>hors prév.</span>}
                        </span>
                        <span style={{fontSize:11,color:P.textm,flexShrink:0}}>{s.intervenant_nom}</span>
                        <span style={atTag(s.st)}>{s.etatLabel}</span>
                      </button>
                    ))}
                </div>
                <PanneauSignaux label="Signaux à arbitrer" entrees={entreesTemps2} traites={traitesTemps2}
                  vide="Rien à arbitrer ce mois-ci."/>
              </div>
            )}

            {!deploy&&(
              <div style={{display:'grid',gridTemplateColumns:'minmax(0,1.45fr) minmax(0,1fr)',gap:18,marginTop:20}}>
                <div style={{background:P.surface,border:`1px solid ${P.border}`,borderRadius:16,overflow:'hidden'}}>
                  <div style={{padding:'13px 18px',borderBottom:`1px solid ${P.border}`,fontSize:11,fontWeight:600,letterSpacing:'.1em',textTransform:'uppercase',color:P.petrole}}>Ce qui est prévu — répartition des intervenants</div>
                  {blocs.map(b=>(
                    <button key={b.id} onClick={()=>setSel({kind:'bloc',id:b.id})}
                      style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'12px 18px',borderBottom:`1px solid ${P.border}`,cursor:'pointer',border:'none',
                        background:sel.kind==='bloc'&&sel.id===b.id?'#F1FCF6':'transparent'}}>
                      <span style={{fontSize:11,fontWeight:700,color:P.petrole,background:P.givre,padding:'4px 9px',borderRadius:7,flexShrink:0}}>{b.id}</span>
                      <span style={{flex:1,textAlign:'left',fontSize:12.5,color:P.abysse}}>{b.titre}</span>
                      <span style={{fontSize:11,color:P.textm,width:104,textAlign:'left'}}>{b.comp} compétences</span>
                      <span style={{fontSize:11,color:P.textm,width:96,textAlign:'left'}}>{b.mods} modules</span>
                      <span style={{fontSize:11,color:b.absentes?AT.warnText:P.petrole,flexShrink:0,width:92,textAlign:'right'}}>
                        {b.absentes?b.absentes+' sans créneau':'couvert'}
                      </span>
                    </button>
                  ))}
                </div>
                <PanneauSignaux label="Ce que le plan ne couvre pas" entrees={entreesTemps1} traites={traitesTemps1}
                  vide="Chaque compétence et chaque module du plan a au moins un créneau à l'année."/>
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
                <Empty icon="✉" titre="Aucun digest généré" msg="Générez le digest du mois pour ce titre — il s'appuie sur les séances émargées de la période en cours."/>
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
  const kpis=c.kpis||{intervenants:0,seances:0,heures:0,coordination:coordination.length}
  const periodeLabel=c.periode?.label||''
  const sectStyle={padding:'1.25rem 1.75rem',borderBottom:'1px solid rgba(255,255,255,0.06)',background:D.abysse}
  const labelStyle={fontSize:10,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(255,255,255,0.28)',marginBottom:'0.75rem'}
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
            <div><div style={{fontSize:22,fontWeight:700,color:D.menthe}}>{kpis.intervenants}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Intervenants</div></div>
            <div><div style={{fontSize:22,fontWeight:700,color:D.menthe}}>{kpis.seances}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Séances tenues</div></div>
            <div><div style={{fontSize:22,fontWeight:700,color:D.menthe}}>{kpis.heures==null?'—':kpis.heures+' h'}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Heures de cours</div></div>
          </div>
        </div>

        <div style={sectStyle}>
          <div style={labelStyle}>Avancement RNCP par bloc</div>
          {avancementBlocs.length===0?<div style={itSub}>Aucun bloc de compétences sur ce titre.</div>:avancementBlocs.map(b=>(
            <div key={b.id} style={{marginBottom:'0.55rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'rgba(255,255,255,0.75)',marginBottom:3}}>
                <span>{b.titre}</span><span style={{color:D.menthe,fontWeight:600}}>{b.pct==null?'—':`${b.pct}%`}</span>
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
              <div>
                {t.bloc&&<div style={{fontSize:10,letterSpacing:'0.08em',textTransform:'uppercase',color:'rgba(255,255,255,0.28)',marginBottom:2}}>{t.bloc}</div>}
                <div style={itTitle}>{t.module}</div>
                <div style={itSub}>{[t.intervenant,t.seances?`${t.seances} séance${t.seances>1?'s':''}`:'',t.heures?`${t.heures} h`:''].filter(Boolean).join(' · ')}</div>
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
                <div><div style={itTitle}>{s.module}</div>
                  <div style={itSub}>{[s.periode,s.intervenant,s.seances>1?`${s.seances} séances`:''].filter(Boolean).join(' · ')}</div></div>
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
