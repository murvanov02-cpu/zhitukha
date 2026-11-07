// Все игровые данные: редкости, предметы, кейсы, работы, навыки, статусы, отношения.
// Баланс правится здесь — код игры трогать не нужно.
//
// Время: 1 час реального времени = MONTHS_PER_HOUR игровых месяцев. Зарплаты и аренда
// записаны в рублях за месяц. Везде ниже, где сказано «часов дохода», имеется в виду
// «месяцев дохода» (сколько игрок зарабатывает за столько игровых месяцев).
// Темп подобран так, чтобы активный игрок проходил игру на 100% примерно за неделю.
const MONTHS_PER_HOUR = 8;
// Цены — примерно реальные рыночные (Россия, 2025). Аренда — около 0,5% стоимости в месяц:
// недвижимость — надёжное, но медленное вложение.

// mult — во сколько раз дороже встречи и услуги связи этой редкости
const RARITIES = {
  common:    { name: 'Обычный',     color: '#9aa4b8', bg: 'rgba(154,164,184,.14)', mult: 1 },
  rare:      { name: 'Редкий',      color: '#3b9cff', bg: 'rgba(59,156,255,.16)', mult: 3 },
  epic:      { name: 'Эпический',   color: '#b45cff', bg: 'rgba(180,92,255,.18)', mult: 10 },
  legendary: { name: 'Легендарный', color: '#ffb82e', bg: 'rgba(255,184,46,.18)', mult: 40 },
  mythic:    { name: 'Мифический',  color: '#ff4d6d', bg: 'rgba(255,77,109,.2)', mult: 150 },
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];

const SELL_RATE = 0.7; // продажа — 70% рыночной стоимости, как на вторичном рынке

// cat: car — bonus = % к зарплате (работает одна активная машина)
//      home — bonus = ₽/мес аренды (каждое жильё сдаётся один раз — копии лишние, их можно продать)
// value — рыночная стоимость (продаётся за SELL_RATE от неё)
// t — темы для тематических кейсов (ru, jp, de, cn, sc — машины; msk, country, abroad — жильё)
// img — путь к картинке; если не указан, показывается icon
// credit — автор и лицензия фото (показываются на экране «Авторы фото»)
const ITEMS = [
  { id: 'c_2107',     cat: 'car', name: 'ВАЗ-2107',              icon: '🚗', rarity: 'common',    bonus: 2,  t: ['ru'], value: 150e3,
    img: 'img/cars/c_2107_v52.webp', credit: 'SuperTank17 · CC BY 3.0' },
  { id: 'c_granta',   cat: 'car', name: 'Lada Granta',           icon: '🚗', rarity: 'common',    bonus: 3,  t: ['ru'], value: 900e3,
    img: 'img/cars/c_granta_v52.webp', credit: 'Throwawayacc222 · CC0' },
  { id: 'c_solaris',  cat: 'car', name: 'Hyundai Solaris',       icon: '🚙', rarity: 'common',    bonus: 4,  value: 1.5e6,
    img: 'img/cars/c_solaris_v52.webp', credit: 'Greg Gjerdingen · CC BY 2.0' },
  { id: 'c_rio',      cat: 'car', name: 'Kia Rio',               icon: '🚙', rarity: 'common',    bonus: 4,  value: 1.6e6,
    img: 'img/cars/c_rio_v52.webp', credit: 'Kevauto · CC BY-SA 4.0' },
  { id: 'c_k5',       cat: 'car', name: 'Kia K5',                icon: '🚘', rarity: 'rare',      bonus: 8,  value: 3.2e6,
    img: 'img/cars/c_k5_v52.webp', credit: 'MercurySable99 · CC BY-SA 4.0' },
  { id: 'c_camry',    cat: 'car', name: 'Toyota Camry',          icon: '🚘', rarity: 'rare',      bonus: 8,  t: ['jp'], value: 3.8e6,
    img: 'img/cars/c_camry_v52.webp', credit: 'MercurySable99 · CC BY-SA 4.0' },
  { id: 'c_tiguan',   cat: 'car', name: 'Volkswagen Tiguan',     icon: '🚙', rarity: 'rare',      bonus: 10, t: ['de'], value: 4.5e6,
    img: 'img/cars/c_tiguan_v52.webp', credit: 'Mr.choppers · CC BY-SA 3.0' },
  { id: 'c_eclass',   cat: 'car', name: 'Mercedes-Benz E-класс', icon: '🚘', rarity: 'epic',      bonus: 15, t: ['de'], value: 9e6,
    img: 'img/cars/c_eclass_v52.webp', credit: 'LuvsMG481 · CC BY-SA 4.0' },
  { id: 'c_m5',       cat: 'car', name: 'BMW M5',                icon: '🏎️', rarity: 'epic',      bonus: 17, t: ['de'], value: 18e6,
    img: 'img/cars/c_m5_v52.webp', credit: 'Tokumeigakarinoaoshima · CC BY-SA 4.0' },
  { id: 'c_rs6',      cat: 'car', name: 'Audi RS6',              icon: '🚘', rarity: 'epic',      bonus: 18, t: ['de'], value: 20e6,
    img: 'img/cars/c_rs6_v52.webp', credit: 'Alexander Migl · CC BY-SA 4.0' },
  { id: 'c_911',      cat: 'car', name: 'Porsche 911',           icon: '🏎️', rarity: 'legendary', bonus: 30, t: ['de','sc'], value: 25e6,
    img: 'img/cars/c_911_v52.webp', credit: 'Matti Blume · CC BY-SA 4.0' },
  { id: 'c_g63',      cat: 'car', name: 'Mercedes-AMG G63',      icon: '🚙', rarity: 'legendary', bonus: 32, t: ['de'], value: 28e6,
    img: 'img/cars/c_g63_v52.webp', credit: 'Alexander Migl · CC BY-SA 4.0' },
  { id: 'c_urus',     cat: 'car', name: 'Lamborghini Urus',      icon: '🏎️', rarity: 'legendary', bonus: 35, t: ['sc'], value: 40e6,
    img: 'img/cars/c_urus_v52.webp', credit: 'Kevauto · CC BY-SA 4.0' },
  { id: 'c_cullinan', cat: 'car', name: 'Rolls-Royce Cullinan',  icon: '🚘', rarity: 'mythic',    bonus: 55, value: 70e6,
    img: 'img/cars/c_cullinan_v52.webp', credit: 'Mr.choppers · CC BY-SA 3.0' },
  { id: 'c_chiron',   cat: 'car', name: 'Bugatti Chiron',        icon: '🏎️', rarity: 'mythic',    bonus: 60, t: ['sc'], value: 350e6,
    img: 'img/cars/c_chiron_v52.webp', credit: 'Vauxford · CC BY-SA 4.0' },

  { id: 'c_2109', cat: 'car', name: 'ВАЗ-2109', icon: '🚗', rarity: 'common', bonus: 2, t: ['ru'], value: 120e3,
    img: 'img/cars/c_2109_v52.webp', credit: 'Throwawayacc222 · CC0' },
  { id: 'c_niva', cat: 'car', name: 'Lada Niva Legend', icon: '🚙', rarity: 'common', bonus: 3, t: ['ru'], value: 1.1e6,
    img: 'img/cars/c_niva_v52.webp', credit: 'Throwawayacc222 · CC0' },
  { id: 'c_vesta', cat: 'car', name: 'Lada Vesta', icon: '🚗', rarity: 'common', bonus: 4, t: ['ru'], value: 1.5e6,
    img: 'img/cars/c_vesta_v52.webp', credit: 'Throwawayacc222 · CC0' },
  { id: 'c_logan', cat: 'car', name: 'Renault Logan', icon: '🚗', rarity: 'common', bonus: 3, value: 900e3,
    img: 'img/cars/c_logan_v52.webp', credit: 'ROCostiTheBunnyCZ · CC BY-SA 4.0' },
  { id: 'c_polo', cat: 'car', name: 'Volkswagen Polo', icon: '🚗', rarity: 'common', bonus: 3, t: ['de'], value: 1.4e6,
    img: 'img/cars/c_polo_v52.webp', credit: 'LuvsMG481 · CC BY-SA 4.0' },
  { id: 'c_jolion', cat: 'car', name: 'Haval Jolion', icon: '🚙', rarity: 'common', bonus: 4, t: ['cn'], value: 2.2e6,
    img: 'img/cars/c_jolion_v52.webp', credit: 'Throwawayacc222 · CC0' },
  { id: 'c_octavia', cat: 'car', name: 'Skoda Octavia', icon: '🚘', rarity: 'rare', bonus: 8, t: ['de'], value: 3e6,
    img: 'img/cars/c_octavia_v52.webp', credit: 'LuvsMG481 · CC BY-SA 4.0' },
  { id: 'c_tiggo', cat: 'car', name: 'Chery Tiggo 7 Pro', icon: '🚙', rarity: 'rare', bonus: 8, t: ['cn'], value: 2.8e6,
    img: 'img/cars/c_tiggo_v52.webp', credit: 'Throwawayacc222 · CC0' },
  { id: 'c_mazda6', cat: 'car', name: 'Mazda 6', icon: '🚘', rarity: 'rare', bonus: 8, t: ['jp'], value: 3.5e6,
    img: 'img/cars/c_mazda6_v52.webp', credit: 'MercurySable99 · CC BY-SA 4.0' },
  { id: 'c_xtrail', cat: 'car', name: 'Nissan X-Trail', icon: '🚙', rarity: 'rare', bonus: 8, t: ['jp'], value: 3.6e6,
    img: 'img/cars/c_xtrail_v52.webp', credit: 'LuvsMG481 · CC BY-SA 4.0' },
  { id: 'c_rav4', cat: 'car', name: 'Toyota RAV4', icon: '🚙', rarity: 'rare', bonus: 9, t: ['jp'], value: 4.2e6,
    img: 'img/cars/c_rav4_v52.webp', credit: 'Jason Lawrence from New York · CC BY 2.0' },
  { id: 'c_monjaro', cat: 'car', name: 'Geely Monjaro', icon: '🚙', rarity: 'rare', bonus: 10, t: ['cn'], value: 4.6e6,
    img: 'img/cars/c_monjaro_v52.webp', credit: 'User3204 · CC BY-SA 4.0' },
  { id: 'c_lc300', cat: 'car', name: 'Toyota Land Cruiser 300', icon: '🚙', rarity: 'epic', bonus: 16, t: ['jp'], value: 13e6,
    img: 'img/cars/c_lc300_v52.webp', credit: 'Авто Плюс Новости · CC BY 3.0' },
  { id: 'c_x5', cat: 'car', name: 'BMW X5', icon: '🚙', rarity: 'epic', bonus: 16, t: ['de'], value: 14e6,
    img: 'img/cars/c_x5_v52.webp', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_cayenne', cat: 'car', name: 'Porsche Cayenne', icon: '🚙', rarity: 'epic', bonus: 17, t: ['de'], value: 15e6,
    img: 'img/cars/c_cayenne_v52.webp', credit: 'Kevauto · CC BY-SA 4.0' },
  { id: 'c_gtr', cat: 'car', name: 'Nissan GT-R', icon: '🏎️', rarity: 'epic', bonus: 17, t: ['jp', 'sc'], value: 16e6,
    img: 'img/cars/c_gtr_v52.webp', credit: 'Tokumeigakarinoaoshima · CC BY-SA 4.0' },
  { id: 'c_sclass', cat: 'car', name: 'Mercedes-Benz S-класс', icon: '🚘', rarity: 'epic', bonus: 18, t: ['de'], value: 20e6,
    img: 'img/cars/c_sclass_v52.webp', credit: 'Alexander-93 · CC BY-SA 4.0' },
  // Только служебная — генералу (svc: true — не выпадает из кейсов и не считается в коллекции)
  { id: 'c_aurus', cat: 'car', name: 'Aurus Senat', icon: '🚘', rarity: 'mythic', bonus: 40, t: ['ru'], value: 60e6, svc: true,
    img: 'img/cars/c_aurus_v52.webp' },
  { id: 'c_maybach', cat: 'car', name: 'Mercedes S 600 Pullman Guard', icon: '🚘', rarity: 'mythic', bonus: 40, t: ['de'], value: 45e6, svc: true,
    img: 'img/cars/c_maybach_v52.webp' },
  { id: 'c_arsenal', cat: 'car', name: 'Aurus Arsenal', icon: '🚐', rarity: 'legendary', bonus: 30, t: ['ru'], value: 35e6, svc: true,
    img: 'img/cars/c_arsenal_v52.webp' },
  { id: 'c_bmw7', cat: 'car', name: 'BMW 7 серии', icon: '🚘', rarity: 'epic', bonus: 17, t: ['de'], value: 14e6, svc: true,
    img: 'img/cars/c_bmw7_v52.webp' },
  { id: 'c_komendant', cat: 'car', name: 'Aurus Komendant', icon: '🚙', rarity: 'mythic', bonus: 40, t: ['ru'], value: 55e6, svc: true,
    img: 'img/cars/c_komendant_v52.webp' },
  { id: 'c_lx', cat: 'car', name: 'Lexus LX 600', icon: '🚙', rarity: 'epic', bonus: 18, t: ['jp'], value: 22e6,
    img: 'img/cars/c_lx_v52.webp', credit: 'Ethan Llamas · CC BY-SA 4.0' },
  { id: 'c_bentley', cat: 'car', name: 'Bentley Continental GT', icon: '🏎️', rarity: 'legendary', bonus: 32, value: 33e6,
    img: 'img/cars/c_bentley_v52.webp', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_mclaren', cat: 'car', name: 'McLaren 720S', icon: '🏎️', rarity: 'legendary', bonus: 34, t: ['sc'], value: 36e6,
    img: 'img/cars/c_mclaren_v52.webp', credit: 'LuvsMG481 · CC BY-SA 4.0' },
  { id: 'c_ferrari', cat: 'car', name: 'Ferrari 296 GTB', icon: '🏎️', rarity: 'legendary', bonus: 35, t: ['sc'], value: 38e6,
    img: 'img/cars/c_ferrari_v52.webp', credit: 'Alexander Migl · CC BY-SA 4.0' },
  { id: 'c_aventador', cat: 'car', name: 'Lamborghini Aventador', icon: '🏎️', rarity: 'mythic', bonus: 56, t: ['sc'], value: 60e6,
    img: 'img/cars/c_aventador_v52.webp', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_phantom', cat: 'car', name: 'Rolls-Royce Phantom', icon: '🚘', rarity: 'mythic', bonus: 57, value: 65e6,
    img: 'img/cars/c_phantom_v52.webp', credit: 'Alexander Migl · CC BY-SA 4.0' },
  { id: 'c_huayra', cat: 'car', name: 'Pagani Huayra', icon: '🏎️', rarity: 'mythic', bonus: 60, t: ['sc'], value: 300e6,
    img: 'img/cars/c_huayra_v53.webp', credit: 'Mr.choppers · CC BY-SA 3.0' },
  { id: 'c_jesko', cat: 'car', name: 'Koenigsegg Jesko', icon: '🏎️', rarity: 'mythic', bonus: 60, t: ['sc'], value: 320e6,
    img: 'img/cars/c_jesko_v52.webp', credit: 'Mr.choppers · CC BY-SA 3.0' },
  // Совсем дешёвые — для «Гаража деда» (кейс за 50 тыс)
  { id: 'c_zaz', cat: 'car', name: 'ЗАЗ-968 «Запорожец»', icon: '🚗', rarity: 'common', bonus: 1, t: ['ru'], value: 40e3,
    img: 'img/cars/c_zaz_v52.webp', credit: 'burts · CC BY-SA 3.0' },
  { id: 'c_oka', cat: 'car', name: 'ВАЗ-1111 «Ока»', icon: '🚗', rarity: 'common', bonus: 1, t: ['ru'], value: 50e3,
    img: 'img/cars/c_oka_v52.webp', credit: 'Throwawayacc222 · CC0' },
  { id: 'c_izh', cat: 'car', name: 'ИЖ-2715 «Каблучок»', icon: '🚐', rarity: 'common', bonus: 1, t: ['ru'], value: 55e3,
    img: 'img/cars/c_izh_v52.webp', credit: 'Артём_00 · CC BY 4.0' },
  { id: 'c_2101', cat: 'car', name: 'ВАЗ-2101 «Копейка»', icon: '🚗', rarity: 'common', bonus: 1, t: ['ru'], value: 65e3,
    img: 'img/cars/c_2101_v52.webp', credit: '(G)jabz · CC BY 4.0' },
  { id: 'c_moskvich', cat: 'car', name: 'Москвич-412', icon: '🚗', rarity: 'common', bonus: 2, t: ['ru'], value: 100e3,
    img: 'img/cars/c_moskvich_v52.webp', credit: 'Alexander Migl · CC BY-SA 4.0' },
  { id: 'c_focus', cat: 'car', name: 'Ford Focus', icon: '🚗', rarity: 'common', bonus: 3, value: 900e3,
    img: 'img/cars/c_focus_v52.webp', credit: 'Elise240SX · CC BY-SA 4.0' },
  { id: 'c_largus', cat: 'car', name: 'Lada Largus', icon: '🚙', rarity: 'common', bonus: 3, t: ['ru'], value: 1.3e6,
    img: 'img/cars/c_largus_v52.webp', credit: 'Throwawayacc222 · CC0' },
  { id: 'c_uaz', cat: 'car', name: 'УАЗ Патриот (списанный из полиции)', icon: '🚙', rarity: 'common', bonus: 4, t: ['ru'], value: 1.8e6,
    img: 'img/cars/c_uaz_v52.webp', credit: 'Throwawayacc222 · CC0' },
  { id: 'c_corolla', cat: 'car', name: 'Toyota Corolla', icon: '🚘', rarity: 'rare', bonus: 7, t: ['jp'], value: 2.6e6,
    img: 'img/cars/c_corolla_v52.webp', credit: 'LuvsMG481 · CC BY-SA 4.0' },
  { id: 'c_passat', cat: 'car', name: 'Volkswagen Passat', icon: '🚘', rarity: 'rare', bonus: 8, t: ['de'], value: 3.3e6,
    img: 'img/cars/c_passat_v52.webp', credit: 'Acgskup · CC BY 4.0' },
  { id: 'c_a4', cat: 'car', name: 'Audi A4', icon: '🚘', rarity: 'rare', bonus: 9, t: ['de'], value: 4e6,
    img: 'img/cars/c_a4_v52.webp', credit: 'Acgskup · CC BY 4.0' },
  { id: 'c_prado', cat: 'car', name: 'Toyota Land Cruiser Prado', icon: '🚙', rarity: 'epic', bonus: 14, t: ['jp'], value: 8.5e6,
    img: 'img/cars/c_prado_v52.webp', credit: 'Self-Proclaimed-Car-Enthusiast · CC BY-SA 4.0' },
  { id: 'c_m3', cat: 'car', name: 'BMW M3', icon: '🏎️', rarity: 'epic', bonus: 16, t: ['de'], value: 12e6,
    img: 'img/cars/c_m3_v52.webp', credit: 'Tokumeigakarinoaoshima · CC BY-SA 4.0' },
  { id: 'c_tesla', cat: 'car', name: 'Tesla Model S Plaid', icon: '🚘', rarity: 'epic', bonus: 16, value: 13e6,
    img: 'img/cars/c_tesla_v52.webp', credit: 'Alexander-93 · CC BY-SA 4.0' },
  { id: 'c_range', cat: 'car', name: 'Range Rover', icon: '🚙', rarity: 'epic', bonus: 18, value: 19e6,
    img: 'img/cars/c_range_v52.webp', credit: 'Ethan Llamas · CC BY-SA 4.0' },
  { id: 'c_amggt', cat: 'car', name: 'Mercedes-AMG GT', icon: '🏎️', rarity: 'legendary', bonus: 30, t: ['de'], value: 25e6,
    img: 'img/cars/c_amggt_v52.webp', credit: 'Alexander Migl · CC BY-SA 4.0' },
  { id: 'c_db11', cat: 'car', name: 'Aston Martin DB11', icon: '🏎️', rarity: 'legendary', bonus: 32, value: 30e6,
    img: 'img/cars/c_db11_v52.webp', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_nevera', cat: 'car', name: 'Rimac Nevera', icon: '🏎️', rarity: 'mythic', bonus: 60, value: 220e6,
    img: 'img/cars/c_nevera_v52.webp', credit: 'Mr.choppers · CC BY-SA 3.0' },
  { id: 'c_laferrari', cat: 'car', name: 'LaFerrari', icon: '🏎️', rarity: 'mythic', bonus: 58, value: 300e6,
    img: 'img/cars/c_laferrari_v52.webp', credit: 'Axion23 · CC BY 2.0' },
  // v51: средний класс — культовые и интересные машины
  { id: 'c_leaf', cat: 'car', name: 'Nissan Leaf', icon: '🚗', rarity: 'common', bonus: 4, t: ['jp'], value: 1.3e6, img: 'img/cars/c_leaf_v52.webp', credit: 'Nissan Leaf ZE1 2018: Reinhard Müller de · CC BY-SA 4.0' },
  { id: 'c_lancerx', cat: 'car', name: 'Mitsubishi Lancer X', icon: '🚗', rarity: 'common', bonus: 3, t: ['jp'], value: 1.1e6, img: 'img/cars/c_lancerx_v52.webp', credit: 'Acgskup · CC BY 4.0' },
  { id: 'c_volga', cat: 'car', name: 'ГАЗ-24 «Волга»', icon: '🚗', rarity: 'rare', bonus: 3, t: ['ru'], value: 900e3, img: 'img/cars/c_volga_v52.webp', credit: 'Avjoska · CC BY-SA 3.0' },
  { id: 'c_markii', cat: 'car', name: 'Toyota Mark II JZX100', icon: '🚘', rarity: 'rare', bonus: 7, t: ['jp'], value: 2.2e6, img: 'img/cars/c_markii_v52.webp', credit: 'Tokumeigakarinoaoshima · CC0' },
  { id: 'c_ae86', cat: 'car', name: 'Toyota AE86', icon: '🚗', rarity: 'rare', bonus: 7, t: ['jp'], value: 2.4e6, img: 'img/cars/c_ae86_v52.webp', credit: 'Tokumeigakarinoaoshima · CC BY-SA 4.0' },
  { id: 'c_350z', cat: 'car', name: 'Nissan 350Z', icon: '🏎️', rarity: 'rare', bonus: 8, t: ['jp'], value: 2.8e6, img: 'img/cars/c_350z_v52.webp', credit: 'Rudolf Stricker · CC BY-SA 3.0' },
  { id: 'c_mini', cat: 'car', name: 'Mini Cooper', icon: '🚗', rarity: 'rare', bonus: 8, value: 3e6, img: 'img/cars/c_mini_v52.webp', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_wrx', cat: 'car', name: 'Subaru WRX', icon: '🚘', rarity: 'rare', bonus: 9, t: ['jp'], value: 3.6e6, img: 'img/cars/c_wrx_v52.webp', credit: 'DestinationFearFan · CC BY-SA 4.0' },
  { id: 'c_stinger', cat: 'car', name: 'Kia Stinger GT', icon: '🚘', rarity: 'rare', bonus: 10, value: 4.2e6, img: 'img/cars/c_stinger_v52.webp', credit: 'MercurySable99 · CC BY-SA 4.0' },
  { id: 'c_civic', cat: 'car', name: 'Honda Civic Type R', icon: '🏎️', rarity: 'rare', bonus: 10, t: ['jp'], value: 4.4e6, img: 'img/cars/c_civic_v52.webp', credit: 'MercurySable99 · CC BY-SA 4.0' },
  { id: 'c_model3', cat: 'car', name: 'Tesla Model 3', icon: '🚘', rarity: 'rare', bonus: 10, value: 4.8e6, img: 'img/cars/c_model3_v52.webp', credit: 'Elise240SX · CC BY-SA 4.0' },
  { id: 'c_rx7', cat: 'car', name: 'Mazda RX-7', icon: '🏎️', rarity: 'epic', bonus: 13, t: ['jp'], value: 6e6, img: 'img/cars/c_rx7_v52.webp', credit: 'Mr.choppers · CC BY-SA 3.0' },
  { id: 'c_impala', cat: 'car', name: 'Chevrolet Impala 1964', icon: '🚘', rarity: 'epic', bonus: 13, value: 6.5e6, img: 'img/cars/c_impala_v52.webp', credit: 'MercurySable99 · CC BY-SA 4.0' },
  { id: 'c_mustang', cat: 'car', name: 'Ford Mustang GT', icon: '🏎️', rarity: 'epic', bonus: 14, value: 7e6, img: 'img/cars/c_mustang_v52.webp', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_wrangler', cat: 'car', name: 'Jeep Wrangler', icon: '🚙', rarity: 'epic', bonus: 14, value: 7.5e6, img: 'img/cars/c_wrangler_v52.webp', credit: 'Kevauto · CC BY-SA 4.0' },
  { id: 'c_supra', cat: 'car', name: 'Toyota Supra A80', icon: '🏎️', rarity: 'epic', bonus: 15, t: ['jp'], value: 9e6, img: 'img/cars/c_supra_v52.webp', credit: 'Tokumeigakarinoaoshima · CC0' },
  { id: 'c_corvette', cat: 'car', name: 'Chevrolet Corvette C8', icon: '🏎️', rarity: 'epic', bonus: 16, value: 12e6, img: 'img/cars/c_corvette_v52.webp', credit: 'DestinationFearFan · CC BY-SA 4.0' },
  { id: 'c_skyline', cat: 'car', name: 'Nissan Skyline GT-R R34', icon: '🏎️', rarity: 'legendary', bonus: 30, t: ['jp'], value: 24e6, img: 'img/cars/c_skyline_v52.webp', credit: 'Charles from Port Chester, New York · CC BY 2.0' },
  { id: 'h_garage', cat: 'home', name: 'Гараж',                    icon: '🅿️', rarity: 'common',    bonus: 3e3,  value: 600e3,
    img: 'img/homes/h_garage.jpg', credit: 'Celest · CC BY 4.0' },
  { id: 'h_bed',    cat: 'home', name: 'Койка в общаге',           icon: '🛏️', rarity: 'common',    bonus: 3.8e3,  value: 400e3,
    img: 'img/homes/h_bed.jpg', credit: 'Sgroey · CC BY 4.0' },
  { id: 'h_room',   cat: 'home', name: 'Комната в коммуналке',     icon: '🚪', rarity: 'common',    bonus: 11e3, t: ['msk'], value: 2.5e6,
    img: 'img/homes/h_room.jpg', credit: 'Corey Taratuta · CC BY 2.0' },
  { id: 'h_studio', cat: 'home', name: 'Студия',                   icon: '🏢', rarity: 'rare',      bonus: 30e3, t: ['msk'], value: 7e6,
    img: 'img/homes/h_studio.jpg', credit: 'Lo · CC0' },
  { id: 'h_flat',   cat: 'home', name: 'Однушка в спальнике',      icon: '🏬', rarity: 'rare',      bonus: 34e3, t: ['msk'], value: 9e6,
    img: 'img/homes/h_flat.jpg', credit: '3dfxVoodoo3 · CC BY-SA 4.0' },
  { id: 'h_house',  cat: 'home', name: 'Загородный дом',           icon: '🏡', rarity: 'epic',      bonus: 68e3,  t: ['country'], value: 18e6,
    img: 'img/homes/h_house.jpg', credit: 'Stoljaroff · Public domain' },
  { id: 'h_town',   cat: 'home', name: 'Таунхаус',                 icon: '🏘️', rarity: 'epic',      bonus: 90e3, t: ['country'], value: 25e6,
    img: 'img/homes/h_town.jpg', credit: 'Aplomado · CC BY-SA 3.0' },
  { id: 'h_city',   cat: 'home', name: 'Апартаменты в Москва-Сити', icon: '🏙️', rarity: 'legendary', bonus: 450e3, t: ['msk'], value: 120e6,
    img: 'img/homes/h_city.jpg', credit: 'Pasquale Paolo Cardo · CC BY 2.0' },
  { id: 'h_pent',   cat: 'home', name: 'Пентхаус',                 icon: '🌆', rarity: 'legendary', bonus: 520e3, t: ['msk'], value: 150e6,
    img: 'img/homes/h_pent.jpg', credit: 'Hu Totya · CC BY 3.0' },
  { id: 'h_hotel',  cat: 'home', name: 'Мини-отель',               icon: '🏨', rarity: 'legendary', bonus: 1.1e6, value: 200e6,
    img: 'img/homes/h_hotel.jpg', credit: 'denisbin · CC BY-SA 2.0' },
  { id: 'h_castle', cat: 'home', name: 'Замок',                    icon: '🏰', rarity: 'mythic',    bonus: 4.5e6,  t: ['abroad'], value: 1.5e9,
    img: 'img/homes/h_castle.jpg', credit: 'Thomas Wolf, www.foto-tw.de · CC BY-SA 3.0 de' },
  { id: 'h_island', cat: 'home', name: 'Частный остров',           icon: '🏝️', rarity: 'mythic',    bonus: 7.5e6, t: ['abroad'], value: 2.5e9,
    img: 'img/homes/h_island.jpg', credit: 'Matheenfaiz · CC BY-SA 4.0' },

  { id: 'h_dacha', cat: 'home', name: 'Дача в СНТ', icon: '🏡', rarity: 'common', bonus: 4.5e3, t: ['country'], value: 1.2e6,
    img: 'img/homes/h_dacha.jpg', credit: 'Figure · CC BY-SA 3.0' },
  { id: 'h_village', cat: 'home', name: 'Дом в деревне', icon: '🛖', rarity: 'common', bonus: 6e3, t: ['country'], value: 1.8e6,
    img: 'img/homes/h_village.jpg', credit: 'A.Savin · FAL' },
  { id: 'h_batumi', cat: 'home', name: 'Квартира в Батуми', icon: '🏙️', rarity: 'common', bonus: 19e3, t: ['abroad'], value: 5e6,
    img: 'img/homes/h_batumi.jpg', credit: 'U.S. Navy · Public domain' },
  { id: 'h_alanya', cat: 'home', name: 'Квартира в Алании', icon: '🏖️', rarity: 'rare', bonus: 34e3, t: ['abroad'], value: 9e6,
    img: 'img/homes/h_alanya.jpg', credit: 'Ozgurmulazimoglu · CC BY-SA 3.0' },
  { id: 'h_sochi', cat: 'home', name: 'Квартира в Сочи', icon: '🌴', rarity: 'rare', bonus: 45e3, value: 12e6,
    img: 'img/homes/h_sochi.jpg', credit: 'Trace · CC BY-SA 4.0' },
  { id: 'h_newflat', cat: 'home', name: 'Двушка в новостройке', icon: '🏢', rarity: 'rare', bonus: 49e3, t: ['msk'], value: 14e6,
    img: 'img/homes/h_newflat.jpg', credit: 'R Sones · CC BY-SA 2.0' },
  { id: 'h_cottage', cat: 'home', name: 'Коттедж в английской деревне', icon: '🏡', rarity: 'epic', bonus: 110e3, t: ['abroad', 'country'], value: 40e6,
    img: 'img/homes/h_cottage.jpg', credit: 'Philip Halling · CC BY-SA 2.0' },
  { id: 'h_dubai_apt', cat: 'home', name: 'Апартаменты в Дубай Марине', icon: '🌇', rarity: 'epic', bonus: 170e3, t: ['abroad'], value: 40e6,
    img: 'img/homes/h_dubai_apt.jpg', credit: 'Norlando Pobre · CC BY 2.0' },
  { id: 'h_patriki', cat: 'home', name: 'Квартира на Патриарших', icon: '🏛️', rarity: 'epic', bonus: 160e3, t: ['msk'], value: 45e6,
    img: 'img/homes/h_patriki.jpg', credit: 'A.Savin · FAL' },
  { id: 'h_palm', cat: 'home', name: 'Вилла на Пальме Джумейра', icon: '🌴', rarity: 'legendary', bonus: 980e3, t: ['abroad'], value: 250e6,
    img: 'img/homes/h_palm.jpg', credit: 'NASA, экипаж МКС-22 · Public domain' },
  { id: 'h_london', cat: 'home', name: 'Квартира в Мейфэре, Лондон', icon: '🎡', rarity: 'legendary', bonus: 1.1e6, t: ['abroad'], value: 300e6,
    img: 'img/homes/h_london.jpg', credit: 'Millennium Hotel London Mayfair · Public domain' },
  { id: 'h_rublyovka', cat: 'home', name: 'Особняк на Рублёвке', icon: '🏰', rarity: 'legendary', bonus: 1.4e6, t: ['country'], value: 400e6,
    img: 'img/homes/h_rublyovka.jpg', credit: 'A.Savin · CC BY-SA 3.0' },
  { id: 'h_riviera', cat: 'home', name: 'Вилла на Лазурном берегу', icon: '⛵', rarity: 'mythic', bonus: 6.8e6, t: ['abroad'], value: 2e9,
    img: 'img/homes/h_riviera.jpg', credit: 'Tangopaso · Public domain' },
  { id: 'h_monaco', cat: 'home', name: 'Пентхаус в Монако', icon: '🎰', rarity: 'mythic', bonus: 9e6, t: ['abroad'], value: 3e9,
    img: 'img/homes/h_monaco.jpg', credit: 'Tobi 87 · CC BY-SA 3.0' },

  { id: 'h_brezh', cat: 'home', name: 'Брежневка в регионе', icon: '🏢', rarity: 'common', bonus: 9e3, value: 2.2e6,
    img: 'img/homes/h_brezh.jpg', credit: 'Jelger Groeneveld · CC BY 2.0' },
  { id: 'h_kazan', cat: 'home', name: 'Квартира в Казани', icon: '🕌', rarity: 'rare', bonus: 30e3, value: 8e6,
    img: 'img/homes/h_kazan.jpg', credit: 'Vitaly Ilyin · CC BY-SA 4.0' },
  { id: 'h_spb', cat: 'home', name: 'Квартира в Петербурге', icon: '🌉', rarity: 'rare', bonus: 41e3, value: 11e6,
    img: 'img/homes/h_spb.jpg', credit: 'A.Savin · FAL' },
  { id: 'h_loft', cat: 'home', name: 'Лофт в центре', icon: '🏭', rarity: 'rare', bonus: 49e3, value: 13e6,
    img: 'img/homes/h_loft.jpg', credit: 'Jennifer D. Ames · CC BY-SA 3.0' },
  { id: 'h_polyana', cat: 'home', name: 'Шале в Красной Поляне', icon: '🏔️', rarity: 'epic', bonus: 110e3, value: 30e6,
    img: 'img/homes/h_polyana.jpg', credit: 'Sergei Kazantsev · CC BY-SA 4.0' },
  { id: 'h_chalet', cat: 'home', name: 'Шале в Альпах', icon: '🏔️', rarity: 'epic', bonus: 140e3, value: 38e6,
    img: 'img/homes/h_chalet.jpg', credit: 'Leemburg-CH · CC BY-SA 4.0' },
  { id: 'h_tuscany', cat: 'home', name: 'Вилла в Тоскане', icon: '🌳', rarity: 'legendary', bonus: 680e3, value: 180e6,
    img: 'img/homes/h_tuscany.jpg', credit: 'Anton Sulsky · CC BY 2.0' },
  { id: 'h_ny', cat: 'home', name: 'Пентхаус на Манхэттене', icon: '🗽', rarity: 'legendary', bonus: 1.3e6, value: 350e6,
    img: 'img/homes/h_ny.jpg', credit: 'Gryffindor · CC BY-SA 3.0' },
  { id: 'h_tower', cat: 'home', name: 'Собственный небоскрёб', icon: '🏙️', rarity: 'mythic', bonus: 19e6, value: 5e9,
    img: 'img/homes/h_tower.jpg', credit: 'Anton Galakhov · CC BY-SA 4.0' },

  // Связи: cat conn, perk — что даёт (см. PERKS), lv — сила по уровню доверия 1–5,
  // special — особая услуга на максимальном доверии (см. SPECIALS)
  { id: 'k_police',   cat: 'conn', name: 'Участковый Петрович',     icon: '👮',   rarity: 'common',    perk: 'fineCut',    lv: [20, 30, 40, 50, 60], special: { type: 'closeEvent' } },
  { id: 'k_gibdd',    cat: 'conn', name: 'Инспектор ГИБДД',         icon: '🚓',   rarity: 'common',    perk: 'gibdd',      lv: [1, 1, 1, 1, 1], special: { type: 'ticket', case: 'car_used' } },
  { id: 'k_zhkh',     cat: 'conn', name: 'Начальница ЖКХ',          icon: '🧹',   rarity: 'common',    perk: 'rentUp',     lv: [3, 5, 7, 9, 12], special: { type: 'ticket', case: 'home_dorm' } },
  { id: 'k_tax',      cat: 'conn', name: 'Налоговый инспектор',     icon: '🧾',   rarity: 'rare',      perk: 'taxCut',     lv: [2, 3, 4, 5, 7], special: { type: 'taxHoliday', hours: 24 } },
  { id: 'k_official', cat: 'conn', name: 'Чиновник мэрии',          icon: '🏛️',   rarity: 'rare',      perk: 'license',    lv: [20, 30, 40, 55, 70], special: { type: 'cash', hours: 6 } },
  { id: 'k_banker',   cat: 'conn', name: 'Банкир',                  icon: '🏦',   rarity: 'rare',      perk: 'sellUp',     lv: [3, 4, 6, 8, 10], special: { type: 'cash', hours: 8 } },
  { id: 'k_prosecutor', cat: 'conn', name: 'Прокурор',              icon: '⚖️',   rarity: 'epic',      perk: 'safe',       lv: [20, 35, 50, 75, 100], special: { type: 'closeEvent' } },
  { id: 'k_judge',    cat: 'conn', name: 'Судья',                   icon: '👨‍⚖️', rarity: 'epic',      perk: 'court',      lv: [1, 1, 1, 1, 1], special: { type: 'closeEvent' } },
  { id: 'k_deputy',   cat: 'conn', name: 'Депутат',                 icon: '🎩',   rarity: 'legendary', perk: 'demandUp',   lv: [5, 8, 11, 15, 20], special: { type: 'tender', hours: 20 } },
  { id: 'k_governor', cat: 'conn', name: 'Губернатор',              icon: '🏢',   rarity: 'legendary', perk: 'licenseCut', lv: [30, 45, 60, 75, 90], special: { type: 'tender', hours: 20 } },
  { id: 'k_oligarch', cat: 'conn', name: 'Олигарх',                 icon: '💼',   rarity: 'mythic',    perk: 'deal',       lv: [20, 25, 30, 40, 50], special: { type: 'cash', hours: 36 } },
  { id: 'k_minister', cat: 'conn', name: 'Министр экономики',       icon: '🕴️',   rarity: 'mythic',    perk: 'bizBoost',   lv: [10, 13, 16, 20, 25], special: { type: 'tender', hours: 40 } },
];

// Шансы редкостей в процентах; выпадают только редкости, которые есть в списке предметов кейса
const W_CHEAP = { common: 85, rare: 15, epic: 0,  legendary: 0,  mythic: 0 };
const W_MID   = { common: 0,  rare: 75, epic: 25, legendary: 0,  mythic: 0 };

// Каждый кейс — свой список предметов (items). Дешёвые кейсы не содержат дорогих вещей,
// поэтому случайно разбогатеть в начале нельзя: мифические вещи бывают только в дорогих кейсах.
// tier: cheap / mid / elite — раздел на экране; theme: true — тематический (показывается скромнее).
// price: 'auto' — цена = AUTO_PRICE_RATE от средней рыночной стоимости выпадающего (считается при запуске),
// поэтому держать выпавшее выгодно, а сразу продавать (за 70%) в среднем убыточно.
const AUTO_PRICE_RATE = 0.95;
const CASES = [
  { id: 'free', cover: 'img/cases/free_v52.jpg', name: 'Ежедневный', icon: '🎁', price: 0, cooldown: 24 * 3600e3, tier: 'free',
    desc: 'Раз в сутки: недорогая машина или жильё', w: W_CHEAP,
    items: ['c_logan', 'c_granta', 'c_focus', 'c_lancerx', 'c_leaf', 'h_bed', 'h_garage', 'h_dacha', 'h_village', 'h_room', 'c_corolla'] },

  { id: 'car_grandpa', cover: 'img/cases/car_grandpa_v52.jpg', name: 'Гараж деда', icon: '🔧', price: 'auto', tier: 'cheap',
    desc: 'Советская классика: Запорожец, «копейка», Москвич — и шанс на «Волгу»', w: { common: 95, rare: 5, epic: 0, legendary: 0, mythic: 0 },
    items: ['c_zaz', 'c_oka', 'c_izh', 'c_2101', 'c_moskvich', 'c_2107', 'c_2109', 'c_volga'] },
  { id: 'car_people', cover: 'img/cases/car_people_v52.jpg', name: 'Народные иномарки', icon: '🚗', price: 'auto', tier: 'cheap',
    desc: 'Logan, Solaris, Polo, Rio, Leaf, Lancer — и иногда что-то солиднее', w: { common: 89, rare: 9.8, epic: 1.2, legendary: 0, mythic: 0 },
    items: ['c_logan', 'c_solaris', 'c_polo', 'c_rio', 'c_leaf', 'c_lancerx', 'c_corolla', 'c_octavia', 'c_k5', 'c_eclass', 'c_prado'] },
  { id: 'car_used', cover: 'img/cases/car_used_v52.jpg', name: 'Авторынок и гаражи', icon: '🚗', price: 'auto', tier: 'cheap',
    desc: 'Лады и подержанные иномарки, а в дальнем боксе — «Волга», Mark II, Impala или даже Supra', w: { common: 85, rare: 14, epic: 1, legendary: 0, mythic: 0 },
    items: ['c_granta', 'c_vesta', 'c_largus', 'c_focus', 'c_volga', 'c_markii', 'c_ae86', 'c_mazda6', 'c_passat', 'c_350z', 'c_mini', 'c_impala', 'c_rx7', 'c_supra'] },
  { id: 'car_new', cover: 'img/cases/car_new_v52.jpg', name: 'Автосалон', icon: '🚘', price: 'auto', tier: 'mid',
    desc: 'Новые машины на любой вкус: седаны, кроссоверы, хот-хэтчи и маслкары — и шанс на 911 или Skyline', w: { common: 0, rare: 72, epic: 26.5, legendary: 1.5, mythic: 0 },
    items: ['c_camry', 'c_k5', 'c_rav4', 'c_tiguan', 'c_model3', 'c_stinger', 'c_wrx', 'c_civic', 'c_mustang', 'c_wrangler', 'c_m3', 'c_corvette', 'c_prado', 'c_911', 'c_skyline'] },
  { id: 'car_biz', cover: 'img/cases/car_biz_v52.jpg', name: 'Бизнес-класс', icon: '💼', price: 'auto', tier: 'mid',
    desc: 'Солидные седаны и внедорожники для делового человека', w: { common: 0, rare: 44, epic: 54, legendary: 2, mythic: 0 },
    items: ['c_a4', 'c_passat', 'c_mazda6', 'c_eclass', 'c_x5', 'c_lc300', 'c_tesla', 'c_range', 'c_g63'] },
  { id: 'car_sport', cover: 'img/cases/car_sport_v52.jpg', name: 'Спорт и премиум', icon: '🏁', price: 'auto', tier: 'mid',
    desc: 'Только эпические и выше: M5, RS6, GT-R, Corvette — шанс на 911 и Aventador', w: { common: 0, rare: 0, epic: 93, legendary: 6, mythic: 1 },
    items: ['c_m5', 'c_rs6', 'c_gtr', 'c_corvette', 'c_m3', 'c_cayenne', 'c_911', 'c_amggt', 'c_db11', 'c_skyline', 'c_aventador'] },
  { id: 'car_premium', cover: 'img/cases/car_premium_v53.jpg', name: 'Премиум-салон', icon: '💼', price: 'auto', tier: 'elite',
    desc: 'S-класс, LX, Range Rover, Гелик — шанс на Lamborghini Aventador', w: { common: 0, rare: 0, epic: 79.3, legendary: 20, mythic: 0.7 },
    items: ['c_sclass', 'c_lx', 'c_range', 'c_cayenne', 'c_m5', 'c_g63', 'c_bentley', 'c_urus', 'c_aventador'] },
  { id: 'car_elite', cover: 'img/cases/car_elite_v52.jpg', name: 'Элитный автосалон Дубая', icon: '🏎️', price: 'auto', tier: 'elite',
    desc: 'Спорткары и редкие роскошные машины', w: { common: 0, rare: 0, epic: 0, legendary: 85, mythic: 15 },
    items: ['c_mclaren', 'c_ferrari', 'c_urus', 'c_bentley', 'c_db11', 'c_amggt', 'c_aventador', 'c_phantom', 'c_cullinan'] },
  { id: 'car_hyper', cover: 'img/cases/car_hyper_v52.jpg', name: 'Гиперкары', icon: '🏁', price: 'auto', tier: 'elite',
    desc: 'Только здесь: Bugatti, Pagani, Koenigsegg', w: { common: 0, rare: 0, epic: 0, legendary: 55, mythic: 45 },
    items: ['c_mclaren', 'c_ferrari', 'c_urus', 'c_aventador', 'c_huayra', 'c_jesko', 'c_chiron', 'c_laferrari', 'c_nevera'] },
  { id: 'car_suv', cover: 'img/cases/car_suv_v52.jpg', name: 'Джипы и внедорожники', icon: '🚙', price: 'auto', tier: 'mid', theme: true,
    desc: 'Нива, УАЗ, Haval, Chery — и шанс на Wrangler, Land Cruiser или Гелик', w: { common: 55, rare: 35, epic: 9.5, legendary: 0.5, mythic: 0 },
    items: ['c_niva', 'c_uaz', 'c_jolion', 'c_tiggo', 'c_xtrail', 'c_monjaro', 'c_rav4', 'c_prado', 'c_wrangler', 'c_lc300', 'c_g63'] },
  { id: 'car_cn', cover: 'img/cases/car_cn_v52.jpg', name: 'Китайцы', icon: '🇨🇳', price: 'auto', tier: 'cheap', theme: true,
    desc: 'Haval, Chery, Geely', w: { common: 55, rare: 45, epic: 0, legendary: 0, mythic: 0 }, items: ['c_jolion', 'c_tiggo', 'c_monjaro'] },
  { id: 'car_jp', cover: 'img/cases/car_jp_v52.jpg', name: 'Японцы', icon: '🇯🇵', price: 'auto', tier: 'mid', theme: true,
    desc: 'Toyota, Nissan, Mazda, Subaru, Honda, Lexus', w: { common: 0, rare: 63, epic: 35, legendary: 2, mythic: 0 },
    items: ['c_mazda6', 'c_xtrail', 'c_camry', 'c_rav4', 'c_corolla', 'c_markii', 'c_wrx', 'c_civic', 'c_lc300', 'c_gtr', 'c_lx', 'c_prado', 'c_supra', 'c_rx7', 'c_skyline'] },
  { id: 'car_de', cover: 'img/cases/car_de_v52.jpg', name: 'Немецкое качество', icon: '🇩🇪', price: 'auto', tier: 'mid', theme: true,
    desc: 'VW, Skoda, BMW, Mercedes, Audi, Porsche', w: { common: 0, rare: 55, epic: 42, legendary: 3, mythic: 0 },
    items: ['c_octavia', 'c_tiguan', 'c_eclass', 'c_x5', 'c_cayenne', 'c_m5', 'c_rs6', 'c_sclass', 'c_911', 'c_g63', 'c_passat', 'c_a4', 'c_m3', 'c_amggt'] },

  { id: 'home_dorm', cover: 'img/cases/home_dorm_v52.jpg', name: 'Общаги и гаражи', icon: '🛏️', price: 'auto', tier: 'cheap',
    desc: 'Койка, гараж, дача, дом в деревне', w: { common: 98.5, rare: 1.5, epic: 0, legendary: 0, mythic: 0 }, items: ['h_bed', 'h_garage', 'h_dacha', 'h_village', 'h_studio', 'h_flat'] },
  { id: 'home_used', cover: 'img/cases/home_used_v52.jpg', name: 'Вторичка', icon: '🏚️', price: 'auto', tier: 'cheap',
    desc: 'Комнаты и квартиры в старых домах', w: { common: 74, rare: 25, epic: 1, legendary: 0, mythic: 0 },
    items: ['h_garage', 'h_room', 'h_studio', 'h_flat', 'h_brezh', 'h_kazan', 'h_house'] },
  { id: 'home_town', cover: 'img/cases/home_town_v52.jpg', name: 'Таунхаусы и дома', icon: '🏡', price: 'auto', tier: 'mid',
    desc: 'Хорошие квартиры и первые свои дома', w: { common: 0, rare: 29, epic: 69.5, legendary: 1.5, mythic: 0 },
    items: ['h_newflat', 'h_loft', 'h_sochi', 'h_house', 'h_town', 'h_polyana', 'h_city', 'h_pent'] },
  { id: 'home_chalet', cover: 'img/cases/home_chalet_v52.jpg', name: 'Шале и апартаменты', icon: '🏔️', price: 'auto', tier: 'elite',
    desc: 'Альпы, Дубай, Патрики — только эпическое', w: { common: 0, rare: 0, epic: 97, legendary: 3, mythic: 0 },
    items: ['h_town', 'h_polyana', 'h_chalet', 'h_cottage', 'h_dubai_apt', 'h_patriki', 'h_city', 'h_pent'] },
  { id: 'home_dream', cover: 'img/cases/home_dream_v52.jpg', name: 'Дом мечты', icon: '🏰', price: 'auto', tier: 'elite',
    desc: 'Особняки и шанс на апартаменты в «Сити»', w: { common: 0, rare: 0, epic: 81.7, legendary: 18, mythic: 0.3 },
    items: ['h_chalet', 'h_cottage', 'h_dubai_apt', 'h_patriki', 'h_city', 'h_castle'] },
  { id: 'home_new', cover: 'img/cases/home_new_v52.jpg', name: 'Новостройки', icon: '🏗️', price: 'auto', tier: 'mid',
    desc: 'Квартиры, таунхаусы и дома', w: { common: 0, rare: 74, epic: 25, legendary: 1, mythic: 0 }, items: ['h_studio', 'h_flat', 'h_newflat', 'h_house', 'h_town', 'h_kazan', 'h_spb', 'h_loft', 'h_polyana', 'h_city'] },
  { id: 'home_elite', cover: 'img/cases/home_elite_v52.jpg', name: 'Элитная Москва', icon: '🌆', price: 'auto', tier: 'elite',
    desc: 'Патриаршие, Москва-Сити, пентхаусы', w: { common: 0, rare: 0, epic: 70, legendary: 30, mythic: 0 },
    items: ['h_patriki', 'h_city', 'h_pent', 'h_hotel'] },
  { id: 'home_abroad', cover: 'img/cases/home_abroad_v52.jpg', name: 'Зарубежная элитка', icon: '✈️', price: 'auto', tier: 'elite',
    desc: 'Дубай, Лондон, Лазурный берег, Монако', w: { common: 0, rare: 0, epic: 60, legendary: 36, mythic: 4 },
    items: ['h_cottage', 'h_dubai_apt', 'h_palm', 'h_london', 'h_riviera', 'h_monaco', 'h_chalet', 'h_tuscany', 'h_ny'] },
  { id: 'home_castle', cover: 'img/cases/home_castle_v52.jpg', name: 'Замки и острова', icon: '🏰', price: 'auto', tier: 'elite',
    desc: 'Только здесь: замок и частный остров', w: { common: 0, rare: 0, epic: 0, legendary: 65, mythic: 35 },
    items: ['h_rublyovka', 'h_palm', 'h_london', 'h_castle', 'h_island', 'h_riviera', 'h_monaco', 'h_ny', 'h_tower'] },
  { id: 'home_resort', cover: 'img/cases/home_resort_v52.jpg', name: 'Курорты', icon: '🏖️', price: 'auto', tier: 'mid', theme: true,
    desc: 'Батуми, Алания, Сочи, Дубай', w: { common: 35, rare: 55, epic: 10, legendary: 0, mythic: 0 },
    items: ['h_batumi', 'h_alanya', 'h_sochi', 'h_dubai_apt', 'h_polyana'] },
  { id: 'home_country', cover: 'img/cases/home_country_v52.jpg', name: 'Загородная жизнь', icon: '🌲', price: 'auto', tier: 'mid', theme: true,
    desc: 'Дачи, дома в деревне, коттеджи и таунхаусы', w: { common: 50, rare: 0, epic: 50, legendary: 0, mythic: 0 },
    items: ['h_dacha', 'h_village', 'h_house', 'h_town', 'h_polyana'] },
  { id: 'home_msk', cover: 'img/cases/home_msk_v52.jpg', name: 'Москва', icon: '🏙️', price: 'auto', tier: 'mid', theme: true,
    desc: 'От коммуналки до квартиры на Патриарших', w: { common: 30, rare: 55, epic: 15, legendary: 0, mythic: 0 },
    items: ['h_room', 'h_studio', 'h_flat', 'h_newflat', 'h_patriki', 'h_loft'] },

  { id: 'conn_free', cover: 'img/cases/conn_free_v52.jpg', name: 'Знакомство дня', icon: '🍀', price: 0, cooldown: 24 * 3600e3, tier: 'free',
    desc: 'Раз в сутки: полезный человек', w: { common: 75, rare: 20, epic: 4, legendary: 0.9, mythic: 0.1 },
    items: ['k_police', 'k_gibdd', 'k_zhkh', 'k_tax', 'k_official', 'k_banker', 'k_prosecutor', 'k_judge', 'k_deputy', 'k_governor', 'k_oligarch', 'k_minister'] },
  { id: 'conn_district', cover: 'img/cases/conn_district_v52.jpg', name: 'Районные знакомства', icon: '🏘️', price: 150e3, tier: 'cheap',
    desc: 'Участковый, гаишник, ЖКХ — иногда кто-то повыше', w: W_CHEAP,
    items: ['k_police', 'k_gibdd', 'k_zhkh', 'k_tax', 'k_banker'] },
  { id: 'conn_forum', cover: 'img/cases/conn_forum_v52.jpg', name: 'Деловой форум', icon: '🎤', price: 4e6, tier: 'mid',
    desc: 'Чиновники, банкиры, силовики', w: W_MID,
    items: ['k_tax', 'k_official', 'k_banker', 'k_prosecutor', 'k_judge'] },
  { id: 'conn_power', cover: 'img/cases/conn_power_v52.jpg', name: 'Коридоры власти', icon: '🏛️', price: 10e6, tier: 'mid',
    desc: 'Чиновники, прокурор, судья — и шанс на депутата', w: { common: 0, rare: 40, epic: 50, legendary: 10, mythic: 0 },
    items: ['k_tax', 'k_official', 'k_banker', 'k_prosecutor', 'k_judge', 'k_deputy'] },
  { id: 'conn_high', cover: 'img/cases/conn_high_v52.jpg', name: 'Высший свет', icon: '🎭', price: 28e6, tier: 'elite',
    desc: 'Губернаторы и депутаты, редко — олигарх или министр', w: { common: 0, rare: 0, epic: 50, legendary: 45, mythic: 5 },
    items: ['k_prosecutor', 'k_judge', 'k_deputy', 'k_governor', 'k_oligarch', 'k_minister'] },
  { id: 'conn_club', cover: 'img/cases/conn_club_v52.jpg', name: 'Закрытый клуб', icon: '🥃', price: 150e6, tier: 'elite',
    desc: 'Только влиятельные люди', w: { common: 0, rare: 0, epic: 60, legendary: 32, mythic: 8 },
    items: ['k_prosecutor', 'k_judge', 'k_deputy', 'k_governor', 'k_oligarch', 'k_minister'] },
];
// Цена кейсов с price: 'auto' — от средней стоимости (округлённо до двух значащих цифр)
for (const c of CASES) {
  if (c.price !== 'auto') continue;
  const pool = c.items.map(id => ITEMS.find(i => i.id === id));
  const rars = RARITY_ORDER.filter(r => c.w[r] > 0 && pool.some(i => i.rarity === r));
  const tw = rars.reduce((a, r) => a + c.w[r], 0);
  let ev = 0;
  for (const r of rars) {
    const list = pool.filter(i => i.rarity === r);
    ev += list.reduce((a, i) => a + i.value, 0) / list.length * c.w[r] / tw;
  }
  const p = ev * AUTO_PRICE_RATE, mag = Math.pow(10, Math.floor(Math.log10(p)) - 1);
  c.price = Math.round(p / mag) * mag;
}
const MULTI_OPEN = [1, 3, 5, 10];   // варианты открытия за раз
const MULTI_DISCOUNT = { 3: 0.03, 5: 0.05, 10: 0.1 }; // оптом дешевле: ×3 −3%, ×5 −5%, ×10 −10%
const PITY = 30;          // не позже чем на 30-м кейсе гарантированно эпик или выше
const PITY_MIN_W = 5;     // …но только в кейсах, где эпик и выше и так выпадает хотя бы в 5%: иначе крошечные джекпоты дешёвых кейсов стали бы «гарантированными»
// ---------- связи: доверие ----------
const CONN_MAX_LV = 5;
const CONN_XP = [0, 150, 400, 900, 1800];  // сколько доверия нужно для уровней 1–5 (у обычной связи)
// Чем влиятельнее человек, тем дольше завоёвывать его доверие: пороги умножаются на это
const CONN_RARITY_XP = { common: 1, rare: 1.3, epic: 1.7, legendary: 2.2, mythic: 3 };
const DUP_CONN_XP = 100;                   // повторное знакомство из кейса
// Встречи: три ступени — быстрая, серьёзная и большая (доверие и перезарядка у всех одинаковые),
// а что именно и почём — у каждого человека своё: начальницу ЖКХ не зовут на рыбалку за миллион.
const MEETS = [
  { id: 'lunch',   xp: 15,  cd: 1 * 3600e3 },
  { id: 'banya',   xp: 50,  cd: 6 * 3600e3 },
  { id: 'fishing', xp: 150, cd: 24 * 3600e3 },
];
// [название, иконка, цена] для каждой ступени
const CONN_MEETS = {
  k_police:     [['Чай с баранками', 'coffee', 3e3], ['Шашлыки на даче', 'flame', 40e3], ['Подарок к Дню полиции', 'gift', 200e3]],
  k_gibdd:      [['Кофе на посту', 'coffee', 2e3], ['Шины для патрульной', 'steering-wheel', 60e3], ['Путёвка в Сочи', 'beach', 250e3]],
  k_zhkh:       [['Цветы и конфеты', 'flower', 3e3], ['Ремонт в кабинете', 'paint', 80e3], ['Санаторий для мамы', 'heart', 300e3]],
  k_tax:        [['Обед в ресторане', 'tools-kitchen-2', 25e3], ['Абонемент в фитнес', 'barbell', 150e3], ['Путёвка в Турцию', 'plane', 700e3]],
  k_official:   [['Ужин', 'tools-kitchen-2', 40e3], ['Баня', 'flame', 250e3], ['Рыбалка на Волге', 'fish', 1e6]],
  k_banker:     [['Деловой ланч', 'tools-kitchen-2', 50e3], ['Гольф-клуб', 'golf', 400e3], ['Яхтенный уикенд', 'sailboat', 2e6]],
  k_prosecutor: [['Ужин без свидетелей', 'tools-kitchen-2', 120e3], ['Охота', 'target', 1.5e6], ['Коллекционное ружьё', 'gift', 5e6]],
  k_judge:      [['Коллекционный коньяк', 'glass-full', 150e3], ['Картина в кабинет', 'photo', 1.5e6], ['Дача на лето', 'home', 6e6]],
  k_deputy:     [['Пожертвование в фонд', 'heart-handshake', 1e6], ['Спонсорство выборов', 'speakerphone', 8e6], ['Вилла в Ницце на лето', 'building', 30e6]],
  k_governor:   [['Приём в резиденции', 'tools-kitchen-2', 1.5e6], ['Охота с вертолёта', 'helicopter', 12e6], ['Яхта на неделю', 'sailboat', 45e6]],
  k_oligarch:   [['Покер по-крупному', 'cards', 5e6], ['Ралли в Монако', 'car', 40e6], ['Остров на неделю', 'trees', 150e6]],
  k_minister:   [['Закрытый ужин', 'tools-kitchen-2', 4e6], ['Форум в Давосе', 'plane', 35e6], ['Часы в подарок', 'clock', 120e6]],
};
// Просьбы: время от времени одна из связей о чём-то просит. Выполнил — много доверия, отказал — немного теряешь.
// cost: hours — столько часов твоего дохода (не меньше min); salary — столько месячных зарплат сотрудника бизнеса
const FAVORS = [
  { id: 'f_loan',    text: '{name} просит занять денег «до зарплаты»',        cost: { hours: 3, min: 30e3 },  xp: 120 },
  { id: 'f_sponsor', text: '{name} просит спонсировать праздник района',      cost: { hours: 6, min: 80e3 },  xp: 180 },
  { id: 'f_tickets', text: '{name} мечтает о билетах на финал Кубка',         cost: { hours: 2, min: 25e3 },  xp: 90 },
  { id: 'f_car',     need: 'car', text: '{name} просит твою машину на свадьбу дочери', xp: 100 },
  // Племянник — не разовая плата, а настоящий минус: drag.hours часов он «работает» в бизнесе —
  // выручка падает на revCut, а зарплату ему платить как лишнему сотруднику. Помочь или нет — выбор.
  { id: 'f_nephew',  need: 'biz', text: '{name} просит устроить племянника в «{biz}»', drag: { hours: 12, revCut: 0.15, wages: 1 }, xp: 200 },
];
const FAVOR_EVERY_H = [10, 20];   // новая просьба через столько часов
const FAVOR_TTL_H = 24;           // сколько просьба ждёт ответа
const FAVOR_FAIL_XP = 30;         // столько доверия теряешь, если отказал или не успел
const DECAY_AFTER_H = 72;         // не общались столько часов — доверие понемногу тает (уровень не падает)
const DECAY_XP_PER_DAY = 15;
const SPECIAL_CD_H = 24;          // особая услуга — раз в сутки
// Особые услуги на максимальном доверии
const SPECIALS = {
  closeEvent: 'Закрыть любую текущую проблему бесплатно',
  cash:       'Выгодная сделка: +{h} мес. твоего дохода',
  ticket:     'Свой человек: бесплатное открытие «{case}»',
  taxHoliday: 'Налоговые каникулы: {h} ч без налога на бизнес',
  tender:     'Госзаказ: {h} мес. прибыли бизнеса сразу',
};


// pay — зарплата ₽/мес; req — минимальные уровни навыков; needCar — нужна активная машина
// perk / v — польза от профессии, пока ты на ней работаешь (названия как у связей, см. PERKS)
// solves — какие события решаются бесплатно, пока работаешь здесь
const JOBS = [
  { id: 'flyers',   name: 'Раздатчик листовок',   icon: '📄', pay: 30e3,  req: {} },
  { id: 'courier',  name: 'Курьер',               icon: '📦', pay: 60e3,  req: { fit: 2 },  perk: 'gigUp', v: 20 },
  { id: 'barista',  name: 'Бариста',              icon: '☕', pay: 65e3,  req: { cha: 3 },  perk: 'meetCheap', v: 20 },
  { id: 'seller',   name: 'Продавец-консультант', icon: '🛍️', pay: 80e3,  req: { cha: 5, int: 2 }, perk: 'caseCheap', v: 5 },
  { id: 'taxi',     name: 'Таксист',              icon: '🚕', pay: 120e3, req: { fit: 4 }, needCar: true, perk: 'fineCut', v: 30 },
  { id: 'junior',   name: 'Junior-программист',   icon: '💻', pay: 150e3, req: { int: 8 },  perk: 'skillCheap', v: 15 },
  { id: 'trainer',  name: 'Фитнес-тренер',        icon: '🏋️', pay: 180e3, req: { fit: 12, cha: 5 }, perk: 'trustUp', v: 25 },
  { id: 'sales',    name: 'Менеджер по продажам', icon: '📞', pay: 220e3, req: { cha: 10, biz: 5 }, perk: 'demandUp', v: 10 },
  { id: 'taxman',   name: 'Сотрудник налоговой',  icon: '🧾', pay: 250e3, req: { int: 10, biz: 6 }, perk: 'taxCut', v: 5, solves: ['e_tax'] },
  { id: 'lawyer',   name: 'Юрист',                icon: '⚖️', pay: 320e3, req: { int: 12, cha: 8 }, perk: 'court', v: 1, solves: ['e_raid', 'e_court'] },
  { id: 'senior',   name: 'Senior-разработчик',   icon: '🧑‍💻', pay: 450e3, req: { int: 18 }, perk: 'skillCheap', v: 25 },
  { id: 'director', name: 'Директор филиала',     icon: '🏢', pay: 700e3, req: { biz: 15, cha: 15 }, perk: 'bizEff', v: 20 },
  { id: 'mayor',    name: 'Мэр города',           icon: '🏛️', pay: 1.2e6, req: { cha: 22, biz: 15, int: 15 }, perk: 'licenseCut', v: 50, solves: ['e_fire', 'e_flood'] },
  { id: 'blogger',  name: 'Блогер-миллионник',    icon: '📱', pay: 1.5e6, req: { cha: 25 }, perk: 'demandUp', v: 20 },
  { id: 'founder',  name: 'Основатель стартапа',  icon: '🚀', pay: 5e6,   req: { biz: 28, int: 25 }, perk: 'bizBoost', v: 10 },
  { id: 'holding',  name: 'Владелец холдинга',    icon: '🏦', pay: 25e6,  req: { biz: 40, cha: 30, int: 30 }, perk: 'bizBoost', v: 20 },
];

const START_MONEY = 600e3;

const SKILL_MAX = 50;
const SKILLS = [
  { id: 'int', name: 'Интеллект', icon: '🧠', desc: '+1% к зарплате за уровень. Нужен для умных профессий.' },
  { id: 'cha', name: 'Харизма',   icon: '🗣️', desc: '−1% к цене кейсов за уровень (до −30%). Нужна для работы с людьми.' },
  { id: 'fit', name: 'Физуха',    icon: '💪', desc: '+5% к оплате подработок за уровень. Нужна для физической работы.' },
  { id: 'biz', name: 'Бизнес',    icon: '📈', desc: '+1% к аренде за уровень. Нужен для руководящих должностей.' },
];
// Учёба без перерывов: прокачка ограничена только деньгами, каждый уровень на 30% дороже предыдущего
// Курсы, тренер, MBA… Первые 5 уровней со скидкой (30% → 86%), чтобы старт шёл бодрее; дальше — полная цена.
const skillCost = lvl => Math.round(100e3 * Math.pow(1.3, lvl) * (lvl < 5 ? 0.3 + 0.14 * lvl : 1));

// ---------- подработки ----------
// Разовые задания по таймеру: запустил — вернулся — забрал. Одна за раз, работе не мешает.
// h — длительность в реальных часах; rank — минимальный статус; req — навыки; needCar — нужна машина
const GIGS = [
  { id: 'g_flyers',  name: 'Раздать листовки у метро',  icon: '📄', h: 0.062, pay: 15e3,  rank: 0 },
  { id: 'g_truck',   name: 'Разгрузить фуру',           icon: '🚚', h: 0.25,   pay: 50e3,  rank: 0 },
  { id: 'g_night',   name: 'Ночная смена на складе',    icon: '🌙', h: 1,   pay: 150e3, rank: 0 },
  { id: 'g_deliver', name: 'Доставка на своей машине',  icon: '🚗', h: 0.375,   pay: 150e3, rank: 1, needCar: true },
  { id: 'g_repair',  name: 'Ремонт квартиры знакомым',  icon: '🛠️', h: 0.75,   pay: 400e3, rank: 2, req: { fit: 5 } },
  { id: 'g_host',    name: 'Ведущий на свадьбе',        icon: '🎤', h: 0.5,   pay: 800e3, rank: 3, req: { cha: 12 } },
  { id: 'g_freelance', name: 'Фриланс-проект',          icon: '💻', h: 1,   pay: 1.2e6, rank: 3, req: { int: 10 } },
  { id: 'g_consult', name: 'Консультация бизнеса',      icon: '📊', h: 1,   pay: 6e6,   rank: 4, req: { biz: 15 } },
  { id: 'g_deal',    name: 'Посредник в крупной сделке', icon: '🤝', h: 1.5, pay: 30e6,  rank: 5, req: { cha: 20, biz: 20 } },
];

// ---------- задания ----------
// ev — какое действие засчитывается: open (кейс), free (ежедневный кейс), gig, date, gift, skill (курс),
//      earn (заработок с работы, аренды и подработок), daily_all (выполнены все ежедневные)
// n — сколько нужно; hours — для earn: цель = столько месяцев текущего дохода;
// need: 'conn' — только если есть связи, 'biz' — только если есть бизнес, 'sil' — на службе, 'civil' — не на службе.
// Если положение изменилось (поступил на службу, продал бизнес), невыполнимое задание заменяется другим — с нуля.
const DAILY_QUESTS = [
  { id: 'd_open',  ev: 'open',  n: 2, text: 'Открой 2 любых кейса' },
  { id: 'd_free',  ev: 'free',  n: 1, text: 'Открой ежедневный кейс' },
  { id: 'd_gig',   ev: 'gig',   n: 2, text: 'Выполни 2 подработки', need: 'civil' },
  { id: 'd_meet',  ev: 'meet',  n: 1, text: 'Встреться с одной из связей', need: 'conn' },
  { id: 'd_skill', ev: 'skill', n: 1, text: 'Пройди курс любого навыка' },
  { id: 'd_earn',  ev: 'earn',  hours: 6, text: 'Заработай {X}' },
  { id: 'd_biz',   ev: 'bizup', n: 1, text: 'Улучши бизнес: станок, сотрудник или реклама', need: 'biz' },
  { id: 'd_conn',  ev: 'conn_free', n: 1, text: 'Открой «Знакомство дня»' },
  { id: 'd_race',  ev: 'race_win', n: 1, text: 'Выиграй гонку', need: 'car' },
  { id: 'd_mission', ev: 'mission', n: 2, text: 'Выполни 2 задания службы', need: 'sil' },
];
const WEEKLY_QUESTS = [
  { id: 'w_open',  ev: 'open',      n: 15, text: 'Открой 15 кейсов' },
  { id: 'w_gig',   ev: 'gig',       n: 10, text: 'Выполни 10 подработок', need: 'civil' },
  { id: 'w_meet',  ev: 'meet',      n: 7,  text: 'Проведи 7 встреч со связями', need: 'conn' },
  { id: 'w_favor', ev: 'favor',     n: 2,  text: 'Выполни 2 просьбы связей', need: 'conn' },
  { id: 'w_skill', ev: 'skill',     n: 5,  text: 'Пройди 5 курсов' },
  { id: 'w_earn',  ev: 'earn',      hours: 60, text: 'Заработай {X}' },
  { id: 'w_daily', ev: 'daily_all', n: 4,  text: 'Выполни все ежедневные задания 4 дня' },
  { id: 'w_biz',   ev: 'bizup',     n: 5,  text: 'Сделай 5 улучшений бизнеса', need: 'biz' },
  { id: 'w_race',  ev: 'race_win',  n: 8,  text: 'Выиграй 8 гонок', need: 'car' },
  { id: 'w_mission', ev: 'mission',  n: 10, text: 'Выполни 10 заданий службы', need: 'sil' },
];
const QUESTS_PER_DAY = 3;
const QUESTS_PER_WEEK = 3;
// Награды: деньги — в месяцах текущего дохода (не меньше min), билеты — бесплатное открытие кейса
// Награды заданий — небольшой бонус к прогрессу: доля месяца текущего дохода (не меньше min)
const DAILY_REWARD = { hours: 0.3, min: 5e3 };
const DAILY_BONUS = { hours: 0.75, min: 10e3, ticket: 'car_grandpa' };          // за все ежедневные
const WEEKLY_TICKETS = ['car_used', 'home_dorm', 'conn_district'];         // по одному за каждое недельное
const WEEKLY_BONUS = { ticket: 'car_cn' };                           // за все недельные

// «Жизненный путь» — цепочка целей по порядку. type: job (зарплата от v), car, skills (сумма уровней),
// home (объектов от v), rank (статус от v), carRarity (редкость машины от v),
// raceWins (побед в гонках от v), biz (бизнесов от v), bizProfit (прибыль всех бизнесов от v ₽/мес), conn (связей от v), connLv (доверие любой связи от v)
// reward: money или ticket (id кейса)
const LIFE_PATH = [
  { type: 'job',       v: 60e3,  text: 'Устройся на работу получше', reward: { money: 50000 } },
  { type: 'car',                 text: 'Получи первую машину',       reward: { money: 75000 } },
  { type: 'skills',    v: 5,     text: 'Пройди 5 курсов',            reward: { money: 100000 } },
  { type: 'home',      v: 1,     text: 'Получи своё жильё',          reward: { money: 150000 } },
  { type: 'rank',      v: 2,     text: 'Стань «Работягой»',          reward: { ticket: 'car_used' } },
  { type: 'biz',       v: 1,     text: 'Открой свой бизнес',         reward: { money: 250000 } },
  { type: 'conn',      v: 3,     text: 'Заведи 3 полезные связи',     reward: { ticket: 'conn_district' } },
  { type: 'raceWins',  v: 5,     text: 'Выиграй 5 гонок',            reward: { money: 300e3 } },
  { type: 'job',       v: 150e3, text: 'Зарплата от 1,2 млн ₽/ч',  reward: { money: 500000 } },
  { type: 'connLv',    v: 3,     text: 'Подними доверие любой связи до 3', reward: { ticket: 'home_dorm' } },
  { type: 'rank',      v: 3,     text: 'Стань «Средним классом»',    reward: { money: 1e06 } },
  { type: 'carRarity', v: 2,     text: 'Получи эпическую машину',    reward: { ticket: 'car_new' } },
  { type: 'home',      v: 5,     text: 'Собери 5 объектов недвижимости', reward: { money: 2.5e06 } },
  { type: 'rank',      v: 4,     text: 'Стань «Успешным»',           reward: { ticket: 'home_used' } },
  { type: 'bizProfit', v: 1e6,   text: 'Прибыль бизнеса от 8 млн ₽/ч', reward: { ticket: 'car_new' } },
  { type: 'connLv',    v: 5,     text: 'Доведи связь до полного доверия', reward: { money: 1e07 } },
  { type: 'job',       v: 450e3, text: 'Зарплата от 3,6 млн ₽/ч',  reward: { money: 1.5e07 } },
  { type: 'rank',      v: 5,     text: 'Стань «Богачом»',            reward: { ticket: 'car_new' } },
  { type: 'biz',       v: 4,     text: 'Владей четырьмя бизнесами',   reward: { money: 5e07 } },
  { type: 'conn',      v: 8,     text: 'Собери 8 разных связей',     reward: { ticket: 'conn_forum' } },
  { type: 'rank',      v: 6,     text: 'Стань миллиардером',         reward: { ticket: 'car_premium' } },
  { type: 'rank',      v: 7,     text: 'Стань «Магнатом»',           reward: { money: 5e08 } },
];

// Статус по состоянию: деньги + рыночная стоимость имущества
const RANKS = [
  { min: 0,      name: 'Бомж',          icon: '🥾' },
  { min: 200e3,  name: 'Студент',       icon: '🎒' },
  { min: 1e6,    name: 'Работяга',      icon: '🔧' },
  { min: 5e6,    name: 'Средний класс', icon: '🧑‍💼' },
  { min: 30e6,   name: 'Успешный',      icon: '😎' },
  { min: 150e6,  name: 'Богач',         icon: '💰' },
  { min: 1e9,    name: 'Миллиардер',    icon: '🏦' },
  { min: 10e9,   name: 'Магнат',        icon: '🛩️' },
  { min: 100e9,  name: 'Олигарх',       icon: '👑' },
];

// ---------- бизнес ----------
// Всё просто: «Рабочие места» дают мощность (сколько клиентов можешь обслужить),
// «Реклама» даёт клиентов. Продано = меньшее из двух. Прибыль = выручка − зарплаты − аренда − управляющий − налог.
// При покупке мощность и клиенты равны; дальше чередуй: место → реклама → место…
// Все цифры бизнеса считаются от его цены по единым формулам — так бизнесы одинаково сбалансированы.
const BIZ_TAX = 0.15;
const BIZ_SELL_RATE = 0.7;      // бизнес продаётся за 70% вложенного — как и вещи
const BIZ_LICENSE = 0.1;        // лицензии — доля цены
const BIZ_START = 2;            // рабочих мест и уровней клиентов на старте
const BIZ_MAX = 8;              // максимум рабочих мест (и столько же уровней клиентов); каждое следующее дороже на BIZ_GROWTH
const BIZ_REV = 0.035;          // выручка одного загруженного места в месяц — доля eco бизнеса
const BIZ_SALARY = 0.008;       // зарплата на одно место в месяц
const BIZ_RENT = 0.006;         // аренда помещения в месяц
const BIZ_MGR = 0.008;          // управляющий в месяц
const BIZ_SLOT_COST = 1.2;      // первое новое место — доля eco бизнеса (место + реклама окупаются ≈ за 11 ч, последние — за 27 ч)
const BIZ_AD_COST = 0.8;        // первый уровень рекламы
const BIZ_GROWTH = 1.2;        // каждое следующее место и уровень рекламы дороже
const HIRE_MGR_MONTHS = 2;      // (старое) найм управляющего — столько его зарплат
// Управляющие: чем круче, тем дороже (найм — hire его месячных зарплат, salary — доля цены бизнеса в месяц),
// но тем выше эффективность бизнеса (eff) и шанс самому решить проблему бизнеса (solve, %). req — нужный навык «Бизнес».
const MANAGERS = [
  { id: 'intern',   name: 'Стажёр',       icon: '🧑‍🎓', salary: 0.003, eff: 0.75, solve: 0,  hire: 1,  req: 0 },
  { id: 'manager',  name: 'Менеджер',     icon: '🧑‍💼', salary: 0.006, eff: 0.9,  solve: 15, hire: 3,  req: 5 },
  { id: 'head',     name: 'Управляющий',  icon: '👔', salary: 0.009, eff: 1,    solve: 25, hire: 4,  req: 10 },
  { id: 'director', name: 'Директор',     icon: '🎩', salary: 0.014, eff: 1.12, solve: 40, hire: 6,  req: 18 },
  { id: 'ceo',      name: 'CEO',          icon: '🦈', salary: 0.022, eff: 1.25, solve: 55, hire: 10, req: 28 },
];

// price — помещение и запуск; eco — «база» экономики: выручка, зарплаты, аренда, управляющий и прокачка считаются от неё
// (на полной прокачке бизнес даёт ≈ 1,75 × eco в час — вровень с «крышами» силовика того же этапа);
// turn — оборот, от него платит «крыша»; rank / req — что нужно для открытия; unit — чем меряем клиентов; perSlot — клиентов на место в месяц
const BUSINESSES = [
  { id: 'b_shawarma',  name: 'Ларёк с шаурмой',       icon: '🌯', price: 1.8e6, eco: 1.15e6, turn: 1.5e6, rank: 2, req: { biz: 2 },  unit: 'покупателей', perSlot: 1500, slot: 'Повар у гриля' },
  { id: 'b_tires',     name: 'Шиномонтаж',            icon: '🛞', price: 2.5e6, eco: 1.6e6, turn: 4e6, rank: 2, req: { biz: 4 },  unit: 'машин',       perSlot: 300,  slot: 'Мастер со стендом' },
  { id: 'b_carwash',   name: 'Автомойка',             icon: '🚿', price: 3.5e6, eco: 2.2e6, turn: 8e6, rank: 3, req: { biz: 6 },  unit: 'машин',       perSlot: 400,  slot: 'Моечный пост' },
  { id: 'b_coffee',    name: 'Кофейня',               icon: '☕', price: 5e6, eco: 3.1e6, turn: 15e6, rank: 3, req: { biz: 9 },  unit: 'гостей',      perSlot: 3000, slot: 'Бариста с кофемашиной' },
  { id: 'b_bakery',    name: 'Пекарня',               icon: '🥐', price: 7e6, eco: 4.4e6, turn: 30e6, rank: 3, req: { biz: 12 }, unit: 'покупателей', perSlot: 4000, slot: 'Пекарь с печью' },
  { id: 'b_service',   name: 'Автосервис',            icon: '🔧', price: 10e6, eco: 6.2e6, turn: 60e6, rank: 4, req: { biz: 15 }, unit: 'заказов',     perSlot: 60,   slot: 'Механик с подъёмником' },
  { id: 'b_gym',       name: 'Фитнес-клуб',           icon: '🏋️', price: 14e6, eco: 8.6e6, turn: 120e6, rank: 4, req: { biz: 18 }, unit: 'абонементов', perSlot: 300,  slot: 'Тренер и зал' },
  { id: 'b_furniture', name: 'Мебельный цех',         icon: '🪑', price: 19e6, eco: 12e6, turn: 300e6, rank: 4, req: { biz: 22 }, unit: 'комплектов',  perSlot: 40,   slot: 'Столяр со станком ЧПУ' },
  { id: 'b_logistics', name: 'Логистическая компания', icon: '🚛', price: 26e6, eco: 16.5e6, turn: 800e6, rank: 5, req: { biz: 26 }, unit: 'рейсов',      perSlot: 120,  slot: 'Фура с водителем' },
  { id: 'b_gas',       name: 'Сеть АЗС',              icon: '⛽', price: 37e6, eco: 23.5e6, turn: 2e9, rank: 5, req: { biz: 30 }, unit: 'заправок',    perSlot: 20e3, slot: 'Заправка с персоналом' },
  { id: 'b_factory',   name: 'Завод стройматериалов', icon: '🏭', price: 52e6, eco: 33e6, turn: 6e9, rank: 6, req: { biz: 35 }, unit: 'тонн',        perSlot: 4000, slot: 'Производственная линия' },
  { id: 'b_it',        name: 'IT-холдинг',            icon: '🏢', price: 73e6, eco: 46e6, turn: 20e9, rank: 6, req: { biz: 40 }, unit: 'проектов',    perSlot: 4,    slot: 'Команда разработчиков' },
];

// ---------- блат: связи и события ----------
// Что даёт каждая связь; {v} — значение для текущего уровня доверия (lv у связи)
const PERKS = {
  fineCut:    'Штрафы и мелкие проблемы дешевле на {v}%',
  gibdd:      'Проблемы с ГИБДД решаются бесплатно',
  rentUp:     '+{v}% к аренде (без простоев и ремонтов)',
  taxCut:     'Налог бизнеса меньше на {v} п.п.',
  license:    'Взятка за лицензию безопаснее: риск −{v}%',
  sellUp:     'Продажа вещей и бизнеса дороже на {v} п.п.',
  safe:       'Риск попасться на взятке −{v}%',
  court:      'Суды и рейдеры решаются бесплатно',
  demandUp:   '+{v}% спроса во всех бизнесах',
  licenseCut: 'Лицензии официально дешевле на {v}%',
  deal:       'Раз в сутки закрытая сделка: +{v}% за 12 часов',
  bizBoost:   '+{v}% к выручке всех бизнесов',
  gigUp:      '+{v}% к оплате подработок',
  meetCheap:  'Встречи со связями дешевле на {v}%',
  caseCheap:  'Кейсы дешевле на {v}%',
  skillCheap: 'Учёба дешевле на {v}%',
  trustUp:    '+{v}% доверия от встреч',
  bizEff:     '+{v}% к эффективности бизнесов без управляющего',
  callUp:     'Звонки связям помогают на {v}% чаще',
  osbCut:     'Служебных проверок меньше на {v}%',
};

// Работа или бизнес: без управляющего бизнес работает с такой эффективностью
const OWNER_EFF_EMPLOYED = 0.5;  // ты работаешь по найму — на бизнес мало времени
const OWNER_EFF_FREE = 0.9;      // ты уволился и занимаешься только бизнесом

// Звонок связи решает проблему не всегда: шанс по уровню доверия (1…5). Не помог — платишь официально.
const CALL_CHANCE = [55, 63, 70, 78, 85];
const BRIBE_DIVISOR = 5;     // взятка в 5 раз дешевле официального пути
const BRIBE_RISK = 35;       // базовый шанс попасться, %
const BRIBE_FINE = 2;        // попался — платишь официальную сумму × 2
const EVENT_EVERY_H = [8, 16]; // новое событие через случайное число часов из диапазона
const EVENT_GOOD_CHANCE = 40;  // % событий — приятные
const EVENT_REWARD_MIN = 10e3;
const DEAL_HOURS = 12;       // сделка с олигархом
const DEAL_INCOME_H = 24;    // максимум вложения — столько часов текущего дохода

// События. need: car / home / biz — бывает, только если это есть; minRank — с какого статуса.
// cost — официальная цена: hours часов дохода (или bizHours месяцев прибыли ОДНОГО бизнеса), не меньше min.
// Событие с need: 'biz' касается одного случайного бизнеса — {biz} в тексте заменяется его названием.
// via — связь, которая решает бесплатно (ещё помогают профессии с solves); fine: true — дешевле с участковым;
// freeze: true — пока не решено, этот бизнес опечатан (выручки нет, расходы идут).
// good: true — хорошее событие, reward — награда в месяцах дохода (небольшая: 0,5–3 мес., не меньше EVENT_REWARD_MIN). need: 'sil' — только на службе, 'civil' — только гражданским.
const EVENTS = [
  { id: 'e_gibdd', need: 'car', icon: '🚓', title: 'Остановил ГИБДД',
    text: 'Превышение скорости и просроченная страховка. Инспектор многозначительно молчит.',
    hours: 0.5, min: 15e3, via: 'k_gibdd', fine: true },
  { id: 'e_flood', need: 'home', icon: '💧', title: 'Затопили соседей',
    text: 'В одной из твоих квартир прорвало трубу. Соседи снизу требуют ремонт.',
    hours: 2, min: 60e3, via: 'k_zhkh', fine: true },
  { id: 'e_tax', need: 'biz', icon: '🧾', title: 'Налоговая проверка',
    text: 'Инспекция нашла «нарушения» в отчётности «{biz}». Пока не решишь вопрос, его счета заблокированы.',
    bizHours: 2, min: 200e3, via: 'k_tax', freeze: true },
  { id: 'e_fire', need: 'biz', icon: '🧯', title: 'Пожарная инспекция',
    text: 'В «{biz}» огнетушители не той системы, а выход «не по ГОСТу». Помещение опечатали до решения вопроса.',
    bizHours: 1, min: 150e3, via: 'k_official', freeze: true },
  { id: 'e_raid', need: 'biz', minRank: 4, icon: '🦈', title: 'Рейдерский захват',
    text: 'Конкуренты подделали документы и через суд пытаются забрать «{biz}».',
    bizHours: 4, min: 5e6, via: 'k_judge', freeze: true },
  { id: 'e_court', need: 'home', minRank: 3, icon: '📜', title: 'Иск от арендатора',
    text: 'Бывший жилец подал в суд: якобы ты не вернул залог.',
    hours: 6, min: 300e3, via: 'k_judge' },
  { id: 'e_tender', need: 'biz', good: true, conn: 'k_deputy', icon: '📑', title: 'Госзаказ',
    text: 'Знакомый депутат подкинул выгодный контракт для «{biz}».', reward: 3 },
  { id: 'e_review', need: 'biz', good: true, icon: '📸', title: 'Вирусное видео',
    text: 'Блогер снял ролик про «{biz}», и он залетел в рекомендации. Очередь до вечера!', reward: 1.5 },
  { id: 'e_rival', need: 'biz', good: true, icon: '🏳️', title: 'Конкурент закрылся',
    text: 'Главный конкурент «{biz}» обанкротился — его клиенты теперь идут к тебе.', reward: 2 },
  { id: 'e_tenant', need: 'home', good: true, icon: '🤝', title: 'Арендатор на год вперёд',
    text: 'Солидный арендатор заплатил за год вперёд — со скидкой, но сразу.', reward: 2 },
  { id: 'e_car_buyer', need: 'car', good: true, icon: '🚘', title: 'Коллекционер',
    text: 'Коллекционер просто так заплатил за фото с твоей машиной для журнала.', reward: 0.5 },
  { id: 'e_inherit', good: true, icon: '📬', title: 'Наследство',
    text: 'Дальний родственник, о котором ты не слышал, оставил тебе немного денег.', reward: 1.5 },
  { id: 'e_cashback', good: true, icon: '🎉', title: 'Удачный месяц',
    text: 'Банк вернул кэшбэк, а старый друг наконец отдал долг.', reward: 0.5 },
  { id: 'e_tow', need: 'car', icon: '🚛', title: 'Эвакуатор',
    text: 'Машину увезли на штрафстоянку: знак «Остановка запрещена» прятался за деревом.',
    hours: 0.4, min: 10e3, via: 'k_gibdd', fine: true },
  { id: 'e_scam', icon: '📱', title: 'Мошенники',
    text: '«Служба безопасности банка» оформила на тебя кредит. Банк требует платить.',
    hours: 1.5, min: 50e3, via: 'k_banker' },
  { id: 'e_noise', need: 'home', icon: '📢', title: 'Жалоба соседей',
    text: 'Арендаторы устроили вечеринку, соседи вызвали полицию. Теперь штраф и разборки.',
    hours: 0.6, min: 20e3, via: 'k_police', fine: true },
  { id: 'e_lottery', good: true, icon: '🎟️', title: 'Лотерея',
    text: 'Билет, купленный на сдачу, оказался выигрышным.', reward: 1 },
  // служба
  { id: 'e_sil_complaint', need: 'sil', icon: '📨', title: 'Жалоба в прокуратуру',
    text: 'Гражданин пожаловался на превышение полномочий. Прокуратура требует объяснений и «компенсации».',
    hours: 2, min: 80e3, via: 'k_prosecutor' },
  { id: 'e_sil_press', need: 'sil', minRank: 3, icon: '🗞️', title: 'Журналист копает',
    text: 'Журналист готовит материал о твоих «доходах». Нужен юрист, пиар — или нужный звонок.',
    hours: 4, min: 300e3, via: 'k_deputy' },
  { id: 'e_sil_award', need: 'sil', good: true, icon: '🏅', title: 'Премия к празднику',
    text: 'Начальство отметило твою службу квартальной премией.', reward: 1 },
  { id: 'e_sil_trip', need: 'sil', good: true, icon: '✈️', title: 'Командировка',
    text: 'Отправили в командировку — суточные и «боевые» пришли разом.', reward: 1.5 },
];

// ---------- промокоды и значки ----------
// Коды хранятся не открытым текстом, а в виде SHA-256 от кода в ВЕРХНЕМ регистре без пробелов —
// так их не подсмотреть в файлах игры. Хэш для нового кода выдаёт тестовая панель (?debug → профиль).
// reward: money — рубли; tickets — { id кейса: сколько }; items — вещи сразу в имущество; badge — значок из BADGES;
// message — личное сообщение в окне активации.
// only — код только для этого Telegram-тега (без @, регистр не важен); onlyId — только для этого личного ID игрока; until — до какой даты (включительно) код работает; без until — бессрочно. Каждый код срабатывает на телефоне один раз.
const PROMO_CODES = [
  { hash: 'c37c4ebb553abdd981090aa5a9b0b1b557afe1cca78b302a54b9fc1634514f5f', label: 'Для первых игроков',
    until: '2026-11-30', reward: { money: 5e6, tickets: { car_new: 1, conn_forum: 1 }, badge: 'first' } },
  { hash: 'e6ce4116699e55cc3bab95ed51b9d3865ef609c0a771d3295ef249ff713f6a13', label: 'Подарок',
    reward: { money: 10e6, items: ['c_x5', 'h_newflat'], message: 'Моей хорошей девушке Кате ❤️' } },
  // Именной код: only — Telegram-тег (без @), только он может его ввести. Сработает один раз на его телефоне.
  { hash: 'a3d82fcbbbf379a4e78360aa63317ca9cc68e1c453375dd8a85e1bd97ebf17c4', label: 'Для тестера', only: 'rustyk10',
    reward: { money: 10e6, tickets: { home_new: 1 } } },
];
// Заблокированные игроки: сюда вписывают личные ID (ZH-XXXXXX из профиля → «Ещё»). Блокировка работает без сервера,
// поэтому обходится сбросом сохранения на другом устройстве — это защита от случайных нарушителей, а не от решительных.
const BANNED_IDS = [];

// Личные сообщения от разработчика: показываются один раз игроку с этим ID при открытии игры (после обновления).
// to — личный ID, id — номер сообщения (нужен, чтобы не показывать повторно). Текст виден в коде игры всем.
// Окно «Что нового» — показывается всем игрокам один раз после обновления (новичкам — нет). Новый id — новое окно.
// Каждая новость показывается игроку один раз (по её id, последний элемент): старые не повторяются, в окне — только новое.
const UPDATE_NOTES = {
  id: 'v60',
  title: 'Что нового',
  items: [
    ['🕴️', '«Крыши» стали скромнее', 'Бизнес под «крышей» платит не больше 10 окладов звания в месяц. У генерала это около 190 млн ₽/ч — как у владельца холдинга.', 'roofs'],
    ['🏠', 'Жильё приносит меньше', 'Аренда стала на четверть ниже, и каждое жильё сдаётся один раз: одинаковые копии больше не складываются, лишние лучше продать.', 'housing'],
    ['🚓', 'Перехват', 'На красные клетки по краю карты посты ставить нельзя — это выезды из города. Зато на старте больше домов и тупиков.', 'chase'],
    ['💥', 'Штурм понятнее', 'В отчёте по комнатам теперь написано, что произошло: «растяжка обезврежена», «заложник спасён», «боец ранен» вместо «чисто».', 'raid'],
    ['🛡️', 'Бизнес и служба', 'Бизнесом владеть можно до звания Лейтенант включительно, с Капитана любой бизнес нужно продать — «крыши» заменяют его.', 'bizrank'],
    ['🏪', 'Бизнес пересчитан', 'Цены и доходы бизнесов подогнаны под службу: на полной прокачке (до 8 мест) бизнес приносит примерно как «крыши» силовика того же уровня. Если ты вложил больше новой цены — разницу вернули деньгами.', 'biz60'],
    ['💥', 'Штурм: понятные кнопки', 'Под каждым способом входа написано, когда он подходит: «пусто», «один бандит», «банда», «заложник», «растяжка».', 'raid2'],
    ['🎖️', 'Лимит служебного опыта', 'Опыт на службе копится только до требования следующего звания. Дошёл до лимита — ищи повышение: после него опыт снова начнёт расти, уже до нового лимита.', 'xpcap'],
    ['⚖️', 'Силовик и бизнесмен вровень', 'Теперь на одном этапе игры они зарабатывают сопоставимо. Штрафы и взятки на службе пересчитаны.', 'equal'],
    ['🖼️', 'Мелочи', 'Новое фото Pagani Huayra, «Премиум-салон» без Rolls-Royce, галочка в кейсе значит «хоть раз выпадало».', 'misc'],
  ],
};
const PLAYER_MESSAGES = [
  { id: 'm1', to: 'ZH-CPNMHF', icon: '👀', title: 'Сообщение от разработчика', text: 'Матвей всё видит.' },
  { id: 'g1', to: 'ZH-BRLKY5', icon: '🎁', title: 'Подарок от разработчика', text: 'Держи два билета: в «Автосалон» и в «Новостройки». Удачи!', tickets: ['car_new', 'home_new'] },
];

// Учёт игроков: игра раз в REPORT_EVERY_H часов при запуске отправляет ID, Telegram-тег, имя и уровень
// в таблицу Google (Apps Script). Пустая строка — отправка выключена. Игрок видит это в профиле → «Ещё».
const STATS_URL = 'https://script.google.com/macros/s/AKfycbwNQlTyIRf4781M3Osqp5wjkfkiiQEtKWmHuKwyJhTXPisaUVIQqBrb_F_HPqVIY09T/exec';
const REPORT_EVERY_H = 3;
const BADGES = {
  first: { name: 'Первый игрок', icon: 'crown' },
  collector: { name: 'Коллекционер', icon: 'cars' },
  supercar: { name: 'Король суперкаров', icon: 'brand-speedtest' },
};

// ---------- коллекции машин ----------
// Награда один раз, когда собрано: n разных машин (n: 'all' — все) или вся серия по метке t.
// money — месяцев текущего дохода; ticket — бесплатное открытие; badge — значок. Награды скромные — это бонус, а не способ разбогатеть.
const COLLECTIONS = [
  { id: 'col5',   name: 'Первый гараж',            n: 5,     money: 1 },
  { id: 'col10',  name: 'Автопарк',                n: 10,    money: 2,  ticket: 'car_used' },
  { id: 'col20',  name: 'Свой автосалон',          n: 20,    money: 3,  ticket: 'car_new' },
  { id: 'col30',  name: 'Музей на колёсах',        n: 30,    money: 5,  ticket: 'car_premium' },
  { id: 'col45',  name: 'Легендарная коллекция',   n: 45,    money: 8,  ticket: 'car_elite' },
  { id: 'colall', name: 'Все машины игры',         n: 'all', money: 12, badge: 'collector' },
  { id: 'set_cn', name: 'Поднебесная',             t: 'cn',  money: 1 },
  { id: 'set_ru', name: 'Отечественный автопром',  t: 'ru',  money: 2 },
  { id: 'set_jp', name: 'Японская школа',          t: 'jp',  money: 3 },
  { id: 'set_de', name: 'Немецкое качество',       t: 'de',  money: 4 },
  { id: 'set_sc', name: 'Суперкары',               t: 'sc',  money: 6, badge: 'supercar' },
];

// ---------- обучение для новичков ----------
// Шаги по очереди; sel — что подсветить, ждём, пока игрок сделает действие (проверка — в game.js по id шага).
const TUTORIAL = [
  { id: 'cases',   sel: '.nav button[data-tab="cases"]',      text: 'Начнём с удачи: открой вкладку «Кейсы».' },
  { id: 'free',    sel: '[data-cdcase="free"]',               text: 'Раз в сутки здесь бесплатный кейс. Открой его!' },
  { id: 'career',  sel: '.nav button[data-tab="career"]',     text: 'Машина прибавляет к зарплате. Теперь — «Карьера».' },
  { id: 'study',   sel: '[data-sub="career:skills"]',         text: 'Хорошие работы требуют навыков. Открой «Учёбу».' },
  { id: 'skill',   sel: '[data-action="skill"]',              text: 'Пройди любой курс: +1 уровень навыка.' },
  { id: 'jobs',    sel: '[data-sub="career:jobs"]',           text: 'Навыки открывают профессии. Загляни в «Работу».' },
  { id: 'profile', sel: '[data-action="profile"]',            text: 'Нажми на аватар: задания дня, цели и коллекции — за них награды.' },
];
const TUTORIAL_REWARD = { money: 50e3, ticket: 'car_used' };

// ---------- гонки (драг на четверть мили) ----------
// Класс машины — по её редкости. Время заезда считается от мощности, а два нажатия игрока
// (старт по зелёному и переключение передачи в зелёной зоне) решают остальное.
// Не фарм: заездов в день ограничено, есть взнос, расход топлива, износ и поломки.
const CAR_HP = {
  c_2109: 70, c_2107: 75, c_logan: 102, c_granta: 90, c_niva: 83, c_polo: 110, c_vesta: 106,
  c_solaris: 123, c_rio: 123, c_jolion: 143, c_tiggo: 147, c_octavia: 150, c_k5: 194, c_mazda6: 194, c_xtrail: 163,
  c_camry: 200, c_rav4: 199, c_tiguan: 180, c_monjaro: 238, c_eclass: 245, c_lc300: 409, c_x5: 340, c_cayenne: 353,
  c_gtr: 565, c_m5: 600, c_rs6: 600, c_sclass: 367, c_lx: 409, c_911: 385, c_g63: 585, c_bentley: 659,
  c_mclaren: 720, c_ferrari: 830, c_urus: 666, c_aventador: 770, c_phantom: 571, c_cullinan: 571,
  c_huayra: 730, c_jesko: 1600, c_chiron: 1500, c_zaz: 40, c_oka: 33, c_izh: 75, c_2101: 64, c_aurus: 598, c_maybach: 517, c_komendant: 598, c_arsenal: 598, c_bmw7: 449,
  c_moskvich: 75, c_focus: 125, c_largus: 106, c_uaz: 150, c_corolla: 122, c_passat: 150, c_a4: 190, c_prado: 249, c_m3: 510, c_tesla: 1020, c_range: 400, c_amggt: 585, c_db11: 630, c_nevera: 1914, c_laferrari: 963,
  c_leaf: 150, c_lancerx: 143, c_volga: 95, c_markii: 280, c_ae86: 130, c_350z: 287, c_mini: 192, c_wrx: 300, c_stinger: 370, c_civic: 320, c_model3: 460,
  c_rx7: 280, c_impala: 250, c_mustang: 450, c_wrangler: 285, c_supra: 330, c_corvette: 495, c_skyline: 280,
};
// Ставки зависят от цены машины: единица ставки U = RACE_CAR_SHARE её стоимости (не меньше RACE_UNIT_MIN).
// Взнос и выплата уровня — в U: fee — платишь на старте, prize — получаешь при победе.
// Машина работает как вложение: на стоке гонки дают ~4–5% её цены за час лимита — как аренда жилья,
// с полным тюнингом ~20% — как бизнес, но только пока сам катаешься.
const RACE_CLASSES = {
  common:    { name: 'D' },
  rare:      { name: 'C' },
  epic:      { name: 'B' },
  legendary: { name: 'A' },
  mythic:    { name: 'S' },
};
const RACE_CAR_SHARE = 0.01;
const RACE_UNIT_MIN = 1000;
// Пять уровней соперников. base — шанс победы на стоковой машине (Stage 0).
// Соперник уровня N сам затюнингован на Stage N−1, поэтому тюнинг двигает тебя вверх по лестнице:
// разница d = уровень − твой Stage; d ≤ 0 — 100%, d = 1 — 90% (если машина хоть немного затюнингована), d ≥ 2 — base[d].
// Ожидаемый выигрыш на заезд (в U): сток — лучше всего «Любитель» +0,5; Stage 5 на «Легенде» +2,4.
// xp — опыт игрока за заезд (за победу — вдвое больше)
const RACE_LEVELS = [
  { name: 'Новичок',  color: '#7bc68a', base: 100, fee: 0,   prize: 0.4, xp: 1 },
  { name: 'Любитель', color: '#b5d36b', base: 85,  fee: 0.5, prize: 1.2, xp: 2 },
  { name: 'Профи',    color: '#e6c372', base: 50,  fee: 1,   prize: 2.2, xp: 3 },
  { name: 'Мастер',   color: '#f0a35b', base: 30,  fee: 1.5, prize: 3.2, xp: 4 },
  { name: 'Легенда',  color: '#e5484d', base: 0,   fee: 2,   prize: 4.4, xp: 6 },
];
const RACE_NEAR_WIN = 90;            // шанс, когда соперник ровно на ступень сильнее твоей затюнингованной машины
// Верных побед нет (кроме «Новичка»): где тюнинг даёт перевес, у каждого уровня своя полоса шанса шириной RACE_TOP_STEP,
// и чем уровень сложнее, тем она ниже: Любитель 97–98%, Профи 95–96%, Мастер 93–94%, Легенда 91–92%.
const RACE_TOP_MAX = 98;
const RACE_TOP_STEP = 2;
const RACE_FORM = 3;                 // форма соперника сдвигает обычный шанс (85/50/30%) на ±3%
const RACE_SKILL = 5;                // ±% к шансу за мастерство (только если шанс не 0 и не 100)
const RACE_SLEEP = 1.5;              // проспал старт дольше этого (с) — поражение
// Тюнинг: цена ступени — в U машины на момент покупки. При продаже машины вложенное в тюнинг
// возвращается на TUNE_SELL_RATE. hp — прибавка мощности (для красоты и времени заезда).
// Полный тюнинг ≈ 93 U (≈ 14 месяцев дохода). Первые ступени окупаются за 10–25 заездов, последние — за ~100,
// но 90% вложенного возвращается при продаже, поэтому реальная цена любой ступени отбивается за ~10 заездов.
const TUNE_STAGES = [
  { name: 'Чип-тюнинг',          cost: 3,  hp: 0.08 },
  { name: 'Впуск и выхлоп',      cost: 6,  hp: 0.16 },
  { name: 'Турбина',             cost: 12, hp: 0.30 },
  { name: 'Подвеска и коробка',  cost: 24, hp: 0.42 },
  { name: 'Гоночная сборка',     cost: 48, hp: 0.60 },
];
const TUNE_SELL_RATE = 0.9;
// ГИБДД после заезда: шанс остановки и штраф (в U; штраф уменьшают перки «штрафы дешевле»).
// Связь «Инспектор ГИБДД» снижает шанс на GIBDD_CONN_CUT за уровень доверия, на максимуме — отпускает без штрафа.
const GIBDD_CHANCE = 8;
const GIBDD_FINE = 0.3;            // меньше выигрыша даже у «Новичка» (0,4 U)
const GIBDD_CONN_CUT = 1.5;
// Бензин не покупается: у каждой машины свой бак на TANK_RACES заездов, деления восстанавливаются сами.
// Плюс общий лимит заездов на все машины — RACE_POOL, восстанавливается за час.
const TANK_RACES = 5;
const TANK_REGEN_MIN = 12;           // одно деление бака — за столько минут (полный бак за час)
const RACE_POOL = 10;
const POOL_REGEN_MIN = 6;            // один заезд в общий лимит — за столько минут (10 за час)
const SHIFT_PERFECT = -0.15;         // передача в зелёной зоне, с
const SHIFT_MISS = 0.3;              // промах, с
const WEAR_PER_RACE = 8;             // износ за заезд, %
const BREAK_PER_WEAR = 0.25;         // шанс поломки = износ × это (при 100% износа — 25%)
const SERVICE_COST = 0.015;          // ТО (износ → 0) — доля стоимости машины
const REPAIR_COST = 0.05;            // ремонт после поломки — доля стоимости машины
// Время на 402 м по мощности (сек): 23 − 4,3·ln(л.с./50), не быстрее 8,8 с
const quarterMile = hp => Math.max(8.8, 23 - 4.3 * Math.log(hp / 50));

// ---------- номера ----------
// Номер вешается на машину: его стоимость входит в состояние (статус) и в цену машины при продаже.
// Формат как настоящий: буква, три цифры, две буквы, регион — «А 123 ВС 77». Буквы — только те, что есть и в латинице.
const PLATE_LETTERS = 'АВЕКМНОРСТУХ';
// Редкость номера определяется по его виду:
//   common    — обычный;
//   rare      — «круглый» или зеркальный: 100…900, 121, 474;
//   epic      — красивый: три одинаковые цифры (777), 001…009 или три одинаковые буквы (А 123 АА);
//   legendary — блатной: одинаковые буквы И красивые цифры (А 777 АА, О 001 ОО);
//   mythic    — госномер: серии АМР и ЕКХ в любом регионе, кроме 97 (97-й — только служебный, у генерала).
//               В Москве госномер реже (gov у региона) и дороже всех. С ним ГИБДД не штрафует.
// value — стоимость (₽) в регионе с множителем 1; у всех редкостей, и у госномера тоже, умножается на mult региона.
const PLATE_RARITY = {
  common:    { name: 'Обычный',   value: 8e3 },
  rare:      { name: 'Круглый',   value: 60e3 },
  epic:      { name: 'Красивый',  value: 400e3 },
  legendary: { name: 'Блатной',   value: 3e6 },
  mythic:    { name: 'Госномер',  value: 10e6 },
};
const PLATE_GOV = ['АМР', 'ЕКХ'];
const PLATE_SVC_CODE = '97';         // госномер с 97-м регионом выдают только на службе
// Регион выбирает игрок: в Москве номера дороже — и набор стоит дороже (mult)
const PLATE_REGIONS = [
  { id: 'msk',  name: 'Москва',                  mult: 3,   gov: 0.5, codes: ['77', '97', '99', '177', '197', '199', '777', '797', '799'] },
  { id: 'spb',  name: 'Санкт-Петербург',         mult: 2,   gov: 0.7, codes: ['78', '98', '178', '198'] },
  { id: 'mo',   name: 'Московская область',      mult: 1.6, codes: ['50', '90', '150', '190', '750'] },
  { id: 'chr',  name: 'Чечня',                   mult: 1.5, codes: ['95'] },
  { id: 'krd',  name: 'Краснодарский край',      mult: 1.3, codes: ['23', '93', '123', '193'] },
  { id: 'lo',   name: 'Ленинградская область',   mult: 1.3, codes: ['47', '147'] },
  { id: 'kzn',  name: 'Татарстан',               mult: 1.2, codes: ['16', '116', '716'] },
  { id: 'dag',  name: 'Дагестан',                mult: 1.2, codes: ['05'] },
  { id: 'ekb',  name: 'Свердловская область',    mult: 1.1, codes: ['66', '96', '196'] },
  { id: 'nn',   name: 'Нижегородская область',   mult: 1.1, codes: ['52', '152'] },
  { id: 'smr',  name: 'Самарская область',       mult: 1.1, codes: ['63', '163', '763'] },
  { id: 'rnd',  name: 'Ростовская область',      mult: 1.1, codes: ['61', '161', '761'] },
  { id: 'kgd',  name: 'Калининградская область', mult: 1.1, codes: ['39', '91'] },
  { id: 'crm',  name: 'Крым',                    mult: 1.1, codes: ['82'] },
  { id: 'nsk',  name: 'Новосибирская область',   mult: 1,   codes: ['54', '154'] },
  { id: 'ufa',  name: 'Башкортостан',            mult: 1,   codes: ['02', '102', '702'] },
  { id: 'chl',  name: 'Челябинская область',     mult: 1,   codes: ['74', '174', '774'] },
  { id: 'prm',  name: 'Пермский край',           mult: 1,   codes: ['59', '159'] },
  { id: 'krs',  name: 'Красноярский край',       mult: 1,   codes: ['24', '124'] },
  { id: 'vl',   name: 'Приморский край',         mult: 1,   codes: ['25', '125'] },
];
// Наборы номеров: w — шансы редкостей (%); шанс госномера ещё умножается на gov региона.
// Цена считается сама — PLATE_PRICE_RATE от ожидаемой стоимости для выбранного региона. Она выше ожидаемой
// стоимости, а продаётся номер за PLATE_SELL_RATE: крутить наборы ради денег или статуса всегда в минус.
// «Все регионы» — регион выпадает случайно, цена — средняя по регионам. rank — с какого статуса доступен.
const PLATE_BOXES = [
  { id: 'p_basic', name: 'Обычный номер',    icon: '🔢', rank: 0, w: { common: 80, rare: 17, epic: 2.7, legendary: 0.28, mythic: 0.02 } },
  { id: 'p_good',  name: 'Улучшенный номер', icon: '✨', rank: 2, w: { common: 0, rare: 75, epic: 22, legendary: 2.8, mythic: 0.2 } },
  { id: 'p_nice',  name: 'Красивый номер',   icon: '💎', rank: 4, w: { common: 0, rare: 0, epic: 85, legendary: 14, mythic: 1 } },
  { id: 'p_lux',   name: 'Блатной номер',    icon: '👑', rank: 5, w: { common: 0, rare: 0, epic: 0, legendary: 90, mythic: 10 } },
];
const PLATE_PRICE_RATE = 1.15;
const PLATE_SELL_RATE = 0.85;        // номера держат цену лучше машин, но перепродажа — всё равно потеря

// ---------- уровень игрока ----------
// Опыт дают действия, а не деньги: так уровень показывает, сколько человек реально играл.
// XP_FOR — за событие, XP_QUEST — за полученную награду задания.
// Кейсы и гонки дают опыт по своей «весомости»: XP_CASE — за каждый открытый кейс по его разделу,
// у гонок — xp уровня в RACE_LEVELS (за победу вдвое больше).
const XP_FOR = { gig: 10, skill: 3, meet: 6, favor: 15, bizup: 8, daily_all: 25 };
const XP_CASE = { free: 3, cheap: 2, mid: 4, elite: 8 };
const XP_QUEST = { daily: 10, weekly: 30 };
// Опыта до следующего уровня растёт с каждым уровнем: 25 + 5·L + 0,1·L². ~30-й уровень — за неделю активной игры,
// 50-й (максимум) — для самых упорных.
const levelNeed = lv => Math.round(25 + 5 * lv + 0.1 * lv * lv);
const LEVEL_MAX = 50;
// Цвет уровня (значок и имя): с какого уровня какой
const LEVEL_COLORS = [[45, '#2ed3c6'], [35, '#e5484d'], [20, '#d4a84b'], [10, '#a970ff'], [5, '#4d9fff'], [1, '#9aa0a6']];
// Награда за уровень: месяц текущего дохода (не меньше LEVEL_MONEY_MIN); на круглых уровнях — ещё и билет
const LEVEL_MONEY_MONTHS = 1;
const LEVEL_MONEY_MIN = 20e3;
const LEVEL_TICKETS = { 5: 'car_used', 10: 'conn_district', 15: 'car_new', 20: 'home_new', 25: 'car_premium', 30: 'conn_club' };

// ---------- служба: силовики ----------
// Альтернатива «гражданской» карьере. Силовик не работает на обычной работе, не берёт подработки и не владеет
// бизнесом (госслужащим нельзя), зато получает звания, довольствие, «крышу» над бизнесами и задания.
// Уволился или сел — звание и выслуга сгорают, начинать службу заново.
const SERVICE_MIN_LEVEL = 5;
// payMult — к довольствию, bribeMult — к «неофициальным» деньгам, riskMult — к риску попасться,
// gibdd — с какого звания (индекс) ГИБДД отпускает без штрафа, force — силовые решения без проверки навыка,
// skills — два профильных навыка: для каждого звания их нужно подтянуть до sk из SERVICE_RANKS
const STRUCTURES = [
  { id: 'mvd', name: 'МВД', icon: '👮', payMult: 1,   bribeMult: 1,   riskMult: 1,   gibdd: 2, fineCut: 50, skills: ['fit', 'int'],
    perks: ['ГИБДД своих не штрафует — с лейтенанта', 'Штрафы по событиям вдвое меньше'] },
  { id: 'fsb', name: 'ФСБ', icon: '🕵️', payMult: 1.1, bribeMult: 1.3, riskMult: 0.7, gibdd: 3, skills: ['int', 'cha'],
    perks: ['«Благодарности» бизнесменов на 30% щедрее', 'Риск попасться на 30% ниже', 'ГИБДД не связывается — с капитана'] },
  { id: 'spn', name: 'Спецназ', icon: '🪖', payMult: 1.4, bribeMult: 0.8, riskMult: 1,   gibdd: 3, force: true, skills: ['fit', 'cha'],
    perks: ['Довольствие на 40% выше', 'Силовые решения в заданиях — без проверки физподготовки', 'ГИБДД не связывается — с капитана'] },
];
// Звания. h — часов службы на предыдущем звании (выслуга считается заново после каждого повышения и растёт от звания к званию), lv — уровень игрока, sk — уровень обоих профильных навыков структуры,
// xp — служебный опыт (за задания),
// pay — довольствие ₽/мес, roofs — сколько бизнесов можно держать под «крышей», tier — до какого бизнеса (индекс в BUSINESSES),
// perk / v — польза звания (как у связей, см. PERKS; действует и на всех следующих званиях), bonus — как это видит игрок.
// По сумме: майор — через 18 ч службы, полковник — через 2 суток, генерал — через неделю.
const SERVICE_RANKS = [
  { name: 'Рядовой',           h: 0,   lv: 5,  sk: 0 , xp: 0,    pay: 45e3,  roofs: 0, tier: -1 },
  { name: 'Сержант',           h: 2,   lv: 7,  sk: 2 , xp: 40,   pay: 60e3,  roofs: 1, tier: 0,  bonus: '«Крыша» над первым бизнесом' },
  { name: 'Лейтенант',         h: 3,   lv: 9,  sk: 4 , xp: 120,  pay: 90e3,  roofs: 1, tier: 1,  perk: 'skillCheap', v: 15, bonus: 'Ведомственные курсы: учёба дешевле на 15%' },
  { name: 'Капитан',           h: 5,   lv: 12, sk: 7 , xp: 250,  pay: 120e3, roofs: 2, tier: 3,  perk: 'callUp', v: 10, bonus: 'Вторая «крыша»; звонки связям помогают на 10% чаще' },
  { name: 'Майор',             h: 8,   lv: 15, sk: 10, xp: 420,  pay: 150e3, roofs: 2, tier: 4,  perk: 'meetCheap', v: 30, bonus: 'Оперативные встречи: связи обходятся на 30% дешевле' },
  { name: 'Подполковник',      h: 12,  lv: 18, sk: 13, xp: 650,  pay: 180e3, roofs: 2, tier: 5,  perk: 'fineCut', v: 50, bonus: 'Своих не трогают: штрафы и мелкие проблемы вдвое дешевле' },
  { name: 'Полковник',         h: 18,  lv: 21, sk: 16, xp: 950,  pay: 230e3, roofs: 3, tier: 7,  perk: 'trustUp', v: 30, bonus: 'Третья «крыша»; уважение: +30% доверия от встреч' },
  { name: 'Генерал-майор',     h: 26,  lv: 24, sk: 20, xp: 1300, pay: 350e3, roofs: 3, tier: 8,  perk: 'safe', v: 30, bonus: 'Неприкосновенность: риск сесть ниже на 30%' },
  { name: 'Генерал-лейтенант', h: 40,  lv: 27, sk: 24, xp: 1700, pay: 450e3, roofs: 4, tier: 9,  perk: 'osbCut', v: 50, bonus: 'Четвёртая «крыша»; свои люди в ОСБ: проверок вдвое меньше' },
  { name: 'Генерал',           h: 54,  lv: 30, sk: 28, xp: 2200, pay: 600e3, roofs: 4, tier: 11, perk: 'callUp', v: 100, bonus: 'Генеральский звонок: связи помогают всегда' },
];
// «Крыша»: бизнес платит долю цены в месяц, но не больше ROOF_CAP окладов звания на одну «крышу» —
// иначе у высоких званий доход улетал бы в миллиарды в час без единого вложения.
// Чем больше «крыш», тем чаще интересуется собственная безопасность (ОСБ).
const ROOF_RATE = 0.0085;
const ROOF_CAP = 10;
// У каждого бизнеса под «крышей» свой характер: rate — сколько платит (× к ROOF_RATE), risk — насколько
// привлекает проверки (× к OSB_PER_ROOF), fit — для какой структуры он «профильный»: там платит на ROOF_FIT больше.
// МВД — рынки, мойки, автосервисы; ФСБ — кофейни, логистика, IT; спецназ — спортзалы, производство, АЗС.
const ROOF_FIT = 0.3;
const ROOF_TRAITS = {
  b_shawarma:  { rate: 1.2, risk: 0.8, fit: 'mvd', note: 'наличные, мало вопросов' },
  b_tires:     { rate: 1.0, risk: 0.7, fit: 'mvd', note: 'тихий бизнес' },
  b_carwash:   { rate: 1.1, risk: 1.0, fit: 'mvd', note: 'наличка и мигранты' },
  b_coffee:    { rate: 0.9, risk: 0.7, fit: 'fsb', note: 'удобно встречаться' },
  b_bakery:    { rate: 1.0, risk: 0.8, fit: 'spn', note: 'стабильно, скучно' },
  b_service:   { rate: 1.3, risk: 1.3, fit: 'mvd', note: 'угнанные машины проходят мимо' },
  b_gym:       { rate: 1.0, risk: 0.9, fit: 'spn', note: 'свои люди' },
  b_furniture: { rate: 0.9, risk: 0.8, fit: 'spn', note: 'надёжно, но мало' },
  b_logistics: { rate: 1.4, risk: 1.5, fit: 'fsb', note: 'фуры, которые не досматривают' },
  b_gas:       { rate: 1.2, risk: 1.2, fit: 'spn', note: 'топливо и талоны' },
  b_factory:   { rate: 1.1, risk: 1.0, fit: 'spn', note: 'госзаказы' },
  b_it:        { rate: 1.0, risk: 1.6, fit: 'fsb', note: 'данные дороже денег' },
};
// Репутация — постоянная (не сгорает при увольнении): от −100 (взяточник) до +100 (честный). Для нового звания нужна ≥ 0. Чем хуже, тем чаще служебные проверки:
// в сутки их CHECKS_PER_DAY × 2^(−репутация/50): у взяточника 4 в сутки, у нейтрального 1, у честного одна за 4 дня.
const REP_MAX = 100;
const REP_HONEST = 8;                // честный выбор в задании
const REP_GOOD_MULT = 1.5;           // хорошие дела поднимают репутацию в полтора раза сильнее, чем плохие роняют
const REP_BRIBE = 8;                 // «взять деньги» — минус столько + 4 за каждый «месяц звания» в сумме
const REP_ROOF = 5;                  // взять бизнес под «крышу» (отпустить — вернуть столько же)
const CHECKS_PER_DAY = 1;
// Проверка находит нарушения с шансом: «крыши» × OSB_PER_ROOF + |плохая репутация| × OSB_PER_REP (%).
// Чисто — плюс служебный опыт и репутация. Нашли — занести, отдать «крышу» или пойти в отказ.
const OSB_PER_ROOF = 12;
const OSB_PER_REP = 0.4;
const OSB_CLEAN_XP = 20;
// «Занести кому надо» — столько месяцев дохода с «крыш» (3 реальных часа; не меньше 3 «месяцев звания»).
// У взяточника (4 проверки в сутки, находят почти всегда) это съедает ~40% дохода с «крыш», у честного — ~1%.
const OSB_PAYOFF_MONTHS = 24;
const OSB_DENY_JAIL = 30;            // пойти в отказ: шанс сесть, % (+ |плохая репутация| × OSB_PER_REP)
const SVC_SAFE_MAX = 50;             // связи и звания снижают риск сесть на службе не больше чем вдвое
// Уволился — вернуться на службу можно через SERVICE_COOLDOWN_H часов (20 минут), после суда — через SERVICE_JAIL_COOLDOWN_H.
const SERVICE_COOLDOWN_H = 1 / 3;          // 20 минут после увольнения
const SERVICE_JAIL_COOLDOWN_H = 72;
// Мелкий бизнес (до BUSINESSES[SERVICE_BIZ_TIER] включительно) можно держать до звания SERVICE_BIZ_UNTIL (капитан — уже нельзя).
const SERVICE_BIZ_TIER = 2;
const SERVICE_BIZ_UNTIL = 3;
// Гонки: до лейтенанта — на своих машинах («подпольные»), с капитана — только на служебной (ГИБДД не трогает),
// с полковника (SERVICE_NO_RACE) — никаких гонок: слишком много внимания. Зато мигалка: события с машиной обходят стороной.
const SERVICE_OWN_RACE_UNTIL = 3;
const SERVICE_NO_RACE = 6;
// Служебную продать нельзя; «списать на личное» — с репутацией не ниже 0 и не раньше SVC_WRITEOFF_H ч после выдачи,
// за SVC_WRITEOFF_RATE стоимости машины и SVC_WRITEOFF_PLATE_RATE номера: дороже, чем дала бы перепродажа (70% и 85%),
// так что списать и продать — всегда в минус. Списанные машину и номер нельзя продать SVC_SELL_LOCK_MIN минут.
// Новую служебную автобаза выдаёт через SVC_REISSUE_H ч (на любом звании, и генералу тоже) — другую модель того же уровня.
// Служебная машина — с сержанта; у каждой структуры своя линейка (как реально ездят в ведомствах),
// на вершине — у МВД Mercedes Pullman с флажками, у ФСБ Aurus Senat, у спецназа Aurus Komendant.
// Служебные выдаются отдельными вещами (svc: true, см. ниже): из кейсов не выпадают и в коллекцию не идут.
const SERVICE_CARS = {
  mvd: { 1: 'c_granta', 2: 'c_vesta', 3: 'c_camry', 4: 'c_k5',     5: 'c_eclass', 6: 'c_bmw7',  7: 'c_sclass', 8: 'c_lx',    9: 'c_maybach' },
  fsb: { 1: 'c_vesta',  2: 'c_k5',    3: 'c_camry', 4: 'c_a4',     5: 'c_eclass', 6: 'c_x5',    7: 'c_sclass', 8: 'c_arsenal', 9: 'c_aurus' },
  spn: { 1: 'c_niva',   2: 'c_uaz',   3: 'c_prado', 4: 'c_tiguan', 5: 'c_lc300',  6: 'c_g63',   7: 'c_range',  8: 'c_lx',    9: 'c_komendant' },
};
// Шансы редкости служебного номера (%): выпадает случайно, но чем выше звание, тем красивее.
// gov — генеральский госномер: всегда серии АМР или ЕКХ, а номер случайный из «блатных» 001–099.
const SERVICE_PLATES = {
  1: { common: 80, rare: 20 },
  2: { common: 60, rare: 35, epic: 5 },
  3: { common: 40, rare: 45, epic: 15 },
  4: { rare: 60, epic: 35, legendary: 5 },
  5: { rare: 45, epic: 45, legendary: 10 },
  6: { rare: 20, epic: 60, legendary: 18, mythic: 2 },
  7: { epic: 45, legendary: 45, mythic: 10 },
  8: { epic: 20, legendary: 60, mythic: 20 },
  9: { gov: true },
};
// Служебная версия машины: такая же, но своя вещь — svc_<модель>. Модели только для службы (svc: true) остаются как есть.
// Свой вид у служебной версии (с мигалками), если он отличается от обычной машины
const SVC_LOOK = { svc_sclass: { img: 'img/cars/svc_sclass_v52.webp', credit: undefined } };
const svcCarId = base => (ITEMS.find(i => i.id === base).svc ? base : 'svc_' + base.slice(2));
for (const line of Object.values(SERVICE_CARS)) for (const base of Object.values(line)) {
  const id = svcCarId(base);
  if (id === base || ITEMS.some(i => i.id === id)) continue;
  const b = ITEMS.find(i => i.id === base);
  ITEMS.push(Object.assign({}, b, { id, name: b.name + ' · служебная', svc: true }, SVC_LOOK[id] || {}));
  CAR_HP[id] = CAR_HP[base];
}
const SVC_WRITEOFF_H = 1;
const SVC_WRITEOFF_RATE = 0.85;
const SVC_WRITEOFF_PLATE_RATE = 0.95;
const SVC_REISSUE_H = 36;
const SVC_SELL_LOCK_MIN = 20;
// Попался — можно позвонить связи: шанс «замять» = RESCUE_BASE по редкости связи + RESCUE_PER_LV за каждый уровень доверия выше первого.
// Получилось — «благодарность» RESCUE_FEE денег и минус репутация, но звание и свобода при тебе. Нет — суд.
const RESCUE_BASE = { epic: 30, legendary: 40, mythic: 50 };
const RESCUE_PER_LV = 8;
const RESCUE_FEE = 0.1;
// Попался — суд: конфискация части денег, навыки проседают, со службы — уволен.
const JAIL_MONEY = 0.5;
const JAIL_SKILLS = 0.25;
// Задания службы: новое — раз в MISSION_EVERY_MIN минут. Деньги в выборах — в «месяцах звания»:
// довольствие + доход с самой дорогой доступной «крыши» (растут вместе со званием).
// xp — служебный опыт; money — деньги; risk — шанс сесть, %; need — проверка навыка (fail — что будет при провале).
const MISSION_EVERY_MIN = 20;
// ---------- спецзадания (вкладка «Спецзадания», только на службе) ----------
// Три вида заданий, у каждого свой откат SPEC_COOLDOWN_MIN минут: можно пройти все три подряд, потом ждать.
// Всё честно, без взяток. Справился — премия SPEC_MONEY окладов × качество выполнения, служебный опыт и репутация.
// Провалил — ни денег, ни опыта (а за задержанного невиновного или сорванный штурм — ещё и минус к репутации).
const SPEC_COOLDOWN_MIN = 20;
const SPEC_MONEY = 2;            // окладов (довольствие за «месяц») — премия, а не доход с «крыш»
const SPEC_XP = 90;
const SPEC_REP = 8;
const SPEC_FAIL_REP = { inv: -3, chase: 0, raid: -3 };
const SPEC_TYPES = {
  inv:   { name: 'Расследование', icon: '🔎', desc: 'Пять подозреваемых, до утра — четыре следственных действия. Собери улики и задержи того, кто это сделал.' },
  chase: { name: 'Перехват',      icon: '🚓', desc: 'Беглец мчит к выезду из города. Ставь посты на перекрёстках, пока он не прорвался к краю карты.' },
  raid:  { name: 'Штурм',         icon: '🛡️', desc: 'Пять дверей. Разведка говорит, что за каждой, но иногда путает. Под каждую угрозу — свой способ входа; сомневаешься — пусти дрон.' },
};
// Расследование: признаки подозреваемых и следственные действия, которые раскрывают признак преступника
const SUSPECT_NAMES = ['Гоша Шнырь', 'Валера Кабан', 'Стас Белый', 'Рустам Хан', 'Олег Монтана', 'Витя Пакет', 'Денис Ревизор', 'Лёха Бур',
  'Артур Тихий', 'Эдик Сварщик', 'Саня Профессор', 'Миша Гвоздь', 'Костя Бархат', 'Жора Шпала', 'Тимур Север', 'Игорь Сейф'];
const INV_ATTRS = [
  { k: 'height', act: 'Осмотреть место',     icon: 'search', vals: ['высокий', 'среднего роста', 'невысокий'], clue: v => `Следы обуви: преступник ${v}` },
  { k: 'hand',   act: 'Экспертиза почерка',   icon: 'writing',   vals: ['левша', 'правша'],                        clue: v => `Записка написана рукой: ${v}` },
  { k: 'car',    act: 'Запросить камеры',     icon: 'video',     vals: ['на машине', 'пешком'],                    clue: v => `Камеры: уехал ${v === 'пешком' ? 'не на машине, ушёл пешком' : 'на машине'}` },
  { k: 'place',  act: 'Биллинг телефона',     icon: 'phone',     vals: ['в баре', 'в спортзале', 'в офисе'],       clue: v => `Телефон до преступления был ${v}` },
];
const INV_TIME = 4;          // следственных действий до утра; ДНК-экспертиза стоит два
// Перехват: сетка города, посты на перекрёстках
const CHASE_SIZE = 9;
const CHASE_BLOCKS = 14;     // дома и тупики на старте
// Штурм: пять дверей, за каждой одна угроза. Разведка (точность растёт с интеллектом) иногда путает похожее:
// пусто ↔ растяжка, группа ↔ заложник, одиночка → группа. Дрон показывает точно.
// Каждый способ входа справляется с определёнными угрозами (ok). Не тот способ: заложник гибнет, иначе — боец ранен.
const RAID_ROOMS = 5;
const RAID_HP = 3;               // раненых до срыва штурма
const RAID_DRONES = 2;
const RAID_THREATS = {
  empty:   { w: 20, name: 'пусто',            hint: 'Тишина — похоже, пусто' },
  single:  { w: 25, name: 'один бандит',      hint: 'Слышен один голос' },
  group:   { w: 25, name: 'банда',            hint: 'Несколько голосов, звон бутылок' },
  hostage: { w: 20, name: 'заложник',         hint: 'Плач и крики — там заложник' },
  trap:    { w: 10, name: 'растяжка',         hint: 'У двери странный провод' },
};
const RAID_CONFUSE = { empty: 'trap', trap: 'empty', group: 'hostage', hostage: 'group', single: 'group' };
const RAID_ACTIONS = {
  quiet:  { name: 'Тихий вход',   icon: 'shoe',            ok: ['empty', 'single', 'hostage'] },
  storm:  { name: 'Штурм',        icon: 'shield',          ok: ['empty', 'single', 'group'] },
  flash:  { name: 'Светошумовая', icon: 'bolt',  limit: 2, ok: ['empty', 'single', 'group', 'hostage'] },
  sapper: { name: 'Сапёр',        icon: 'tool',  limit: 1, ok: ['empty', 'trap'] },
};
const MISSIONS = [
  { id: 'm_pocket', who: ['mvd'], title: 'Карманник в метро', text: 'Взяли карманника с чужим кошельком. Он шепчет, что «может решить вопрос на месте».',
    choices: [{ t: 'Оформить по закону', xp: 30 }, { t: 'Взять и отпустить', money: 0.5, risk: 4, xp: 5 }] },
  { id: 'm_drunk', who: ['mvd'], title: 'Пьяный дебошир', text: 'В баре буянит здоровяк, охрана не справляется.',
    choices: [{ t: 'Скрутить самому', need: { fit: 8 }, xp: 45, fail: { xp: 10, text: 'Здоровяк оказался крепче. Скрутили всем нарядом, а тебе — выговор.' } }, { t: 'Вызвать подкрепление', xp: 25 }] },
  { id: 'm_market', who: ['mvd', 'fsb'], title: 'Палёный алкоголь', text: 'На рынке торгуют палёной водкой. Хозяин точки предлагает «договориться» каждый месяц.',
    choices: [{ t: 'Изъять партию', xp: 40 }, { t: 'Договориться', money: 1, risk: 6, xp: 5 }] },
  { id: 'm_dtp', who: ['mvd'], title: 'ДТП с «важным» человеком', text: 'Сын депутата протаранил остановку. Отец звонит и обещает «не забыть».',
    choices: [{ t: 'Оформить как есть', xp: 60 }, { t: 'Потерять протокол', money: 3, risk: 10, xp: 0 }] },
  { id: 'm_spy', who: ['fsb'], title: 'Утечка в НИИ', text: 'Из закрытого НИИ уходят чертежи. Есть подозреваемый.',
    choices: [{ t: 'Неделю вести слежку', need: { int: 12 }, xp: 70, fail: { xp: 15, text: 'Подозреваемый заметил хвост и залёг на дно.' } }, { t: 'Задержать сразу', xp: 30 }] },
  { id: 'm_cash', who: ['fsb'], title: 'Обналичка', text: 'Фирма-однодневка гоняет миллионы. Владелец просит «не замечать» за процент.',
    choices: [{ t: 'Передать дело в суд', xp: 50 }, { t: 'Не заметить', money: 2.5, risk: 8, xp: 0 }] },
  { id: 'm_tender', who: ['fsb'], title: 'Госзаказ', text: 'Бизнесмен хочет выиграть тендер и предлагает «долю» за нужный звонок.',
    choices: [{ t: 'Отказать и доложить', xp: 45 }, { t: 'Сделать звонок', money: 4, risk: 12, xp: 0 }] },
  { id: 'm_hostage', who: ['spn'], title: 'Захват заложников', text: 'В банке заложники. Группа ждёт твоего решения.',
    choices: [{ t: 'Штурм', need: { fit: 15 }, xp: 80, fail: { xp: 20, text: 'Штурм затянулся — заложников вывели, но премию урезали.' } }, { t: 'Переговоры', need: { cha: 10 }, xp: 60, fail: { xp: 15, text: 'Переговоры сорвались, пришлось штурмовать без плана.' } }] },
  { id: 'm_raid', who: ['spn', 'mvd'], title: 'Рейд на склад', text: 'На складе — контрабанда. Хозяин склада предлагает сумку денег, чтобы рейд «ничего не нашёл».',
    choices: [{ t: 'Провести рейд', need: { fit: 10 }, xp: 55, fail: { xp: 15, text: 'Охрана склада оказала сопротивление, половина товара ушла.' } }, { t: 'Взять сумку', money: 2, risk: 10, xp: 0 }] },
  { id: 'm_escort', who: ['spn'], title: 'Сопровождение груза', text: 'Нужно сопроводить инкассаторов через полстраны.',
    choices: [{ t: 'Сопроводить', xp: 40, money: 0.3 }, { t: 'Отправить новичков', xp: 10 }] },
  { id: 'm_biz', who: ['mvd', 'fsb', 'spn'], title: 'Просьба бизнесмена', text: 'Знакомый бизнесмен просит «присмотреть» за конкурентом — устроить ему проверку.',
    choices: [{ t: 'Отказать', xp: 20 }, { t: 'Устроить проверку', money: 1.5, risk: 7, xp: 0 }] },
  { id: 'm_award', who: ['mvd', 'fsb', 'spn'], title: 'Учения', text: 'Плановые учения. Начальство смотрит, кто как себя покажет.',
    choices: [{ t: 'Выложиться на полную', need: { fit: 6 }, xp: 50, fail: { xp: 15, text: 'Не хватило выносливости — середнячок.' } }, { t: 'Отработать спокойно', xp: 25 }] },
];

// ---------- бесплатные кейсы растут вместе с игроком ----------
// Ежедневный кейс: набор вещей зависит от статуса (индекс в RANKS) — от «копейки» до машин бизнес-класса.
const FREE_TIERS = [
  { rank: 0, items: ['c_2101', 'c_2107', 'c_2109', 'c_moskvich', 'h_bed', 'h_garage'] },
  { rank: 2, items: ['c_logan', 'c_granta', 'c_lancerx', 'c_leaf', 'c_focus', 'c_largus', 'h_bed', 'h_garage', 'h_dacha', 'h_village'] },
  { rank: 4, items: ['c_granta', 'c_polo', 'c_vesta', 'c_solaris', 'c_rio', 'c_octavia', 'c_corolla', 'c_markii', 'c_ae86', 'h_dacha', 'h_village', 'h_room', 'h_studio', 'h_brezh'] },
  { rank: 6, items: ['c_solaris', 'c_rio', 'c_camry', 'c_k5', 'c_tiguan', 'c_350z', 'c_mini', 'c_eclass', 'h_room', 'h_studio', 'h_flat', 'h_newflat', 'h_house', 'c_passat', 'c_a4', 'h_kazan'] },
];
// Связи появляются в «Знакомстве дня», когда они игроку уже полезны (минимальный статус)
const CONN_MIN_RANK = {
  k_police: 0, k_gibdd: 0, k_zhkh: 0,
  k_banker: 2, k_tax: 2, k_official: 3,
  k_prosecutor: 4, k_judge: 4,
  k_deputy: 5, k_governor: 5,
  k_oligarch: 6, k_minister: 6,
};

// ---------- казино ----------
// Ставка — не больше CASINO_MAX_SHARE от баланса. Все игры с небольшим преимуществом казино, как в жизни.
const CASINO_MAX_SHARE = 0.5;
const CASINO_MIN_BET = 1000;
const ROULETTE_STREAK_CAP = 4;   // ставки 1:1 в рулетке: не больше стольких побед подряд
// Видеопокер «Валеты и выше»: выплата × ставка
const POKER_PAYTABLE = [
  { id: 'royal', name: 'Роял-флэш', pay: 250 },
  { id: 'sflush', name: 'Стрит-флэш', pay: 50 },
  { id: 'four', name: 'Каре', pay: 25 },
  { id: 'full', name: 'Фулл-хаус', pay: 9 },
  { id: 'flush', name: 'Флэш', pay: 6 },
  { id: 'straight', name: 'Стрит', pay: 4 },
  { id: 'three', name: 'Сет', pay: 3 },
  { id: 'twopair', name: 'Две пары', pay: 2 },
  { id: 'jacks', name: 'Пара валетов или выше', pay: 1 },
];
