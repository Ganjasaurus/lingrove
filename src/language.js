import {pinyin} from 'pinyin-pro';
export function pinyinFor(text){
  return pinyin(text,{toneType:'symbol',nonZh:'consecutive'}).replace(/[，。！？；：]/g,c=>({'，':',','。':'.','！':'!','？':'?','；':';','：':':'}[c])).replace(/\s+([,.!?;:])/g,'$1').replace(/\p{L}/u,c=>c.toUpperCase());
}
