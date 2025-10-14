
// client/src/lib/wishlist.js (v2) — хранит снимки товаров
const READ_KEYS = ['wishlist_v2','wishlist','favorites'];
const WRITE_KEY = 'wishlist_v2';

function normId(x){ const n=Number(x); return Number.isFinite(n)?n:String(x); }
function readAny(){
  for(const k of READ_KEYS){
    try{ const raw = JSON.parse(localStorage.getItem(k));
      if(!raw) continue;
      if(Array.isArray(raw)){
        if(raw.length===0) return [];
        if(typeof raw[0]==='object' && raw[0]!==null) return raw.filter(Boolean);
        return raw.map(id=>({id:normId(id)}));
      }
    }catch{}
  }
  return [];
}
function save(items){ try{ localStorage.setItem(WRITE_KEY, JSON.stringify(items)); }catch{} }

export function getItems(){ return readAny(); }
export function getIds(){ return getItems().map(x=>x.id); }
export function has(id){ const sid=String(id); return getItems().some(x=>String(x.id)===sid); }

export function upsert(product){
  if(!product || product.id==null) return getItems();
  const snap={ id:product.id, title:product.title||product.name||'', price:product.price??null,
    preview_image_url:product.preview_image_url||product.image_url||null,
    image_url:product.image_url||product.preview_image_url||null };
  const arr=getItems(); const sid=String(snap.id); const i=arr.findIndex(x=>String(x.id)===sid);
  if(i>=0) arr[i]={...arr[i],...snap}; else arr.unshift(snap);
  save(arr); window.dispatchEvent(new CustomEvent('wishlist:changed',{detail:{type:'add',id:snap.id}})); return arr;
}
export function remove(id){ const sid=String(id); const arr=getItems().filter(x=>String(x.id)!==sid);
  save(arr); window.dispatchEvent(new CustomEvent('wishlist:changed',{detail:{type:'remove',id}})); return arr; }
export function toggle(idOrProduct, maybeProduct){
  const product = (typeof idOrProduct==='object') ? idOrProduct : (maybeProduct||{id:idOrProduct});
  return has(product.id) ? remove(product.id) : upsert(product);
}
