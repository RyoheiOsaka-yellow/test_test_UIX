module.exports=(G)=>{ try{ Object.assign(G, require('./capture_more')); }catch(e){ if(e.code!=='MODULE_NOT_FOUND') throw e; } return G; };
