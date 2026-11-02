export type Site = { id:string; name:string; category:string; description:string; period:string; label:string; source:string; imagePosition:string };
// Editorial starter records, deliberately without coordinates until reviewed against an authoritative dataset.
export const sites: Site[] = [
 {id:'ruwanwelisaya',name:'Ruwanwelisaya',category:'Stupas & temples',description:'A great white stupa and enduring place of Buddhist devotion in the sacred city.',period:'Ancient Anuradhapura',label:'THE GREAT STUPA',source:'https://whc.unesco.org/en/list/200/',imagePosition:'center 48%'},
 {id:'sri-maha-bodhi',name:'Sri Maha Bodhi',category:'Sacred sites',description:'A sacred fig tree at the heart of a living tradition of pilgrimage and worship.',period:'Ancient Anuradhapura',label:'THE SACRED TREE',source:'https://whc.unesco.org/en/list/200/',imagePosition:'left 70%'},
 {id:'jetavanaramaya',name:'Jetavanaramaya',category:'Stupas & temples',description:'The monumental remains of one of the ancient city’s great monastic complexes.',period:'Ancient Anuradhapura',label:'MONASTIC HERITAGE',source:'https://whc.unesco.org/en/list/200/',imagePosition:'right 55%'},
 {id:'abhayagiri',name:'Abhayagiri',category:'Monasteries',description:'A historic monastery complex reflecting the city’s long religious and cultural life.',period:'Ancient Anuradhapura',label:'ANCIENT MONASTERY',source:'https://whc.unesco.org/en/list/200/',imagePosition:'center 70%'},
 {id:'thuparamaya',name:'Thuparamaya',category:'Stupas & temples',description:'A revered stupa within the historic sacred landscape of Anuradhapura.',period:'Ancient Anuradhapura',label:'SACRED LANDMARK',source:'https://whc.unesco.org/en/list/200/',imagePosition:'left 45%'},
 {id:'isurumuniya',name:'Isurumuniya',category:'Sacred sites',description:'A historic Buddhist temple known for its relationship with the surrounding rock landscape.',period:'Ancient Anuradhapura',label:'ROCK TEMPLE',source:'https://whc.unesco.org/en/list/200/',imagePosition:'right 75%'}
];
export const categories=['All places','Stupas & temples','Sacred sites','Monasteries'];
