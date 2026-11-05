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
//      home — bonus = ₽/мес аренды (работает всё жильё, копии складываются)
// value — рыночная стоимость (продаётся за SELL_RATE от неё)
// t — темы для тематических кейсов (ru, jp, de, cn, sc — машины; msk, country, abroad — жильё)
// img — путь к картинке; если не указан, показывается icon
// credit — автор и лицензия фото (показываются на экране «Авторы фото»)
const ITEMS = [
  { id: 'c_2107',     cat: 'car', name: 'ВАЗ-2107',              icon: '🚗', rarity: 'common',    bonus: 2,  t: ['ru'], value: 150e3,
    img: 'img/cars/c_2107.png', credit: 'Charles01 · CC BY-SA 3.0' },
  { id: 'c_matiz',    cat: 'car', name: 'Daewoo Matiz',          icon: '🚗', rarity: 'common',    bonus: 2,  t: ['ru'], value: 250e3,
    img: 'img/cars/c_matiz.png', credit: 'Toreodor · CC BY 4.0' },
  { id: 'c_granta',   cat: 'car', name: 'Lada Granta',           icon: '🚗', rarity: 'common',    bonus: 3,  t: ['ru'], value: 900e3,
    img: 'img/cars/c_granta.png', credit: 'Ilya Plekhanov · CC BY-SA 4.0' },
  { id: 'c_solaris',  cat: 'car', name: 'Hyundai Solaris',       icon: '🚙', rarity: 'common',    bonus: 4,  value: 1.5e6,
    img: 'img/cars/c_solaris.png', credit: 'gleb · CC BY 4.0' },
  { id: 'c_rio',      cat: 'car', name: 'Kia Rio',               icon: '🚙', rarity: 'common',    bonus: 4,  value: 1.6e6,
    img: 'img/cars/c_rio.png', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_k5',       cat: 'car', name: 'Kia K5',                icon: '🚘', rarity: 'rare',      bonus: 8,  value: 3.2e6,
    img: 'img/cars/c_k5.png', credit: 'Elise240SX · CC BY-SA 4.0' },
  { id: 'c_camry',    cat: 'car', name: 'Toyota Camry',          icon: '🚘', rarity: 'rare',      bonus: 8,  t: ['jp'], value: 3.8e6,
    img: 'img/cars/c_camry.png', credit: 'EurovisionNim · CC BY-SA 4.0' },
  { id: 'c_tiguan',   cat: 'car', name: 'Volkswagen Tiguan',     icon: '🚙', rarity: 'rare',      bonus: 10, t: ['de'], value: 4.5e6,
    img: 'img/cars/c_tiguan.png', credit: 'Alexander-93 · CC BY-SA 4.0' },
  { id: 'c_eclass',   cat: 'car', name: 'Mercedes-Benz E-класс', icon: '🚘', rarity: 'epic',      bonus: 15, t: ['de'], value: 9e6,
    img: 'img/cars/c_eclass.png', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_m5',       cat: 'car', name: 'BMW M5',                icon: '🏎️', rarity: 'epic',      bonus: 17, t: ['de'], value: 18e6,
    img: 'img/cars/c_m5.png', credit: 'Alexander Migl · CC BY-SA 4.0' },
  { id: 'c_rs6',      cat: 'car', name: 'Audi RS6',              icon: '🚘', rarity: 'epic',      bonus: 18, t: ['de'], value: 20e6,
    img: 'img/cars/c_rs6.png', credit: 'Mr.choppers · CC BY-SA 3.0' },
  { id: 'c_911',      cat: 'car', name: 'Porsche 911',           icon: '🏎️', rarity: 'legendary', bonus: 30, t: ['de','sc'], value: 25e6,
    img: 'img/cars/c_911.png', credit: 'Alexander Migl · CC BY-SA 4.0' },
  { id: 'c_g63',      cat: 'car', name: 'Mercedes-AMG G63',      icon: '🚙', rarity: 'legendary', bonus: 32, t: ['de'], value: 28e6,
    img: 'img/cars/c_g63.png', credit: 'Charles from Port Chester · CC BY 2.0' },
  { id: 'c_urus',     cat: 'car', name: 'Lamborghini Urus',      icon: '🏎️', rarity: 'legendary', bonus: 35, t: ['sc'], value: 40e6,
    img: 'img/cars/c_urus.png', credit: 'Alexander Migl · CC BY-SA 4.0' },
  { id: 'c_cullinan', cat: 'car', name: 'Rolls-Royce Cullinan',  icon: '🚘', rarity: 'mythic',    bonus: 55, value: 70e6,
    img: 'img/cars/c_cullinan.png', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_chiron',   cat: 'car', name: 'Bugatti Chiron',        icon: '🏎️', rarity: 'mythic',    bonus: 60, t: ['sc'], value: 350e6,
    img: 'img/cars/c_chiron.png', credit: 'MrWalkr · CC BY-SA 4.0' },

  { id: 'c_2109', cat: 'car', name: 'ВАЗ-2109', icon: '🚗', rarity: 'common', bonus: 2, t: ['ru'], value: 120e3,
    img: 'img/cars/c_2109.png', credit: 'Torsten Maue · CC BY 2.0' },
  { id: 'c_niva', cat: 'car', name: 'Lada Niva Legend', icon: '🚙', rarity: 'common', bonus: 3, t: ['ru'], value: 1.1e6,
    img: 'img/cars/c_niva.png', credit: 'TTTNIS · Public domain' },
  { id: 'c_vesta', cat: 'car', name: 'Lada Vesta', icon: '🚗', rarity: 'common', bonus: 4, t: ['ru'], value: 1.5e6,
    img: 'img/cars/c_vesta.png', credit: 'Throwawayacc222 · CC0' },
  { id: 'c_logan', cat: 'car', name: 'Renault Logan', icon: '🚗', rarity: 'common', bonus: 3, value: 900e3,
    img: 'img/cars/c_logan.png', credit: 'Mihnea Lazăr · CC BY-SA 4.0' },
  { id: 'c_polo', cat: 'car', name: 'Volkswagen Polo', icon: '🚗', rarity: 'common', bonus: 3, t: ['de'], value: 1.4e6,
    img: 'img/cars/c_polo.png', credit: 'M 93 · CC BY-SA 3.0 de' },
  { id: 'c_jolion', cat: 'car', name: 'Haval Jolion', icon: '🚙', rarity: 'common', bonus: 4, t: ['cn'], value: 2.2e6,
    img: 'img/cars/c_jolion.png', credit: 'User3204 · CC BY-SA 4.0' },
  { id: 'c_octavia', cat: 'car', name: 'Skoda Octavia', icon: '🚘', rarity: 'rare', bonus: 8, t: ['de'], value: 3e6,
    img: 'img/cars/c_octavia.png', credit: 'Mike-fiesta · CC BY-SA 4.0' },
  { id: 'c_tiggo', cat: 'car', name: 'Chery Tiggo 7 Pro', icon: '🚙', rarity: 'rare', bonus: 8, t: ['cn'], value: 2.8e6,
    img: 'img/cars/c_tiggo.png', credit: 'JustAnotherCarDesigner · CC BY-SA 4.0' },
  { id: 'c_mazda6', cat: 'car', name: 'Mazda 6', icon: '🚘', rarity: 'rare', bonus: 8, t: ['jp'], value: 3.5e6,
    img: 'img/cars/c_mazda6.png', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_xtrail', cat: 'car', name: 'Nissan X-Trail', icon: '🚙', rarity: 'rare', bonus: 8, t: ['jp'], value: 3.6e6,
    img: 'img/cars/c_xtrail.png', credit: 'Alexander-93 · CC BY-SA 4.0' },
  { id: 'c_rav4', cat: 'car', name: 'Toyota RAV4', icon: '🚙', rarity: 'rare', bonus: 9, t: ['jp'], value: 4.2e6,
    img: 'img/cars/c_rav4.png', credit: 'Mr.choppers · CC BY-SA 4.0' },
  { id: 'c_monjaro', cat: 'car', name: 'Geely Monjaro', icon: '🚙', rarity: 'rare', bonus: 10, t: ['cn'], value: 4.6e6,
    img: 'img/cars/c_monjaro.png', credit: 'Milhouse35 · CC BY-SA 4.0' },
  { id: 'c_lc300', cat: 'car', name: 'Toyota Land Cruiser 300', icon: '🚙', rarity: 'epic', bonus: 16, t: ['jp'], value: 13e6,
    img: 'img/cars/c_lc300.png', credit: 'Autosdeprimera · CC BY 3.0' },
  { id: 'c_x5', cat: 'car', name: 'BMW X5', icon: '🚙', rarity: 'epic', bonus: 16, t: ['de'], value: 14e6,
    img: 'img/cars/c_x5.png', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_cayenne', cat: 'car', name: 'Porsche Cayenne', icon: '🚙', rarity: 'epic', bonus: 17, t: ['de'], value: 15e6,
    img: 'img/cars/c_cayenne.png', credit: 'M 93 · CC BY-SA 3.0 de' },
  { id: 'c_gtr', cat: 'car', name: 'Nissan GT-R', icon: '🏎️', rarity: 'epic', bonus: 17, t: ['jp', 'sc'], value: 16e6,
    img: 'img/cars/c_gtr.png', credit: 'OSX · Public domain' },
  { id: 'c_sclass', cat: 'car', name: 'Mercedes-Benz S-класс', icon: '🚘', rarity: 'epic', bonus: 18, t: ['de'], value: 20e6,
    img: 'img/cars/c_sclass.png', credit: 'Alexander Migl · CC BY-SA 4.0' },
  { id: 'c_lx', cat: 'car', name: 'Lexus LX 600', icon: '🚙', rarity: 'epic', bonus: 18, t: ['jp'], value: 22e6,
    img: 'img/cars/c_lx.png', credit: 'Kevauto · CC BY-SA 4.0' },
  { id: 'c_bentley', cat: 'car', name: 'Bentley Continental GT', icon: '🏎️', rarity: 'legendary', bonus: 32, value: 33e6,
    img: 'img/cars/c_bentley.png', credit: 'Alexandre Prevot · CC BY-SA 2.0' },
  { id: 'c_mclaren', cat: 'car', name: 'McLaren 720S', icon: '🏎️', rarity: 'legendary', bonus: 34, t: ['sc'], value: 36e6,
    img: 'img/cars/c_mclaren.png', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_ferrari', cat: 'car', name: 'Ferrari 296 GTB', icon: '🏎️', rarity: 'legendary', bonus: 35, t: ['sc'], value: 38e6,
    img: 'img/cars/c_ferrari.png', credit: 'Max Baillie · CC BY-SA 4.0' },
  { id: 'c_aventador', cat: 'car', name: 'Lamborghini Aventador', icon: '🏎️', rarity: 'mythic', bonus: 56, t: ['sc'], value: 60e6,
    img: 'img/cars/c_aventador.png', credit: 'Calreyn88 · CC BY-SA 4.0' },
  { id: 'c_phantom', cat: 'car', name: 'Rolls-Royce Phantom', icon: '🚘', rarity: 'mythic', bonus: 57, value: 65e6,
    img: 'img/cars/c_phantom.png', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_huayra', cat: 'car', name: 'Pagani Huayra', icon: '🏎️', rarity: 'mythic', bonus: 60, t: ['sc'], value: 300e6,
    img: 'img/cars/c_huayra.png', credit: 'Matti Blume · CC BY-SA 4.0' },
  { id: 'c_jesko', cat: 'car', name: 'Koenigsegg Jesko', icon: '🏎️', rarity: 'mythic', bonus: 60, t: ['sc'], value: 320e6,
    img: 'img/cars/c_jesko.png', credit: 'Matti Blume · CC BY-SA 4.0' },
  { id: 'h_garage', cat: 'home', name: 'Гараж',                    icon: '🅿️', rarity: 'common',    bonus: 4e3,  value: 600e3,
    img: 'img/homes/h_garage.jpg', credit: 'Celest · CC BY 4.0' },
  { id: 'h_bed',    cat: 'home', name: 'Койка в общаге',           icon: '🛏️', rarity: 'common',    bonus: 5e3,  value: 400e3,
    img: 'img/homes/h_bed.jpg', credit: 'Sgroey · CC BY 4.0' },
  { id: 'h_room',   cat: 'home', name: 'Комната в коммуналке',     icon: '🚪', rarity: 'common',    bonus: 15e3, t: ['msk'], value: 2.5e6,
    img: 'img/homes/h_room.jpg', credit: 'Corey Taratuta · CC BY 2.0' },
  { id: 'h_studio', cat: 'home', name: 'Студия',                   icon: '🏢', rarity: 'rare',      bonus: 40e3, t: ['msk'], value: 7e6,
    img: 'img/homes/h_studio.jpg', credit: 'Lo · CC0' },
  { id: 'h_flat',   cat: 'home', name: 'Однушка в спальнике',      icon: '🏬', rarity: 'rare',      bonus: 45e3, t: ['msk'], value: 9e6,
    img: 'img/homes/h_flat.jpg', credit: '3dfxVoodoo3 · CC BY-SA 4.0' },
  { id: 'h_house',  cat: 'home', name: 'Загородный дом',           icon: '🏡', rarity: 'epic',      bonus: 90e3,  t: ['country'], value: 18e6,
    img: 'img/homes/h_house.jpg', credit: 'Stoljaroff · Public domain' },
  { id: 'h_town',   cat: 'home', name: 'Таунхаус',                 icon: '🏘️', rarity: 'epic',      bonus: 120e3, t: ['country'], value: 25e6,
    img: 'img/homes/h_town.jpg', credit: 'Aplomado · CC BY-SA 3.0' },
  { id: 'h_city',   cat: 'home', name: 'Апартаменты в Москва-Сити', icon: '🏙️', rarity: 'legendary', bonus: 600e3, t: ['msk'], value: 120e6,
    img: 'img/homes/h_city.jpg', credit: 'Pasquale Paolo Cardo · CC BY 2.0' },
  { id: 'h_pent',   cat: 'home', name: 'Пентхаус',                 icon: '🌆', rarity: 'legendary', bonus: 700e3, t: ['msk'], value: 150e6,
    img: 'img/homes/h_pent.jpg', credit: 'Hu Totya · CC BY 3.0' },
  { id: 'h_hotel',  cat: 'home', name: 'Мини-отель',               icon: '🏨', rarity: 'legendary', bonus: 1.5e6, value: 200e6,
    img: 'img/homes/h_hotel.jpg', credit: 'denisbin · CC BY-SA 2.0' },
  { id: 'h_castle', cat: 'home', name: 'Замок',                    icon: '🏰', rarity: 'mythic',    bonus: 6e6,  t: ['abroad'], value: 1.5e9,
    img: 'img/homes/h_castle.jpg', credit: 'Thomas Wolf, www.foto-tw.de · CC BY-SA 3.0 de' },
  { id: 'h_island', cat: 'home', name: 'Частный остров',           icon: '🏝️', rarity: 'mythic',    bonus: 10e6, t: ['abroad'], value: 2.5e9,
    img: 'img/homes/h_island.jpg', credit: 'Matheenfaiz · CC BY-SA 4.0' },

  { id: 'h_dacha', cat: 'home', name: 'Дача в СНТ', icon: '🏡', rarity: 'common', bonus: 6e3, t: ['country'], value: 1.2e6,
    img: 'img/homes/h_dacha.jpg', credit: 'Figure · CC BY-SA 3.0' },
  { id: 'h_village', cat: 'home', name: 'Дом в деревне', icon: '🛖', rarity: 'common', bonus: 8e3, t: ['country'], value: 1.8e6,
    img: 'img/homes/h_village.jpg', credit: 'A.Savin · FAL' },
  { id: 'h_batumi', cat: 'home', name: 'Квартира в Батуми', icon: '🏙️', rarity: 'common', bonus: 25e3, t: ['abroad'], value: 5e6,
    img: 'img/homes/h_batumi.jpg', credit: 'U.S. Navy · Public domain' },
  { id: 'h_alanya', cat: 'home', name: 'Квартира в Алании', icon: '🏖️', rarity: 'rare', bonus: 45e3, t: ['abroad'], value: 9e6,
    img: 'img/homes/h_alanya.jpg', credit: 'Ozgurmulazimoglu · CC BY-SA 3.0' },
  { id: 'h_sochi', cat: 'home', name: 'Квартира в Сочи', icon: '🌴', rarity: 'rare', bonus: 60e3, value: 12e6,
    img: 'img/homes/h_sochi.jpg', credit: 'Trace · CC BY-SA 4.0' },
  { id: 'h_newflat', cat: 'home', name: 'Двушка в новостройке', icon: '🏢', rarity: 'rare', bonus: 65e3, t: ['msk'], value: 14e6,
    img: 'img/homes/h_newflat.jpg', credit: 'R Sones · CC BY-SA 2.0' },
  { id: 'h_cottage', cat: 'home', name: 'Коттедж в английской деревне', icon: '🏡', rarity: 'epic', bonus: 150e3, t: ['abroad', 'country'], value: 40e6,
    img: 'img/homes/h_cottage.jpg', credit: 'Philip Halling · CC BY-SA 2.0' },
  { id: 'h_dubai_apt', cat: 'home', name: 'Апартаменты в Дубай Марине', icon: '🌇', rarity: 'epic', bonus: 230e3, t: ['abroad'], value: 40e6,
    img: 'img/homes/h_dubai_apt.jpg', credit: 'Norlando Pobre · CC BY 2.0' },
  { id: 'h_patriki', cat: 'home', name: 'Квартира на Патриарших', icon: '🏛️', rarity: 'epic', bonus: 220e3, t: ['msk'], value: 45e6,
    img: 'img/homes/h_patriki.jpg', credit: 'A.Savin · FAL' },
  { id: 'h_palm', cat: 'home', name: 'Вилла на Пальме Джумейра', icon: '🌴', rarity: 'legendary', bonus: 1.3e6, t: ['abroad'], value: 250e6,
    img: 'img/homes/h_palm.jpg', credit: 'NASA, экипаж МКС-22 · Public domain' },
  { id: 'h_london', cat: 'home', name: 'Квартира в Мейфэре, Лондон', icon: '🎡', rarity: 'legendary', bonus: 1.5e6, t: ['abroad'], value: 300e6,
    img: 'img/homes/h_london.jpg', credit: 'Millennium Hotel London Mayfair · Public domain' },
  { id: 'h_rublyovka', cat: 'home', name: 'Особняк на Рублёвке', icon: '🏰', rarity: 'legendary', bonus: 1.8e6, t: ['country'], value: 400e6,
    img: 'img/homes/h_rublyovka.jpg', credit: 'A.Savin · CC BY-SA 3.0' },
  { id: 'h_riviera', cat: 'home', name: 'Вилла на Лазурном берегу', icon: '⛵', rarity: 'mythic', bonus: 9e6, t: ['abroad'], value: 2e9,
    img: 'img/homes/h_riviera.jpg', credit: 'Tangopaso · Public domain' },
  { id: 'h_monaco', cat: 'home', name: 'Пентхаус в Монако', icon: '🎰', rarity: 'mythic', bonus: 12e6, t: ['abroad'], value: 3e9,
    img: 'img/homes/h_monaco.jpg', credit: 'Tobi 87 · CC BY-SA 3.0' },


  // Связи: cat conn, perk — что даёт (см. PERKS), lv — сила по уровню доверия 1–5,
  // special — особая услуга на максимальном доверии (см. SPECIALS)
  { id: 'k_police',   cat: 'conn', name: 'Участковый Петрович',     icon: '👮',   rarity: 'common',    perk: 'fineCut',    lv: [20, 30, 40, 50, 60], special: { type: 'closeEvent' } },
  { id: 'k_gibdd',    cat: 'conn', name: 'Инспектор ГИБДД',         icon: '🚓',   rarity: 'common',    perk: 'gibdd',      lv: [1, 1, 1, 1, 1], special: { type: 'cash', hours: 3 } },
  { id: 'k_zhkh',     cat: 'conn', name: 'Начальница ЖКХ',          icon: '🧹',   rarity: 'common',    perk: 'rentUp',     lv: [3, 5, 7, 9, 12], special: { type: 'cash', hours: 4 } },
  { id: 'k_tax',      cat: 'conn', name: 'Налоговый инспектор',     icon: '🧾',   rarity: 'rare',      perk: 'taxCut',     lv: [2, 3, 4, 5, 7], special: { type: 'taxHoliday', hours: 24 } },
  { id: 'k_official', cat: 'conn', name: 'Чиновник мэрии',          icon: '🏛️',   rarity: 'rare',      perk: 'license',    lv: [20, 30, 40, 55, 70], special: { type: 'cash', hours: 8 } },
  { id: 'k_banker',   cat: 'conn', name: 'Банкир',                  icon: '🏦',   rarity: 'rare',      perk: 'sellUp',     lv: [3, 4, 6, 8, 10], special: { type: 'cash', hours: 12 } },
  { id: 'k_prosecutor', cat: 'conn', name: 'Прокурор',              icon: '⚖️',   rarity: 'epic',      perk: 'safe',       lv: [20, 35, 50, 75, 100], special: { type: 'closeEvent' } },
  { id: 'k_judge',    cat: 'conn', name: 'Судья',                   icon: '👨‍⚖️', rarity: 'epic',      perk: 'court',      lv: [1, 1, 1, 1, 1], special: { type: 'closeEvent' } },
  { id: 'k_deputy',   cat: 'conn', name: 'Депутат',                 icon: '🎩',   rarity: 'legendary', perk: 'demandUp',   lv: [5, 8, 11, 15, 20], special: { type: 'tender', hours: 20 } },
  { id: 'k_governor', cat: 'conn', name: 'Губернатор',              icon: '🏢',   rarity: 'legendary', perk: 'licenseCut', lv: [30, 45, 60, 75, 90], special: { type: 'tender', hours: 20 } },
  { id: 'k_oligarch', cat: 'conn', name: 'Олигарх',                 icon: '💼',   rarity: 'mythic',    perk: 'deal',       lv: [20, 25, 30, 40, 50], special: { type: 'cash', hours: 24 } },
  { id: 'k_minister', cat: 'conn', name: 'Министр экономики',       icon: '🕴️',   rarity: 'mythic',    perk: 'bizBoost',   lv: [10, 13, 16, 20, 25], special: { type: 'tender', hours: 40 } },
];

// Шансы редкостей в процентах (сумма 100) для ценовых категорий кейсов
const W_CHEAP = { common: 80, rare: 17, epic: 2.5, legendary: 0.45, mythic: 0.05 };
const W_MID   = { common: 35, rare: 45, epic: 15,  legendary: 4.5,  mythic: 0.5 };
const W_ELITE = { common: 0,  rare: 0,  epic: 60,  legendary: 32,   mythic: 8 };

// tag — тематический кейс: выпадают только предметы с этой темой
// Цена кейса — чуть ниже средней рыночной стоимости выпадающего:
// держать выгодно, а сразу продавать (за 70%) в среднем убыточно.
// group — заголовок раздела на экране кейсов
const CASES = [
  { id: 'free', cover: 'img/cases/free.jpg', credit: 'Wikimedia Commons · Public domain', group: 'Бесплатно', name: 'Ежедневный', icon: '🎁', price: 0, cooldown: 24 * 3600e3,
    cats: ['car', 'home'], desc: 'Раз в сутки: машина или жильё', w: W_CHEAP },

  { id: 'car_used', cover: 'img/cases/car_used.jpg', credit: '293.xx.xxx.xx · CC BY-SA 3.0',  group: '🚗 Авто', name: 'Авторынок б/у',      icon: '🚗', price: 2e6, cats: ['car'], desc: 'В основном народные машины', w: W_CHEAP },
  { id: 'car_new', cover: 'img/cases/car_new.jpg', credit: 'Swoodchatla · CC BY-SA 3.0',   group: '🚗 Авто', name: 'Автосалон',          icon: '🚘', price: 6.5e6, cats: ['car'], desc: 'Бизнес-класс и шанс на спорткар', w: W_MID },
  { id: 'car_elite', cover: 'img/cases/car_elite.jpg', credit: 'Rex Gray from Southern California · CC BY 2.0', group: '🚗 Авто', name: 'Элитный автосалон',  icon: '🏎️', price: 35e6,  cats: ['car'], desc: 'Только эпик и выше', w: W_ELITE },
  { id: 'car_ru', cover: 'img/cases/car_ru.jpg', credit: 'ShinePhantom · CC BY-SA 3.0',    group: '🚗 Авто: тематические', name: 'Отечественный автопром', icon: '🇷🇺', price: 650e3, cats: ['car'], tag: 'ru', desc: 'Жигули, Нива, Веста — дёшево и сердито', w: W_CHEAP },
  { id: 'car_cn', cover: 'img/cases/car_cn.jpg', credit: 'N509FZ · CC BY-SA 4.0',    group: '🚗 Авто: тематические', name: 'Китайцы',               icon: '🇨🇳', price: 2.9e6, cats: ['car'], tag: 'cn', desc: 'Haval, Chery, Geely', w: W_MID },
  { id: 'car_jp', cover: 'img/cases/car_jp.jpg', credit: 'TTTNIS · CC0',    group: '🚗 Авто: тематические', name: 'Японцы',                icon: '🇯🇵', price: 7e6,   cats: ['car'], tag: 'jp', desc: 'Toyota, Nissan, Mazda, Lexus', w: W_MID },
  { id: 'car_de', cover: 'img/cases/car_de.jpg', credit: 'Diego Delso · CC BY-SA 3.0',    group: '🚗 Авто: тематические', name: 'Немецкое качество',     icon: '🇩🇪', price: 5.5e6,   cats: ['car'], tag: 'de', desc: 'BMW, Mercedes, Audi, Porsche', w: W_MID },
  { id: 'car_sc', cover: 'img/cases/car_sc.jpg', credit: 'Axion23 · CC BY 2.0',    group: '🚗 Авто: тематические', name: 'Суперкары',             icon: '🏁', price: 40e6,  cats: ['car'], tag: 'sc', desc: 'Ferrari, Lamborghini, Pagani, Koenigsegg', w: W_ELITE },

  { id: 'home_used', cover: 'img/cases/home_used.jpg', credit: 'Andreas Wolf 01 · CC BY-SA 4.0',  group: '🏠 Жильё', name: 'Вторичка',              icon: '🏚️', price: 6e6,   cats: ['home'], desc: 'Комнаты, гаражи, иногда квартиры', w: W_CHEAP },
  { id: 'home_new', cover: 'img/cases/home_new.jpg', credit: 'Anneli Vaniala · CC BY-SA 4.0',   group: '🏠 Жильё', name: 'Новостройки',           icon: '🏗️', price: 30e6,  cats: ['home'], desc: 'Квартиры и загородные дома', w: W_MID },
  { id: 'home_elite', cover: 'img/cases/home_elite.jpg', credit: 'mos.ru · CC BY 4.0', group: '🏠 Жильё', name: 'Элитная недвижимость',  icon: '🌆', price: 260e6, cats: ['home'], desc: 'Только эпик и выше', w: W_ELITE },
  { id: 'home_msk', cover: 'img/cases/home_msk.jpg', credit: 'U.S. Department of State · Public domain',     group: '🏠 Жильё: тематические', name: 'Москва',                   icon: '🏙️', price: 17e6,  cats: ['home'], tag: 'msk', desc: 'От коммуналки до Москва-Сити', w: W_MID },
  { id: 'home_country', cover: 'img/cases/home_country.jpg', credit: 'Peretz Partensky from San Francisco, USA · CC BY-SA 2.0', group: '🏠 Жильё: тематические', name: 'Загородная жизнь',         icon: '🌲', price: 27e6,  cats: ['home'], tag: 'country', desc: 'Дачи, дома, Рублёвка', w: { common: 60, rare: 0, epic: 35, legendary: 4.5, mythic: 0.5 } },
  { id: 'home_abroad', cover: 'img/cases/home_abroad.jpg', credit: 'Phil6007 · CC BY-SA 4.0',  group: '🏠 Жильё: тематические', name: 'Зарубежная недвижимость',  icon: '✈️', price: 34e6,  cats: ['home'], tag: 'abroad', desc: 'Батуми, Дубай, Лондон, Монако', w: W_MID },


  { id: 'conn_free', cover: 'img/cases/conn_free.jpg', credit: 'Rufino · CC BY-SA 2.0',  group: '🤝 Связи', name: 'Знакомство дня', icon: '🍀', price: 0, cooldown: 24 * 3600e3, cats: ['conn'],
    desc: 'Раз в сутки: полезный человек', w: W_MID },
  { id: 'conn_forum', cover: 'img/cases/conn_forum.jpg', credit: 'USDAgov · Public domain', group: '🤝 Связи', name: 'Деловой форум',  icon: '🎤', price: 3e6,   cats: ['conn'], desc: 'Чиновники, банкиры, силовики', w: W_MID },
  { id: 'conn_club', cover: 'img/cases/conn_club.jpg', credit: 'Wikimedia Commons · Public domain',  group: '🤝 Связи', name: 'Закрытый клуб',  icon: '🥃', price: 150e6, cats: ['conn'], desc: 'Только эпик и выше', w: W_ELITE },
];
// cover — фото на обложке кейса (если нет — иконка)
const MULTI_OPEN = [1, 5, 10];      // варианты открытия за раз
const MULTI_DISCOUNT = { 10: 0.1 }; // ×10 — скидка 10%
const PITY = 30;                    // не позже чем на 30-м кейсе гарантированно эпик или выше
// ---------- связи: доверие ----------
const CONN_MAX_LV = 5;
const CONN_XP = [0, 100, 250, 500, 1000];  // сколько доверия нужно для уровней 1–5
const DUP_CONN_XP = 100;                   // повторное знакомство из кейса
// Встречи: цена умножается на mult редкости связи; cd — перезарядка у каждой связи своя
const MEETS = [
  { id: 'lunch',   name: 'Деловой обед', icon: 'ti-tools-kitchen-2', cost: 20e3,  xp: 15,  cd: 1 * 3600e3 },
  { id: 'banya',   name: 'Баня',         icon: 'ti-flame',           cost: 150e3, xp: 50,  cd: 6 * 3600e3 },
  { id: 'fishing', name: 'Рыбалка',      icon: 'ti-fish',            cost: 1e6,   xp: 150, cd: 24 * 3600e3 },
];
// Просьбы: время от времени одна из связей о чём-то просит. Выполнил — много доверия, отказал — немного теряешь.
// cost: hours — столько часов твоего дохода (не меньше min); salary — столько месячных зарплат сотрудника бизнеса
const FAVORS = [
  { id: 'f_loan',    text: '{name} просит занять денег «до зарплаты»',        cost: { hours: 3, min: 30e3 },  xp: 120 },
  { id: 'f_sponsor', text: '{name} просит спонсировать праздник района',      cost: { hours: 6, min: 80e3 },  xp: 180 },
  { id: 'f_tickets', text: '{name} мечтает о билетах на финал Кубка',         cost: { hours: 2, min: 25e3 },  xp: 90 },
  { id: 'f_car',     need: 'car', text: '{name} просит твою машину на свадьбу дочери', xp: 100 },
  { id: 'f_nephew',  need: 'biz', text: '{name} просит устроить племянника в «{biz}»', cost: { salary: 2 }, xp: 200 },
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
  cash:       'Выгодная сделка: +{h} ч твоего дохода',
  taxHoliday: 'Налоговые каникулы: {h} ч без налога на бизнес',
  tender:     'Госзаказ: {h} ч прибыли бизнеса сразу',
};


// pay — зарплата ₽/мес; req — минимальные уровни навыков; needCar — нужна активная машина
// perk / v — польза от профессии, пока ты на ней работаешь (названия как у связей, см. PERKS)
// solves — какие события решаются бесплатно, пока работаешь здесь
const JOBS = [
  { id: 'flyers',   name: 'Раздатчик листовок',   icon: '📄', pay: 30e3,  req: {} },
  { id: 'courier',  name: 'Курьер',               icon: '📦', pay: 60e3,  req: { fit: 2 },  perk: 'gigUp', v: 20 },
  { id: 'barista',  name: 'Бариста',              icon: '☕', pay: 65e3,  req: { cha: 3 },  perk: 'meetCheap', v: 20 },
  { id: 'seller',   name: 'Продавец-консультант', icon: '🛍️', pay: 80e3,  req: { cha: 5, int: 2 }, perk: 'caseCheap', v: 5 },
  { id: 'taxi',     name: 'Таксист',              icon: '🚕', pay: 120e3, req: { fit: 4 }, needCar: true, perk: 'gibdd', v: 1, solves: ['e_gibdd'] },
  { id: 'junior',   name: 'Junior-программист',   icon: '💻', pay: 150e3, req: { int: 8 },  perk: 'study', v: 20 },
  { id: 'trainer',  name: 'Фитнес-тренер',        icon: '🏋️', pay: 180e3, req: { fit: 12, cha: 5 }, perk: 'trustUp', v: 25 },
  { id: 'sales',    name: 'Менеджер по продажам', icon: '📞', pay: 220e3, req: { cha: 10, biz: 5 }, perk: 'demandUp', v: 10 },
  { id: 'taxman',   name: 'Сотрудник налоговой',  icon: '🧾', pay: 250e3, req: { int: 10, biz: 6 }, perk: 'taxCut', v: 5, solves: ['e_tax'] },
  { id: 'lawyer',   name: 'Юрист',                icon: '⚖️', pay: 320e3, req: { int: 12, cha: 8 }, perk: 'court', v: 1, solves: ['e_raid', 'e_court'] },
  { id: 'senior',   name: 'Senior-разработчик',   icon: '🧑‍💻', pay: 450e3, req: { int: 18 }, perk: 'study', v: 35 },
  { id: 'director', name: 'Директор филиала',     icon: '🏢', pay: 700e3, req: { biz: 15, cha: 15 }, perk: 'bizEff', v: 20 },
  { id: 'mayor',    name: 'Мэр города',           icon: '🏛️', pay: 1.2e6, req: { cha: 22, biz: 15, int: 15 }, perk: 'licenseCut', v: 50, solves: ['e_fire', 'e_flood'] },
  { id: 'blogger',  name: 'Блогер-миллионник',    icon: '📱', pay: 1.5e6, req: { cha: 25 }, perk: 'demandUp', v: 20 },
  { id: 'founder',  name: 'Основатель стартапа',  icon: '🚀', pay: 5e6,   req: { biz: 28, int: 25 }, perk: 'bizBoost', v: 10 },
  { id: 'holding',  name: 'Владелец холдинга',    icon: '🏦', pay: 25e6,  req: { biz: 40, cha: 30, int: 30 }, perk: 'bizBoost', v: 20 },
];

const START_MONEY = 50e3;

const SKILL_MAX = 50;
const SKILLS = [
  { id: 'int', name: 'Интеллект', icon: '🧠', desc: '+1% к зарплате за уровень. Нужен для умных профессий.' },
  { id: 'cha', name: 'Харизма',   icon: '🗣️', desc: '−1% к цене кейсов за уровень (до −30%). Нужна для работы с людьми.' },
  { id: 'fit', name: 'Физуха',    icon: '💪', desc: '+5% к оплате подработок за уровень. Нужна для физической работы.' },
  { id: 'biz', name: 'Бизнес',    icon: '📈', desc: '+2% к аренде за уровень. Нужен для руководящих должностей.' },
];
const skillCost = lvl => Math.round(30e3 * Math.pow(1.3, lvl)); // курсы, тренер, MBA…
// Учёба: можно сразу пройти до STUDY_BATCH уровней (любых навыков), потом перерыв.
// Перерыв растёт с общим числом уровней: в начале минуты, ближе к концу игры — несколько часов.
const STUDY_BATCH = 5;
const studyRestHours = totalLevels => 0.25 + 0.04 * totalLevels;

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
// need: 'conn' — только если есть связи, 'biz' — только если есть бизнес
const DAILY_QUESTS = [
  { id: 'd_open',  ev: 'open',  n: 2, text: 'Открой 2 любых кейса' },
  { id: 'd_free',  ev: 'free',  n: 1, text: 'Открой ежедневный кейс' },
  { id: 'd_gig',   ev: 'gig',   n: 2, text: 'Выполни 2 подработки' },
  { id: 'd_meet',  ev: 'meet',  n: 1, text: 'Встреться с одной из связей', need: 'conn' },
  { id: 'd_skill', ev: 'skill', n: 1, text: 'Пройди курс любого навыка' },
  { id: 'd_earn',  ev: 'earn',  hours: 6, text: 'Заработай {X}' },
  { id: 'd_biz',   ev: 'bizup', n: 1, text: 'Улучши бизнес: станок, сотрудник или реклама', need: 'biz' },
  { id: 'd_conn',  ev: 'conn_free', n: 1, text: 'Открой «Знакомство дня»' },
];
const WEEKLY_QUESTS = [
  { id: 'w_open',  ev: 'open',      n: 15, text: 'Открой 15 кейсов' },
  { id: 'w_gig',   ev: 'gig',       n: 10, text: 'Выполни 10 подработок' },
  { id: 'w_meet',  ev: 'meet',      n: 7,  text: 'Проведи 7 встреч со связями', need: 'conn' },
  { id: 'w_favor', ev: 'favor',     n: 2,  text: 'Выполни 2 просьбы связей', need: 'conn' },
  { id: 'w_skill', ev: 'skill',     n: 5,  text: 'Пройди 5 курсов' },
  { id: 'w_earn',  ev: 'earn',      hours: 60, text: 'Заработай {X}' },
  { id: 'w_daily', ev: 'daily_all', n: 4,  text: 'Выполни все ежедневные задания 4 дня' },
  { id: 'w_biz',   ev: 'bizup',     n: 5,  text: 'Сделай 5 улучшений бизнеса', need: 'biz' },
];
const QUESTS_PER_DAY = 3;
const QUESTS_PER_WEEK = 3;
// Награды: деньги — в месяцах текущего дохода (не меньше min), билеты — бесплатное открытие кейса
const DAILY_REWARD = { hours: 2, min: 20e3 };
const DAILY_BONUS = { hours: 4, min: 50e3, ticket: 'car_ru' };          // за все ежедневные
const WEEKLY_TICKETS = ['car_used', 'home_used', 'conn_forum'];         // по одному за каждое недельное
const WEEKLY_BONUS = { ticket: 'car_new' };                           // за все недельные

// «Жизненный путь» — цепочка целей по порядку. type: job (зарплата от v), car, skills (сумма уровней),
// home (объектов от v), rank (статус от v), carRarity (редкость машины от v),
// biz (бизнесов от v), bizProfit (прибыль всех бизнесов от v ₽/мес), conn (связей от v), connLv (доверие любой связи от v)
// reward: money или ticket (id кейса)
const LIFE_PATH = [
  { type: 'job',       v: 60e3,  text: 'Устройся на работу получше', reward: { money: 100e3 } },
  { type: 'car',                 text: 'Получи первую машину',       reward: { money: 150e3 } },
  { type: 'skills',    v: 5,     text: 'Пройди 5 курсов',            reward: { money: 200e3 } },
  { type: 'home',      v: 1,     text: 'Получи своё жильё',          reward: { money: 300e3 } },
  { type: 'rank',      v: 2,     text: 'Стань «Работягой»',          reward: { ticket: 'car_used' } },
  { type: 'biz',       v: 1,     text: 'Открой свой бизнес',         reward: { money: 500e3 } },
  { type: 'conn',      v: 3,     text: 'Заведи 3 полезные связи',     reward: { ticket: 'conn_forum' } },
  { type: 'job',       v: 150e3, text: 'Зарплата от 150 тыс ₽/мес',  reward: { money: 1e6 } },
  { type: 'connLv',    v: 3,     text: 'Подними доверие любой связи до 3', reward: { ticket: 'home_used' } },
  { type: 'rank',      v: 3,     text: 'Стань «Средним классом»',    reward: { money: 2e6 } },
  { type: 'carRarity', v: 2,     text: 'Получи эпическую машину',    reward: { ticket: 'car_new' } },
  { type: 'home',      v: 5,     text: 'Собери 5 объектов недвижимости', reward: { money: 5e6 } },
  { type: 'rank',      v: 4,     text: 'Стань «Успешным»',           reward: { ticket: 'home_new' } },
  { type: 'bizProfit', v: 1e6,   text: 'Прибыль бизнеса от 1 млн ₽/мес', reward: { ticket: 'car_new' } },
  { type: 'connLv',    v: 5,     text: 'Доведи связь до полного доверия', reward: { money: 20e6 } },
  { type: 'job',       v: 450e3, text: 'Зарплата от 450 тыс ₽/мес',  reward: { money: 30e6 } },
  { type: 'rank',      v: 5,     text: 'Стань «Богачом»',            reward: { ticket: 'car_elite' } },
  { type: 'biz',       v: 4,     text: 'Владей четырьмя бизнесами',   reward: { money: 100e6 } },
  { type: 'conn',      v: 8,     text: 'Собери 8 разных связей',     reward: { ticket: 'conn_club' } },
  { type: 'rank',      v: 6,     text: 'Стань миллиардером',         reward: { ticket: 'home_elite' } },
  { type: 'rank',      v: 7,     text: 'Стань «Магнатом»',           reward: { money: 1e9 } },
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
// Прибыль/мес = продано × наценка × эффективность − зарплаты − аренда − управляющий, минус налог с прибыли.
// Продано = меньшее из производства и спроса. Производство = рабочие места × perSlot,
// а рабочее место = станок + сотрудник (чего меньше, столько мест и работает).
// Без управляющего бизнес работает с эффективностью OWNER_EFF_EMPLOYED или OWNER_EFF_FREE (см. выше).
const BIZ_TAX = 0.15;
const MKT_STEP = 0.25;        // +25% спроса за уровень рекламы
const MKT_MAX = 5;
const MACHINE_GROWTH = 1.25;  // каждый следующий станок дороже
const MKT_GROWTH = 2;         // каждый следующий уровень рекламы дороже
const BIZ_SELL_RATE = 0.6;    // бизнес продаётся за 60% вложенного
const HIRE_COST = 0.5;        // найм (подбор, оформление) — доля месячной зарплаты

// price — помещение и запуск; license — лицензии и разрешения; rank / req — что нужно для открытия
// margin — наценка с единицы; perSlot — единиц в месяц с одного рабочего места; demand — спрос в месяц
// machine / worker — названия станка и сотрудника; machineCost — первый докупленный станок
// slots — максимум рабочих мест; start — сколько мест (станков и людей) уже есть при покупке
// salary — зарплата сотрудника; rentCost — аренда помещения; mktCost — первый уровень рекламы; mgrSalary — управляющий
const BUSINESSES = [
  { id: 'b_shawarma', name: 'Ларёк с шаурмой', icon: '🌯', price: 1.5e6, license: 150e3, rank: 2, req: { biz: 2 },
    unit: 'шаурм', margin: 90, perSlot: 1500, demand: 4000,
    machine: 'Гриль', machineIcon: '🔥', machineCost: 400e3, worker: 'Повар', workerIcon: '👨‍🍳',
    slots: 4, start: 1, salary: 45e3, rentCost: 20e3, mktCost: 90e3, mgrSalary: 80e3 },
  { id: 'b_carwash', name: 'Автомойка', icon: '🚿', price: 6e6, license: 600e3, rank: 3, req: { biz: 5 },
    unit: 'машин', margin: 550, perSlot: 400, demand: 1500,
    machine: 'Моечный пост', machineIcon: '🫧', machineCost: 2e6, worker: 'Мойщик', workerIcon: '🧽',
    slots: 6, start: 2, salary: 60e3, rentCost: 100e3, mktCost: 375e3, mgrSalary: 120e3 },
  { id: 'b_coffee', name: 'Кофейня', icon: '☕', price: 12e6, license: 1.2e6, rank: 3, req: { biz: 8 },
    unit: 'чашек', margin: 130, perSlot: 3000, demand: 12000,
    machine: 'Кофемашина', machineIcon: '⚙️', machineCost: 4e6, worker: 'Бариста', workerIcon: '🧑‍🍳',
    slots: 5, start: 2, salary: 70e3, rentCost: 250e3, mktCost: 750e3, mgrSalary: 150e3 },
  { id: 'b_service', name: 'Автосервис', icon: '🔧', price: 30e6, license: 3e6, rank: 4, req: { biz: 12 },
    unit: 'заказов', margin: 11e3, perSlot: 60, demand: 400,
    machine: 'Подъёмник', machineIcon: '🏗️', machineCost: 8e6, worker: 'Механик', workerIcon: '👨‍🔧',
    slots: 8, start: 2, salary: 120e3, rentCost: 400e3, mktCost: 1.8e6, mgrSalary: 250e3 },
  { id: 'b_furniture', name: 'Мебельный цех', icon: '🪑', price: 120e6, license: 12e6, rank: 4, req: { biz: 18 },
    unit: 'комплектов', margin: 38e3, perSlot: 40, demand: 300,
    machine: 'Станок ЧПУ', machineIcon: '🛠️', machineCost: 35e6, worker: 'Столяр', workerIcon: '🪚',
    slots: 10, start: 2, salary: 150e3, rentCost: 800e3, mktCost: 7.5e6, mgrSalary: 400e3 },
  { id: 'b_factory', name: 'Завод стройматериалов', icon: '🏭', price: 800e6, license: 80e6, rank: 5, req: { biz: 25 },
    unit: 'тонн', margin: 2800, perSlot: 4000, demand: 30000,
    machine: 'Производственная линия', machineIcon: '🏭', machineCost: 280e6, worker: 'Бригада', workerIcon: '👷',
    slots: 10, start: 2, salary: 1.5e6, rentCost: 5e6, mktCost: 45e6, mgrSalary: 3e6 },
  { id: 'b_it', name: 'IT-холдинг', icon: '🏢', price: 5e9, license: 500e6, rank: 6, req: { biz: 35 },
    unit: 'проектов', margin: 18e6, perSlot: 4, demand: 30,
    machine: 'Офис и серверы', machineIcon: '🖥️', machineCost: 1.2e9, worker: 'Команда разработчиков', workerIcon: '👩‍💻',
    slots: 12, start: 2, salary: 10e6, rentCost: 20e6, mktCost: 300e6, mgrSalary: 20e6 },
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
  study:      'Курсы проходятся на {v}% быстрее',
  trustUp:    '+{v}% доверия от встреч',
  bizEff:     '+{v}% к эффективности бизнесов без управляющего',
};

// Работа или бизнес: без управляющего бизнес работает с такой эффективностью
const OWNER_EFF_EMPLOYED = 0.5;  // ты работаешь по найму — на бизнес мало времени
const OWNER_EFF_FREE = 0.9;      // ты уволился и занимаешься только бизнесом

const BRIBE_DIVISOR = 5;     // взятка в 5 раз дешевле официального пути
const BRIBE_RISK = 35;       // базовый шанс попасться, %
const BRIBE_FINE = 2;        // попался — платишь официальную сумму × 2
const EVENT_EVERY_H = [8, 16]; // новое событие через случайное число часов из диапазона
const EVENT_GOOD_CHANCE = 40;  // % событий — приятные
const DEAL_HOURS = 12;       // сделка с олигархом
const DEAL_INCOME_H = 24;    // максимум вложения — столько часов текущего дохода

// События. need: car / home / biz — бывает, только если это есть; minRank — с какого статуса.
// cost — официальная цена: hours часов дохода (или bizHours месяцев прибыли ОДНОГО бизнеса), не меньше min.
// Событие с need: 'biz' касается одного случайного бизнеса — {biz} в тексте заменяется его названием.
// via — связь, которая решает бесплатно (ещё помогают профессии с solves); fine: true — дешевле с участковым;
// freeze: true — пока не решено, этот бизнес опечатан (выручки нет, расходы идут).
// good: true — хорошее событие, reward — награда в часах дохода.
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
    text: 'Знакомый депутат подкинул выгодный контракт для «{biz}».', reward: 30 },
  { id: 'e_review', need: 'biz', good: true, icon: '📸', title: 'Вирусное видео',
    text: 'Блогер снял ролик про «{biz}», и он залетел в рекомендации. Очередь до вечера!', reward: 10 },
  { id: 'e_rival', need: 'biz', good: true, icon: '🏳️', title: 'Конкурент закрылся',
    text: 'Главный конкурент «{biz}» обанкротился — его клиенты теперь идут к тебе.', reward: 15 },
  { id: 'e_tenant', need: 'home', good: true, icon: '🤝', title: 'Арендатор на год вперёд',
    text: 'Солидный арендатор заплатил за год вперёд — со скидкой, но сразу.', reward: 12 },
  { id: 'e_car_buyer', need: 'car', good: true, icon: '🚘', title: 'Коллекционер',
    text: 'Коллекционер просто так заплатил за фото с твоей машиной для журнала.', reward: 4 },
  { id: 'e_inherit', good: true, icon: '📬', title: 'Наследство',
    text: 'Дальний родственник, о котором ты не слышал, оставил тебе немного денег.', reward: 8 },
  { id: 'e_cashback', good: true, icon: '🎉', title: 'Удачный месяц',
    text: 'Банк вернул кэшбэк, а старый друг наконец отдал долг.', reward: 3 },
];
