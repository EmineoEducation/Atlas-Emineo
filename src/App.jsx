import { useState, useEffect, useRef, useCallback } from 'react'
import { api, setToken, clearToken, getToken, ingererDocuments, genererFicheJ1 } from './api.js'

/* ═══════════════════════════════════════════════════════════════
   COULEURS & UTILS UI
═══════════════════════════════════════════════════════════════ */
const P = {
  abysse:'#0B2B2D',petrole:'#134547',menthe:'#5DE298',givre:'#E3FFF0',eau:'#9DF0C4',saumon:'#E89B77',
  surface:'#FFFFFF',surface2:'#F5FDF8',border:'rgba(19,69,71,0.12)',borderm:'rgba(93,226,152,0.28)',
  textm:'#4A706E',textl:'rgba(11,43,45,0.40)',amber:'#EF9F27',amberbg:'#FFF8ED',red:'#E24B4A',redbg:'#FEF2F2',
}
const SCOL={nominal:'#5DE298',signal:'#9DF0C4',coordination:'#EF9F27',incoherence:'#E24B4A',vide:'#8EADA8'}
const SFIL={nominal:'rgba(93,226,152,0.12)',signal:'rgba(157,240,196,0.14)',coordination:'rgba(239,159,39,0.10)',incoherence:'rgba(226,75,74,0.08)',vide:'rgba(19,69,71,0.04)'}
const ROLE_LABELS={dir:'Direction des programmes',rp:'Responsable pédagogique',intervenant:'Intervenant',etudiant:'Étudiant'}

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

/* ═══════════════════════════════════════════════════════════════
   GRAPHE CANVAS
═══════════════════════════════════════════════════════════════ */
function GrapheCanvas({blocs,alertes,onClickBloc,showAlerts=true}){
  const cvRef=useRef(null)
  const [panel,setPanel]=useState(null)
  const nodes=(blocs||[]).map((b,i,arr)=>{
    const angle=(2*Math.PI*i/Math.max(arr.length,1))-Math.PI/2
    const r=arr.length<=3?0.28:0.30
    const ids=(b.modules||[]).map(m=>m.id)
    const h1=(alertes||[]).some(a=>a.niveau===1&&(a.modules||[]).some(m=>ids.includes(m)))
    const h2=(alertes||[]).some(a=>a.niveau===2&&(a.modules||[]).some(m=>ids.includes(m)))
    const h3=(alertes||[]).some(a=>a.niveau===3&&(a.modules||[]).some(m=>ids.includes(m)))
    return{...b,x:0.5+r*Math.cos(angle),y:0.45+r*0.75*Math.sin(angle),status:h1?'incoherence':h2?'coordination':h3?'signal':'nominal',comp:(b.competences||[]).length,mc:(b.modules||[]).length}
  })
  const links=nodes.map((n,i)=>({a:n.id,b:nodes[(i+1)%nodes.length].id,w:2}))
  const draw=useCallback(()=>{
    const cv=cvRef.current;if(!cv)return
    const w=cv.width=cv.parentElement.clientWidth,h=cv.height=400
    const ctx=cv.getContext('2d');ctx.clearRect(0,0,w,h)
    if(!nodes.length){ctx.fillStyle='rgba(19,69,71,0.25)';ctx.font="400 14px 'Inter',system-ui";ctx.textAlign='center';ctx.fillText('Aucune formation chargée',w/2,h/2);return}
    links.forEach(l=>{const a=nodes.find(n=>n.id===l.a),b=nodes.find(n=>n.id===l.b);if(!a||!b)return;ctx.beginPath();ctx.moveTo(a.x*w,a.y*h);ctx.lineTo(b.x*w,b.y*h);ctx.strokeStyle='rgba(93,226,152,0.18)';ctx.lineWidth=l.w;ctx.stroke()})
    nodes.forEach(n=>{const x=n.x*w,y=n.y*h,r=26+n.comp*7
      if(n.status==='incoherence'){ctx.beginPath();ctx.arc(x,y,r+7,0,Math.PI*2);ctx.strokeStyle='rgba(226,75,74,0.22)';ctx.lineWidth=4;ctx.stroke()}
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=SFIL[n.status]||SFIL.vide;ctx.fill();ctx.strokeStyle=SCOL[n.status]||SCOL.vide;ctx.lineWidth=n.status==='incoherence'?2.5:1.5;ctx.stroke()
      const fs=Math.max(9,r*0.20);ctx.fillStyle=P.abysse;ctx.font=`600 ${fs}px 'Inter',system-ui`;ctx.textAlign='center';ctx.textBaseline='middle'
      ctx.fillText(n.id,x,y-fs*0.6);ctx.font=`400 ${Math.max(8,r*0.165)}px 'Inter',system-ui`;ctx.fillText(n.titre.length>18?n.titre.slice(0,16)+'…':n.titre,x,y+fs*0.5)
      ctx.fillStyle=SCOL[n.status]||SCOL.vide;ctx.font=`400 ${Math.max(7,r*0.155)}px 'Inter',system-ui`;ctx.fillText(`${n.comp}C · ${n.mc}M`,x,y+fs*0.5+Math.max(8,r*0.165)*1.3)
    })
  },[nodes])
  useEffect(()=>{draw();window.addEventListener('resize',draw);return()=>window.removeEventListener('resize',draw)},[draw])
  function getHit(e){const cv=cvRef.current;if(!cv)return null;const rect=cv.getBoundingClientRect(),mx=(e.clientX-rect.left)*(cv.width/rect.width),my=(e.clientY-rect.top)*(cv.height/rect.height);return nodes.find(n=>{const r=26+n.comp*7,dx=mx-n.x*cv.width,dy=my-n.y*cv.height;return Math.sqrt(dx*dx+dy*dy)<=r})}
  return(
    <div style={{position:'relative',borderRadius:12,border:`1px solid ${P.border}`,overflow:'hidden',background:'rgba(227,255,240,0.30)'}}>
      <canvas ref={cvRef} style={{display:'block',cursor:'default'}}
        onMouseMove={e=>{const n=getHit(e),tip=document.getElementById('gtip');if(n&&tip){e.currentTarget.style.cursor='pointer';tip.style.opacity='1';tip.style.left=(e.clientX+14)+'px';tip.style.top=Math.max(8,e.clientY-12)+'px';tip.innerHTML=`<strong style="color:${SCOL[n.status]}">${n.id}</strong> · ${n.comp}C · ${n.mc}M<br><span style="opacity:.6;font-size:11px">${n.titre}</span>`}else{e.currentTarget.style.cursor='default';if(tip)tip.style.opacity='0'}}}
        onMouseLeave={()=>{const tip=document.getElementById('gtip');if(tip)tip.style.opacity='0'}}
        onClick={e=>{const tip=document.getElementById('gtip');if(tip)tip.style.opacity='0';const n=getHit(e);if(!n){setPanel(null);return};if(n.status==='incoherence'&&onClickBloc){onClickBloc(n);return};setPanel(prev=>prev?.id===n.id?null:n)}}
      />
      {nodes.length>0&&<div style={{position:'absolute',top:10,left:10,background:'rgba(11,43,45,0.88)',borderRadius:8,padding:'7px 11px',border:`1px solid ${P.borderm}`,fontSize:10,color:P.givre}}>{[['#5DE298','Nominal'],['#9DF0C4','Signal doux'],['#EF9F27','Coordination'],['#E24B4A','Incohérence'],['#8EADA8','Non déclaré']].map(([c,l])=><div key={l} style={{display:'flex',alignItems:'center',marginBottom:3}}><span style={{width:8,height:8,borderRadius:'50%',background:c,display:'inline-block',marginRight:5}}/>{l}</div>)}</div>}
      {panel&&<div style={{position:'absolute',right:0,top:0,width:250,height:'100%',background:'rgba(11,43,45,0.96)',borderLeft:`1px solid ${P.borderm}`,padding:'0.9rem',overflowY:'auto',animation:'fadeIn 0.2s ease'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'0.75rem'}}><div><div style={{fontFamily:'var(--font-t)',fontSize:14,color:P.givre}}>{panel.titre}</div><div style={{fontSize:10,color:'rgba(227,255,240,0.4)',marginTop:3}}>{panel.comp}C · {panel.mc}M</div></div><button onClick={()=>setPanel(null)} style={{color:P.textm,fontSize:16}}>×</button></div>
        {(panel.competences||[]).map(c=><div key={c.id} style={{fontSize:11,color:P.givre,padding:'3px 0',borderBottom:'1px solid rgba(93,226,152,0.08)'}}><span style={{color:P.menthe,fontWeight:600,marginRight:5}}>{c.id}</span>{c.libelle}</div>)}
        <div style={{marginTop:'0.5rem',fontSize:10,fontWeight:600,color:'rgba(93,226,152,0.6)',textTransform:'uppercase',marginBottom:'0.3rem'}}>Modules</div>
        {(panel.modules||[]).map(m=><div key={m.id} style={{fontSize:11,color:'rgba(227,255,240,0.7)',padding:'3px 0',borderBottom:'1px solid rgba(93,226,152,0.08)'}}>{m.titre}{m.intervenant?` · ${m.intervenant}`:''}</div>)}
      </div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TOPBAR — avec info user + déconnexion
═══════════════════════════════════════════════════════════════ */
function Topbar({user,formationTitre,onLogout,onglet,setOnglet,onglets}){
  return(
    <div style={{height:52,display:'flex',alignItems:'center',gap:'0.65rem',padding:'0 1.25rem',position:'sticky',top:0,zIndex:100,background:P.surface,borderBottom:`1px solid ${P.border}`,boxShadow:'0 1px 8px rgba(11,43,45,0.06)'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,paddingRight:10,borderRight:`1px solid ${P.border}`}}>
        <div style={{width:24,height:24,borderRadius:'50%',background:P.petrole,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:P.menthe,fontSize:11,fontWeight:700,fontFamily:'var(--font-t)',fontStyle:'italic'}}>e</span></div>
        <span style={{fontSize:10,fontWeight:600,color:P.petrole,letterSpacing:'0.06em',textTransform:'uppercase'}}>Éminéo</span>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:12,fontWeight:600,color:P.abysse,lineHeight:1.2}}>{ROLE_LABELS[user.role]}{user.campus?` · ${user.campus}`:''}</div>
        <div style={{fontSize:10,color:P.textl}}>{formationTitre||'Atlas des compétences'}</div>
      </div>
      <div style={{display:'flex',gap:'0.3rem'}}>
        {(onglets||[]).map(t=><button key={t.id} onClick={()=>setOnglet(t.id)} style={{borderRadius:6,padding:'4px 12px',fontSize:12,fontWeight:500,background:onglet===t.id?'rgba(93,226,152,0.15)':'transparent',border:`1px solid ${onglet===t.id?P.borderm:'transparent'}`,color:onglet===t.id?P.petrole:P.textm,transition:'all 0.15s',cursor:'pointer'}}>{t.label}</button>)}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:'0.5rem',paddingLeft:10,borderLeft:`1px solid ${P.border}`}}>
        <Avatar name={`${user.prenom} ${user.nom}`} size={26}/>
        <div><div style={{fontSize:11,fontWeight:500,color:P.abysse}}>{user.prenom} {user.nom}</div><div style={{fontSize:9,color:P.textl}}>{user.email}</div></div>
        <button onClick={onLogout} title="Se déconnecter" style={{color:P.textm,fontSize:14,padding:'2px 6px',marginLeft:4,cursor:'pointer'}}>⏻</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   LOGIN PAGE
═══════════════════════════════════════════════════════════════ */
function LoginPage({onLogin}){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)

  async function handleSubmit(e){
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const data = await api.login(email.trim().toLowerCase(), password)
      setToken(data.token)
      onLogin(data.user)
    } catch(err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return(
    <div style={{minHeight:'100vh',background:'var(--grad-fond)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,opacity:0.04,pointerEvents:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",backgroundSize:'180px'}}/>
      <div style={{width:'100%',maxWidth:380,background:'rgba(227,255,240,0.04)',border:'1px solid rgba(93,226,152,0.12)',borderRadius:20,padding:'2.5rem',backdropFilter:'blur(12px)',animation:'fadeUp 0.5s ease both'}}>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:'2rem',justifyContent:'center'}}>
          <div style={{width:40,height:40,borderRadius:'50%',background:P.givre,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:P.abysse,fontSize:20,fontWeight:700,fontFamily:'var(--font-t)',fontStyle:'italic',lineHeight:1}}>e</span></div>
          <div><div style={{color:P.givre,fontSize:18,fontFamily:'var(--font-t)',fontWeight:600,lineHeight:1}}>emineo</div><div style={{color:P.menthe,fontSize:9,fontWeight:600,letterSpacing:'0.18em',textTransform:'uppercase',marginTop:1}}>ÉDUCATION</div></div>
        </div>
        <h2 style={{fontFamily:'var(--font-t)',color:P.givre,fontSize:22,fontWeight:400,textAlign:'center',marginBottom:'0.3rem'}}>Atlas des compétences</h2>
        <p style={{fontSize:12,color:'rgba(227,255,240,0.35)',textAlign:'center',marginBottom:'2rem'}}>Connexion à votre espace</p>

        <div style={{marginBottom:'1rem'}}>
          <label style={{fontSize:11,fontWeight:600,color:'rgba(227,255,240,0.4)',letterSpacing:'0.08em',textTransform:'uppercase',display:'block',marginBottom:'0.4rem'}}>Identifiant</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="prenom.nom@emineo-education.fr"
            style={{width:'100%',background:'rgba(93,226,152,0.06)',border:'1px solid rgba(93,226,152,0.18)',borderRadius:8,padding:'0.6rem 0.75rem',fontSize:14,color:P.givre,outline:'none'}} autoFocus/>
        </div>
        <div style={{marginBottom:'1.5rem'}}>
          <label style={{fontSize:11,fontWeight:600,color:'rgba(227,255,240,0.4)',letterSpacing:'0.08em',textTransform:'uppercase',display:'block',marginBottom:'0.4rem'}}>Mot de passe</label>
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="••••••••"
            onKeyDown={e=>e.key==='Enter'&&handleSubmit(e)}
            style={{width:'100%',background:'rgba(93,226,152,0.06)',border:'1px solid rgba(93,226,152,0.18)',borderRadius:8,padding:'0.6rem 0.75rem',fontSize:14,color:P.givre,outline:'none'}}/>
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

/* ═══════════════════════════════════════════════════════════════
   GESTION DES COMPTES — Dir péda uniquement
═══════════════════════════════════════════════════════════════ */
function UserManagement(){
  const [users,setUsers]=useState([])
  const [loading,setLoading]=useState(true)
  const [form,setForm]=useState({role:'rp',nom:'',prenom:'',email:'',password:'',campus:''})
  const [msg,setMsg]=useState('')
  const [err,setErr]=useState('')

  useEffect(()=>{api.getUsers().then(d=>{setUsers(d.users);setLoading(false)}).catch(()=>setLoading(false))},[])

  async function handleCreate(){
    setErr('');setMsg('')
    try {
      const data = await api.createUser(form)
      setMsg(`Compte créé : ${data.email}`)
      setForm({role:'rp',nom:'',prenom:'',email:'',password:'',campus:''})
      const d = await api.getUsers(); setUsers(d.users)
    } catch(e) { setErr(e.message) }
  }

  async function handleDelete(id,nom){
    if(!confirm(`Supprimer le compte de ${nom} ?`)) return
    try { await api.deleteUser(id); const d=await api.getUsers(); setUsers(d.users) }
    catch(e) { setErr(e.message) }
  }

  return(
    <div className="fi">
      <h2 style={{fontFamily:'var(--font-t)',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>Gestion des comptes</h2>

      {/* Formulaire création */}
      <div style={card({marginBottom:'1.5rem'})}>
        <div style={{fontSize:13,fontWeight:600,color:P.abysse,marginBottom:'0.75rem'}}>Nouveau compte</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:'0.5rem'}}>
          <div>
            <label style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.06em'}}>Rôle</label>
            <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:6,padding:'0.45rem',fontSize:13,color:P.abysse,background:P.surface}}>
              <option value="rp">Responsable pédagogique</option>
              <option value="intervenant">Intervenant</option>
              <option value="etudiant">Étudiant</option>
              <option value="dir">Direction des programmes</option>
            </select>
          </div>
          <div>
            <label style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.06em'}}>Campus</label>
            <input value={form.campus} onChange={e=>setForm({...form,campus:e.target.value})} placeholder="Bordeaux, Nantes…" style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:6,padding:'0.45rem',fontSize:13,color:P.abysse,outline:'none'}}/>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:'0.5rem'}}>
          <div><label style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.06em'}}>Nom</label><input value={form.nom} onChange={e=>setForm({...form,nom:e.target.value})} style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:6,padding:'0.45rem',fontSize:13,color:P.abysse,outline:'none'}}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.06em'}}>Prénom</label><input value={form.prenom} onChange={e=>setForm({...form,prenom:e.target.value})} style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:6,padding:'0.45rem',fontSize:13,color:P.abysse,outline:'none'}}/></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginBottom:'0.75rem'}}>
          <div><label style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.06em'}}>Email</label><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="auto si vide" style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:6,padding:'0.45rem',fontSize:13,color:P.abysse,outline:'none'}}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.06em'}}>Mot de passe</label><input value={form.password} onChange={e=>setForm({...form,password:e.target.value})} style={{width:'100%',border:`1px solid ${P.border}`,borderRadius:6,padding:'0.45rem',fontSize:13,color:P.abysse,outline:'none'}}/></div>
        </div>
        <button onClick={handleCreate} disabled={!form.nom||!form.password} style={{background:P.petrole,color:P.givre,border:'none',borderRadius:8,padding:'8px 20px',fontSize:13,fontWeight:500,cursor:(form.nom&&form.password)?'pointer':'not-allowed',opacity:(form.nom&&form.password)?1:0.5}}>Créer le compte</button>
        {msg&&<div style={{marginTop:'0.5rem',fontSize:12,color:P.petrole}}>{msg}</div>}
        {err&&<div style={{marginTop:'0.5rem',fontSize:12,color:P.red}}>{err}</div>}
      </div>

      {/* Liste des comptes */}
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
              <Tag label={ROLE_LABELS[u.role]||u.role} color={u.role==='dir'?'teal':u.role==='rp'?'blue':u.role==='intervenant'?'amber':'gray'} small/>
              <button onClick={()=>handleDelete(u.id,u.nom)} style={{color:P.red,fontSize:14,cursor:'pointer'}} title="Supprimer">×</button>
            </div>
          </div>
        ))
      }
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VUE DIRECTION DES PROGRAMMES
═══════════════════════════════════════════════════════════════ */
function VueDir({user,onLogout}){
  const [onglet,setOnglet]=useState('formations')
  const [formations,setFormations]=useState([])
  const [loading,setLoading]=useState(true)
  const [files,setFiles]=useState([])
  const [campusSel,setCampusSel]=useState([])
  const [ingLoading,setIngLoading]=useState(false)
  const [progress,setProgress]=useState('')
  const [error,setError]=useState('')
  const [selF,setSelF]=useState(null)

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
      // Passe par /api/ingest (clé côté serveur, pas de CORS)
      const campusVal=campusSel.length===1?campusSel[0]:campusSel
      const data=await ingererDocuments(textes,campusVal,setProgress)
      setProgress('Enregistrement…')
      await api.createFormation(campusVal,data)
      setProgress('Formation chargée ✓');setFiles([]);setCampusSel([])
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
              <div><h2 style={{fontFamily:'var(--font-t)',fontWeight:400,color:P.abysse,margin:0,fontSize:24}}>Formations chargées</h2><p style={{fontSize:13,color:P.textm,marginTop:'0.25rem'}}>{formations.length} formation{formations.length>1?'s':''}</p></div>
              <button onClick={()=>setOnglet('ingestion')} style={{background:P.petrole,color:P.givre,border:'none',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:500,cursor:'pointer'}}>+ Ajouter</button>
            </div>
            {loading?<div style={{textAlign:'center',padding:'2rem'}}><Spinner/></div>:
              formations.length===0?<Empty icon="🎓" titre="Aucune formation" msg="Utilisez l'onglet Ingestion pour analyser vos documents." action="Aller à l'ingestion →" onClick={()=>setOnglet('ingestion')}/>:
              formations.map(f=>(
                <div key={f._id} style={card({display:'flex',justifyContent:'space-between',alignItems:'flex-start'})}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600,color:P.abysse}}>{f.formation?.titre||'Sans titre'}</div>
                    <div style={{fontSize:11,color:P.textm,marginTop:3}}>{f._campus&&`📍 ${f._campus} · `}{(f.blocs||[]).length}B · {(f.blocs||[]).flatMap(b=>b.competences||[]).length}C · {(f.blocs||[]).flatMap(b=>b.modules||[]).length}M</div>
                    {(f.alertes_detectees||[]).length>0&&<div style={{fontSize:11,color:P.amber,marginTop:3}}>{(f.alertes_detectees||[]).length} alerte{(f.alertes_detectees||[]).length>1?'s':''}</div>}
                  </div>
                  <div style={{display:'flex',gap:'0.35rem',flexShrink:0,marginLeft:'0.75rem'}}>
                    <button onClick={()=>{setSelF(f);setOnglet('cartographie')}} style={{fontSize:11,color:P.petrole,border:`1px solid ${P.border}`,borderRadius:6,padding:'3px 9px',background:P.surface2,cursor:'pointer'}}>Voir</button>
                    <button onClick={()=>handleDelete(f._id)} style={{fontSize:11,color:P.red,border:`1px solid ${P.red}`,borderRadius:6,padding:'3px 9px',background:P.redbg,cursor:'pointer'}}>×</button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {onglet==='ingestion'&&(
          <div className="fi">
            <h2 style={{fontFamily:'var(--font-t)',fontWeight:400,color:P.abysse,marginTop:0,fontSize:24,marginBottom:'0.4rem'}}>Nouvelle formation</h2>
            <p style={{fontSize:13,color:P.textm,marginBottom:'2rem',lineHeight:1.7}}>Déposez vos documents (.md .txt .pdf .docx .xlsx) — syllabi, plan de formation, RACE.</p>

            {/* Campus multi-sélection */}
            <div style={card({marginBottom:'1rem'})}>
              <div style={{fontSize:12,fontWeight:600,color:P.abysse,marginBottom:'0.6rem'}}>Campus de rattachement</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'0.4rem'}}>
                {['Paris','Nantes','Bordeaux','Rennes','Le Mans','Vannes','Poitiers','La Rochelle'].map(c=>{
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
              <h2 style={{fontFamily:'var(--font-t)',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>{fCarto?.formation?.titre||'Cartographie'}</h2>
              <GrapheCanvas blocs={fCarto?.blocs||[]} alertes={fCarto?.alertes_detectees||[]} showAlerts/>
            </>}
          </div>
        )}

        {onglet==='alertes'&&(
          <div className="fi">
            <h2 style={{fontFamily:'var(--font-t)',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.5rem'}}>Alertes réseau</h2>
            <p style={{fontSize:12,color:P.textm,marginBottom:'1.25rem'}}>Signaux de coordination — opportunités pédagogiques, pas des sanctions.</p>
            {totalAlertes===0?<Empty icon="✅" titre="Aucune alerte" msg="Aucune redondance détectée."/>:
              formations.map(f=>(f.alertes_detectees||[]).length?<div key={f._id} style={{marginBottom:'1.5rem'}}>
                <div style={{fontSize:11,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>{f.formation?.titre}{f._campus?` · ${f._campus}`:''}</div>
                {(f.alertes_detectees||[]).map((a,i)=><div key={i} style={card({borderLeft:`3px solid ${a.niveau===2?P.amber:P.menthe}`})}><div style={{display:'flex',gap:'0.4rem',marginBottom:'0.5rem',flexWrap:'wrap'}}><Tag label={`Niveau ${a.niveau}`} color={a.niveau===2?'amber':'blue'} small/><span style={{fontSize:13,fontWeight:600,color:P.abysse}}>{a.notion}</span></div><p style={{fontSize:12,color:P.textm,margin:0,lineHeight:1.6}}>{a.message}</p></div>)}
              </div>:null)
            }
          </div>
        )}

        {onglet==='comptes'&&<UserManagement/>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VUE RP
═══════════════════════════════════════════════════════════════ */
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
        onglets={[{id:'formations',label:'Mes formations'},{id:'cartographie',label:'Cartographie'},{id:'blocs',label:'Blocs'},{id:'alertes',label:`Alertes (${alertes.length})`}]}/>
      <div style={{maxWidth:960,margin:'0 auto',padding:'1.5rem'}}>
        {loading?<div style={{textAlign:'center',padding:'2rem'}}><Spinner/></div>:!f?<Empty icon="🎓" titre="Aucune formation" msg="Aucune formation sur votre campus. Contacter la Direction des programmes."/>:<>
          {onglet==='formations'&&<div className="fi"><h2 style={{fontFamily:'var(--font-t)',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>Mes formations — {user.campus}</h2>{formations.map(fo=><div key={fo._id} onClick={()=>setSelF(fo)} style={{...card({cursor:'pointer',borderLeft:`3px solid ${selF?._id===fo._id?P.menthe:P.border}`})}}><div style={{fontSize:14,fontWeight:600,color:P.abysse}}>{fo.formation?.titre}</div><div style={{fontSize:11,color:P.textm,marginTop:3}}>{(fo.blocs||[]).length}B · {(fo.blocs||[]).flatMap(b=>b.modules||[]).length}M</div></div>)}</div>}
          {onglet==='cartographie'&&<div className="fi"><h2 style={{fontFamily:'var(--font-t)',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>{f.formation?.titre}</h2><GrapheCanvas blocs={f.blocs||[]} alertes={alertes} showAlerts/></div>}
          {onglet==='blocs'&&<div className="fi"><h2 style={{fontFamily:'var(--font-t)',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'1rem'}}>Blocs</h2>{(f.blocs||[]).map(b=><details key={b.id} style={{...card(),marginBottom:'0.6rem'}}><summary style={{listStyle:'none',display:'flex',justifyContent:'space-between',cursor:'pointer'}}><div><Tag label={b.id} small/><span style={{marginLeft:'0.5rem',fontSize:14,fontWeight:600,color:P.abysse}}>{b.titre}</span><div style={{fontSize:11,color:P.textm,marginTop:3}}>{(b.competences||[]).length}C · {(b.modules||[]).length}M</div></div><span style={{fontSize:18,color:P.textm}}>▾</span></summary><div style={{marginTop:'0.75rem',paddingTop:'0.75rem',borderTop:`1px solid ${P.border}`}}>{(b.modules||[]).map(m=><div key={m.id} style={{background:P.surface2,borderRadius:8,padding:'0.5rem 0.75rem',marginBottom:'0.35rem',border:`1px solid ${P.border}`}}><div style={{fontSize:13,fontWeight:500,color:P.abysse}}>{m.titre}</div>{m.intervenant&&<div style={{fontSize:11,color:P.textm}}>{m.intervenant}</div>}{m.notions_cles?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'0.25rem',marginTop:'0.3rem'}}>{m.notions_cles.map(n=><Tag key={n} label={n} small/>)}</div>}</div>)}</div></details>)}</div>}
          {onglet==='alertes'&&<div className="fi"><h2 style={{fontFamily:'var(--font-t)',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.5rem'}}>Alertes</h2>{alertes.length===0?<Empty icon="✅" titre="Aucune alerte" msg="Aucune redondance."/>:alertes.map((a,i)=><div key={i} style={card({borderLeft:`3px solid ${a.niveau===2?P.amber:P.menthe}`})}><div style={{display:'flex',gap:'0.4rem',marginBottom:'0.5rem'}}><Tag label={`Niveau ${a.niveau}`} color={a.niveau===2?'amber':'blue'} small/><span style={{fontSize:13,fontWeight:600,color:P.abysse}}>{a.notion}</span></div><p style={{fontSize:12,color:P.textm,margin:0,lineHeight:1.6}}>{a.message}</p></div>)}</div>}
        </>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VUE INTERVENANT
═══════════════════════════════════════════════════════════════ */
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

  const mesModules=selF?(selF.blocs||[]).flatMap(b=>(b.modules||[]).map(m=>({...m,bloc_id:b.id,bloc_titre:b.titre}))):[]

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

          {onglet==='avant'&&!selMod&&<div className="fi"><h2 style={{fontFamily:'var(--font-t)',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.5rem'}}>Choisir un module</h2><p style={{fontSize:13,color:P.textm,marginBottom:'1rem'}}>Sélectionnez le module pour générer la fiche J‑1.</p>
            {(selF.blocs||[]).map(b=>{const bM=mesModules.filter(m=>m.bloc_id===b.id);if(!bM.length)return null;return<div key={b.id} style={{marginBottom:'1rem'}}><div style={{fontSize:11,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.4rem'}}>{b.id} — {b.titre}</div>{bM.map(m=><button key={m.id} onClick={()=>chargerFiche(m)} style={{width:'100%',textAlign:'left',padding:'0.75rem 1rem',borderRadius:10,border:`1px solid ${P.border}`,background:P.surface,marginBottom:'0.35rem',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}} onMouseEnter={e=>e.currentTarget.style.boxShadow='0 3px 12px rgba(11,43,45,0.08)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}><div><div style={{fontSize:13,fontWeight:500,color:P.abysse}}>{m.titre}</div>{m.intervenant&&<div style={{fontSize:11,color:P.textm,marginTop:2}}>{m.intervenant}</div>}</div><span style={{fontSize:11,color:P.textm}}>Générer →</span></button>)}</div>})}
          </div>}

          {onglet==='avant'&&selMod&&<div className="fi">
            <div style={{display:'flex',alignItems:'center',gap:'0.5rem',marginBottom:'1.5rem'}}>
              <button onClick={()=>{setSelMod(null);setFiche(null)}} style={{fontSize:12,color:P.petrole,border:`1px solid ${P.border}`,borderRadius:6,padding:'3px 10px',background:P.surface,cursor:'pointer'}}>← Modules</button>
              <span style={{fontSize:13,fontWeight:600,color:P.abysse}}>{selMod.titre}</span>
            </div>
            {ficheLoading?<div style={{padding:'1.25rem',background:P.abysse,borderRadius:12,border:`1px solid ${P.borderm}`}}><div style={{fontSize:10,fontWeight:600,color:'rgba(93,226,152,0.5)',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:'0.5rem',display:'flex',alignItems:'center',gap:'0.5rem'}}><Spinner size={14}/>Claude génère la fiche…</div><div style={{fontSize:11,color:P.eau,fontFamily:'monospace',lineHeight:1.7,whiteSpace:'pre-wrap',wordBreak:'break-word',minHeight:60}}>{stream}<span className="stream-cursor"/></div></div>:fiche&&<>
              <div style={card()}><div style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Ancrage</div><div style={{display:'flex',gap:'0.5rem',alignItems:'flex-start',marginBottom:'0.5rem'}}><Tag label={selMod.bloc_id}/><div><div style={{fontSize:13,fontWeight:600,color:P.abysse}}>{selMod.titre}</div><div style={{fontSize:11,color:P.textm,marginTop:2}}>{selMod.bloc_titre}</div></div></div><p style={{fontSize:12,color:P.textm,margin:0,lineHeight:1.6,fontStyle:'italic'}}>{fiche.ancrage}</p></div>
              {fiche.dejavu?.length>0&&<div style={card()}><div style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Déjà vu par vos étudiants</div>{fiche.dejavu.map((it,i)=><div key={i} style={{background:P.surface2,borderRadius:8,padding:'0.55rem 0.8rem',marginBottom:'0.4rem'}}><div style={{display:'flex',alignItems:'center',gap:'0.35rem',marginBottom:'0.3rem'}}>{it.intervenant&&<Avatar name={it.intervenant} size={20}/>}<span style={{fontSize:12,fontWeight:600,color:P.abysse}}>{it.intervenant||'—'}</span><span style={{fontSize:11,color:P.textm}}>· {it.module}</span></div><div style={{display:'flex',flexWrap:'wrap',gap:'0.25rem',marginBottom:'0.3rem'}}>{(it.concepts||[]).map(c=><Tag key={c} label={c} small/>)}</div><p style={{fontSize:11,color:P.textm,margin:0,fontStyle:'italic'}}>{it.lien}</p></div>)}</div>}
              {fiche.apres?.length>0&&<div style={card()}><div style={{fontSize:10,fontWeight:600,color:P.textm,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'0.5rem'}}>Ce qui arrive après</div>{fiche.apres.map((it,i)=><div key={i} style={{display:'flex',gap:'0.6rem',padding:'0.4rem 0',borderBottom:i<fiche.apres.length-1?`1px solid rgba(19,69,71,0.06)`:'none'}}><div style={{fontSize:11,color:P.textl,flexShrink:0,width:60}}>{it.date}</div><div style={{flex:1}}><span style={{fontSize:12,fontWeight:600,color:P.abysse}}>{it.module}</span>{it.intervenant&&<span style={{fontSize:11,color:P.textm}}> · {it.intervenant}</span>}<div style={{display:'flex',flexWrap:'wrap',gap:'0.25rem',marginTop:'0.25rem'}}>{(it.concepts||[]).map(c=><Tag key={c} label={c} small/>)}</div></div></div>)}</div>}
            </>}
          </div>}

          {onglet==='declaration'&&(sent?<div style={{textAlign:'center',padding:'4rem 2rem'}}><div style={{fontSize:48,color:P.menthe}}>✓</div><h2 style={{fontFamily:'var(--font-t)',fontWeight:400,color:P.abysse,fontSize:21,marginTop:'0.5rem'}}>Déclaration enregistrée</h2><button onClick={()=>setSent(false)} style={{marginTop:'1rem',border:`1px solid ${P.border}`,color:P.textm,borderRadius:6,padding:'6px 16px',fontSize:12,background:P.surface,cursor:'pointer'}}>Nouvelle déclaration</button></div>:!selMod?<div style={{padding:'2rem',textAlign:'center',color:P.textm}}>Sélectionnez un module dans l'onglet Fiche J-1.</div>:<div className="fi"><h1 style={{fontFamily:'var(--font-t)',fontWeight:400,fontSize:21,color:P.abysse,margin:0,marginBottom:'1.25rem'}}>Déclaration — {selMod.titre}</h1><button onClick={async()=>{await new Promise(r=>setTimeout(r,700));setSent(true)}} style={{width:'100%',background:P.petrole,color:P.givre,border:'none',borderRadius:10,padding:'12px',fontSize:14,fontWeight:500,cursor:'pointer'}}>Envoyer la déclaration</button></div>)}

          {onglet==='graphe'&&<div className="fi"><h2 style={{fontFamily:'var(--font-t)',fontWeight:400,color:P.abysse,marginTop:0,fontSize:22,marginBottom:'0.5rem'}}>Vue d'ensemble</h2><p style={{fontSize:12,color:P.textm,marginBottom:'1rem'}}>Lecture seule.</p><GrapheCanvas blocs={selF?.blocs||[]} alertes={[]} showAlerts={false}/></div>}
        </>}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   VUE ÉTUDIANT
═══════════════════════════════════════════════════════════════ */
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
        <div style={{display:'flex',alignItems:'center',gap:6,paddingRight:10,borderRight:`1px solid ${P.border}`}}><div style={{width:24,height:24,borderRadius:'50%',background:P.petrole,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:P.menthe,fontSize:11,fontWeight:700,fontFamily:'var(--font-t)',fontStyle:'italic'}}>e</span></div></div>
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

/* ═══════════════════════════════════════════════════════════════
   APP ROOT — auth gate
═══════════════════════════════════════════════════════════════ */
export default function App(){
  const [user,setUser]=useState(null)
  const [checking,setChecking]=useState(true)

  useEffect(()=>{
    const token=getToken()
    if(!token){setChecking(false);return}
    api.me().then(d=>setUser(d.user)).catch(()=>clearToken()).finally(()=>setChecking(false))
  },[])

  function handleLogout(){
    api.logout().catch(()=>{})
    clearToken();setUser(null)
  }

  if(checking) return <div style={{minHeight:'100vh',background:'var(--grad-fond)',display:'flex',alignItems:'center',justifyContent:'center'}}><Spinner size={32}/></div>
  if(!user) return <LoginPage onLogin={u=>setUser(u)}/>

  if(user.role==='dir')         return <VueDir user={user} onLogout={handleLogout}/>
  if(user.role==='rp')          return <VueRP user={user} onLogout={handleLogout}/>
  if(user.role==='intervenant') return <VueIntervenant user={user} onLogout={handleLogout}/>
  if(user.role==='etudiant')    return <VueEtudiant user={user} onLogout={handleLogout}/>
  return <div>Rôle inconnu : {user.role}</div>
}
