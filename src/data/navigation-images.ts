/** Generated illustrations inspired by catalog sites, not verified depictions. */
export const navigationImages:Record<string,string> = {
 ruwan:'/images/sites/ruwan-reference.png',
 bodhi:'/images/sites/bodhi.jpg',
 jetavana:'/images/sites/jetavana-reference.png',
 abhaya:'/images/sites/abhaya-reference.png',
 kuttam:'/images/sites/kuttam.jpg',
 basawakkulama:'/images/sites/basawakkulama.jpg',
 thuparamaya:'/images/sites/thuparamaya-reference.png',
 lovamahapaya:'/images/sites/lovamahapaya.jpg',
 mirisaveti:'/images/sites/mirisaveti-reference.png',
 lankarama:'/images/sites/lankarama.jpg',
 'ranmasu':'/images/sites/ranmasu.jpg',
 'samadhi':'/images/sites/samadhi.jpg',
 'isurumuniya':'/images/sites/isurumuniya.jpg',
 'eth-pokuna':'/images/sites/eth-pokuna.jpg',
 'ratnaprasada':'/images/sites/ratnaprasada.jpg',
 'vessagiriya':'/images/sites/vessagiriya.jpg',
 'vijayabahu':'/images/sites/vijayabahu.jpg',
 'dakkhina':'/images/sites/dakkhina.jpg',
 'mihintale':'/images/sites/mihintale.jpg',
 'tissa-wewa':'/images/sites/tissa-wewa.jpg',
};

/** Source photographs used as visual references for generated illustrations. */
export type SitePhoto={url:string;source:string;credit:string;license:string;licenseUrl:string};
const savin=(hash:string,file:string):SitePhoto=>({url:`https://upload.wikimedia.org/wikipedia/commons/thumb/${hash}/${file}/1280px-${file}`,source:`https://commons.wikimedia.org/wiki/File:${file}`,credit:'A.Savin, Wikipedia',license:'Free Art License',licenseUrl:'https://artlibre.org/licence/lal/en/'});
export const navigationPhotos:Record<string,SitePhoto>={
 ruwan:savin('0/04','SL_Anuradhapura_asv2020-01_img11_Ruwanwelisaya_Stupa.jpg'),
 abhaya:savin('8/8f','SL_Anuradhapura_asv2020-01_img31_Abhayagiriya_Stupa.jpg'),
 thuparamaya:savin('e/ef','SL_Anuradhapura_asv2020-01_img34_Thuparamaya_Stupa.jpg'),
 mirisaveti:savin('c/cc','SL_Anuradhapura_asv2020-01_img35_Mirisawetiya_Stupa.jpg'),
 lankarama:savin('f/fa','SL_Anuradhapura_asv2020-01_img33_Lankarama_Stupa.jpg'),
 jetavana:{url:'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Jetavanaramaya_Stupa_profile.jpg/1280px-Jetavanaramaya_Stupa_profile.jpg',source:'https://commons.wikimedia.org/wiki/File:Jetavanaramaya_Stupa_profile.jpg',credit:'Wimukthi Bandara',license:'CC BY-SA 4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/'},
 dakkhina:{url:'https://upload.wikimedia.org/wikipedia/commons/2/2a/Dakkhinatupa.jpg',source:'https://commons.wikimedia.org/wiki/File:Dakkhinatupa.jpg',credit:'J. Ollé',license:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/'}
};
