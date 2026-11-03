export type HeritageSite = {id:string; name:string; category:string; period:string; latitude:number|null; longitude:number|null; description:string; history:string; facts:string[]; icon:string; source:string; modelUrl?:string; coordinateSource?:string; routingAllowed?:boolean};
// Reference coordinates are approximate map points, not verified entrances or AR anchors.
export const heritageSites:HeritageSite[] = [
{id:'ruwan',name:'Ruwanwelisaya',category:'Sacred Stupa',modelUrl:'/models/ruwanwelisaya.glb',period:'2nd century BC',latitude:8.35000,longitude:80.39639,description:'One of Sri Lanka’s most revered stupas, traditionally associated with King Dutugemunu.',history:'Ruwanwelisaya is a major Buddhist monument in Anuradhapura, traditionally attributed to King Dutugemunu, and remains an important place of worship.',facts:['Traditionally associated with King Dutugemunu','A major place of Buddhist worship','Respect worshippers, rituals and restricted areas'],icon:'♜',source:'https://en.wikipedia.org/wiki/Ruwanweliseya'},
{id:'bodhi',name:'Jaya Sri Maha Bodhi',category:'Sacred Tree',period:'Tradition dates to 3rd century BC',latitude:8.34472,longitude:80.39667,description:'A deeply revered sacred fig tree connected with the arrival of Buddhism in Sri Lanka.',history:'The Sri Maha Bodhi is revered as a sapling connected to the Bodhi tree at Bodh Gaya. Its history is linked with the introduction and development of Buddhism in Sri Lanka.',facts:['One of Sri Lanka’s most venerated Buddhist sites','Linked to the arrival of Buddhism','Follow local photography and access rules'],icon:'♧',source:'https://en.wikipedia.org/wiki/Jaya_Sri_Maha_Bodhi'},
{id:'jetavana',name:'Jetavanaramaya',category:'Ancient Stupa',period:'3rd century AD',latitude:8.35162,longitude:80.40365,description:'One of the monumental stupas of the ancient city.',history:'Jetavanaramaya is among the major ancient monuments of Anuradhapura. Its remains reveal the scale of the city’s religious and architectural heritage.',facts:['Part of the Sacred City landscape','Associated with an ancient monastic complex','Stay on marked visitor paths'],icon:'◈',source:'https://en.wikipedia.org/wiki/Jetavanaramaya'},
{id:'abhaya',name:'Abhayagiri Dagaba',category:'Monastic Complex',period:'Founded in the 1st century BC',latitude:8.370944,longitude:80.39525,description:'A vast monastic landscape revealing the religious history of ancient Anuradhapura.',history:'Abhayagiri developed as a major monastic institution. Its archaeological remains include religious, residential and water-management features.',facts:['A major ancient Buddhist monastic centre','Explore the wider archaeological landscape','Some areas may have access restrictions'],icon:'♜',source:'https://www.wikidata.org/wiki/Q320543'},
{id:'kuttam',name:'Kuttam Pokuna',category:'Twin Ponds',period:'Anuradhapura period',latitude:8.3709,longitude:80.4016,description:'The Twin Ponds, an example of ancient water architecture.',history:'Kuttam Pokuna is an example of ancient Sri Lankan water engineering. Its design and stonework offer insight into the technical achievements of the period.',facts:['A distinctive ancient water structure','Explore its stonework and water features','Do not enter the ponds or restricted areas'],icon:'◉',source:'https://www.wikidata.org/wiki/Q3877478'},
{id:'basawakkulama',name:'Basawakkulama Wewa',routingAllowed:false,category:'Ancient Reservoir',period:'Ancient Anuradhapura',latitude:8.3516,longitude:80.38771,description:'An ancient reservoir connected with dry-zone water-management traditions.',history:'Ancient reservoirs are central to understanding settlement, agriculture and water management in Sri Lanka’s dry zone.',facts:['Part of the ancient water-management landscape','Observe wildlife and keep the area clean','Do not enter restricted embankments'],icon:'≈',source:'https://mapcarta.com/W30738010'}
];

// Other requested places. Null coordinates remain list-only until a source is available.
const overview = 'https://whc.unesco.org/en/list/200/';
type Extra = {id:string;name:string;category:string;icon:string;lat?:number;lon?:number;source?:string;routingAllowed?:boolean};
const extraSites:Extra[] = [
 {id:'thuparamaya',name:'Thuparamaya Dagoba',category:'Stupa',icon:'♜',lat:8.35528,lon:80.39611,source:'https://en.wikipedia.org/wiki/Thuparamaya'},
 {id:'lovamahapaya',name:'Lovamahapaya (The Brazen Palace)',category:'Ancient Palace',icon:'▥',lat:8.346111,lon:80.3975,source:'https://www.wikidata.org/wiki/Q3911674'},
 {id:'mirisaveti',name:'Mirisaveti Stupa',category:'Stupa',icon:'♜',lat:8.345,lon:80.388889,source:'https://aroundus.com/p/8405567-mirisawetiya-vihara'},
 {id:'lankarama',name:'Lankarama Stupa',category:'Stupa',icon:'♜',lat:8.3646,lon:80.3905,source:'https://mapcarta.com/27226614'},
 {id:'dalada-maligawa',name:'Dalada Maligawa (Ancient Tooth Relic Temple Ruins)',category:'Archaeological Ruins',icon:'▥'},
 {id:'naka-vihara',name:'Naka Vihara (Nakha Vehera Square Stupa)',category:'Archaeological Ruins',icon:'♜'},
 {id:'gal-palama',name:'Gal Palama (Perimiyankulama Stone Bridge)',category:'Ancient Bridge',icon:'▤'},
 {id:'halpan-ela',name:'Halpan Ela Gal Palama (Second Stone Bridge)',category:'Ancient Bridge',icon:'▤'},
 {id:'ranmasu',name:'Ranmasu Uyana (Royal Pleasure Gardens)',category:'Ancient Gardens',icon:'♧',lat:8.3384222,lon:80.3898477,source:'https://evendo.com/locations/sri-lanka/anuradhapura-district/landmark/ranmasu-uyana-royal-park'},
 {id:'kiribath',name:'Kiribath Vehera Stupa',category:'Stupa',icon:'♜'},
 {id:'mahapali',name:'Mahapali Refectory (Ancient Alms Hall)',category:'Archaeological Ruins',icon:'▥'},
 {id:'samadhi',name:'Samadhi Buddha Statue',category:'Statue',icon:'♧',lat:8.36987,lon:80.39817,source:'https://en.wikipedia.org/wiki/Samadhi_Statue'},
 {id:'isurumuniya',name:'Isurumuniya Rock Temple',category:'Rock Temple',icon:'♜',lat:8.3346,lon:80.3904,source:'https://en.wikipedia.org/wiki/Isurumuniya'},
 {id:'eth-pokuna',name:'Eth Pokuna (The Elephant Pond)',category:'Ancient Pond',icon:'◉',lat:8.3684302,lon:80.3907281,source:'https://www.lankatraveldirectory.com/places/central-province/kandy-district/historical-places/eth-pokuna-elephant-pond/',routingAllowed:false},
 {id:'moonstone',name:"The Moonstones (Sandakada Pahana - Queen's Palace)",category:'Stone Carving',icon:'◈'},
 {id:'ratnaprasada',name:'Ratnaprasada (Gem Palace Ruins)',category:'Archaeological Ruins',icon:'▥',lat:8.370476,lon:80.39109,source:'https://www.tripadvisor.com/Attraction_Review-g304132-d33395023-Reviews-Ratna_Prasada-Anuradhapura_North_Central_Province.html'},
 {id:'vessagiriya',name:'Vessagiriya Cave Monastery',category:'Monastery',icon:'♧',lat:8.3284,lon:80.38985,source:'https://mapcarta.com/W407424136'},
 {id:'vijayabahu',name:'Vijayabahu I Royal Palace Ruins',category:'Ancient Palace',icon:'▥',lat:8.357611,lon:80.399194,source:'https://www.uniquesrilanka.com/v2/heritage/vijayaba-palace-anuradhapura'},
 {id:'pankuliya',name:'Pankuliya Ashokaramaya (Seated Buddha Site)',category:'Buddhist Site',icon:'♧'},
 {id:'dakkhina',name:"Dakkhina Stupa (historically called Elara's Tomb)",category:'Stupa',icon:'♜',lat:8.341389,lon:80.394917,source:'https://en.wikipedia.org/wiki/Dakkhina_Stupa'},
 {id:'toluvila',name:'Toluvila Monastery Ruins',category:'Monastery',icon:'♧'},
 {id:'mihintale',name:'Mihintale Mountain Archaeological Site',category:'Archaeological Site',icon:'♧',lat:8.350594,lon:80.516944,source:'https://www.wikidata.org/wiki/Q1478212',routingAllowed:false},
 {id:'tissa-wewa',name:'Tissa Wewa',category:'Ancient Reservoir',icon:'≈',lat:8.335,lon:80.38,source:'https://en.wikipedia.org/wiki/Tissa_Wewa_(Anuradhapura)',routingAllowed:false},
 {id:'nuwara-wewa',name:'Nuwara Wewa',category:'Ancient Reservoir',icon:'≈',lat:8.333611,lon:80.433333,source:'http://wikimapia.org/1053553/Nuwara-wewa',routingAllowed:false}
];
for (const item of extraSites) {
 const hasCoordinates = item.lat !== undefined && item.lon !== undefined;
 heritageSites.push({id:item.id,name:item.name,category:item.category,period:'Needs further review',latitude:item.lat??null,longitude:item.lon??null,description:`${item.name} is included in the heritage discovery list. Site-specific historical details are awaiting review.`,history:'This is an introductory catalog record. Historical details and access information require review against authoritative sources.',facts:['Respect protected sites and follow local guidance','Site-specific history and access require verification'],icon:item.icon,source:item.source??overview,coordinateSource:hasCoordinates?item.source:undefined,routingAllowed:item.routingAllowed});
}
export function hasCoordinates(site:HeritageSite):site is HeritageSite & {latitude:number;longitude:number} {return site.latitude!==null && site.longitude!==null && Number.isFinite(site.latitude) && Number.isFinite(site.longitude)}
