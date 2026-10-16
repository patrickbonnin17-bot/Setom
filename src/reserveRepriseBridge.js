import { addReservePhotos } from './reserveReprisePhotos';

function connect(){
  document.querySelectorAll('[data-setom-reserve-actions] button').forEach((button,index)=>{
    if(index===0 && !button.dataset.connected){button.dataset.connected='1';button.addEventListener('click',()=>addReservePhotos());}
  });
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setInterval(connect,800),{once:true});
else setInterval(connect,800);
