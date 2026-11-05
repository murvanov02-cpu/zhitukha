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
  { id: 'c_moskvich', cat: 'car', name: 'Москвич-412', icon: '🚗', rarity: 'common', bonus: 2, t: ['ru'], value: 100e3,
    img: 'img/cars/c_moskvich.png', credit: 'Sergey Korovkin 84 · CC BY-SA 4.0' },
  { id: 'c_lanos', cat: 'car', name: 'Chevrolet Lanos', icon: '🚗', rarity: 'common', bonus: 2, value: 300e3,
    img: 'img/cars/c_lanos.png', credit: 'IFCAR · Public domain' },
  { id: 'c_focus', cat: 'car', name: 'Ford Focus', icon: '🚗', rarity: 'common', bonus: 3, value: 900e3,
    img: 'img/cars/c_focus.png', credit: 'M 93 · CC BY-SA 3.0 de' },
  { id: 'c_largus', cat: 'car', name: 'Lada Largus', icon: '🚙', rarity: 'common', bonus: 3, t: ['ru'], value: 1.3e6,
    img: 'img/cars/c_largus.png', credit: 'Throwawayacc222 · CC0' },
  { id: 'c_uaz', cat: 'car', name: 'УАЗ Патриот (списанный из полиции)', icon: '🚙', rarity: 'common', bonus: 4, t: ['ru'], value: 1.8e6,
    img: 'img/cars/c_uaz.png', credit: 'Max071086 · CC BY-SA 4.0' },
  { id: 'c_corolla', cat: 'car', name: 'Toyota Corolla', icon: '🚘', rarity: 'rare', bonus: 7, t: ['jp'], value: 2.6e6,
    img: 'img/cars/c_corolla.png', credit: 'EurovisionNim · CC BY-SA 4.0' },
  { id: 'c_passat', cat: 'car', name: 'Volkswagen Passat', icon: '🚘', rarity: 'rare', bonus: 8, t: ['de'], value: 3.3e6,
    img: 'img/cars/c_passat.png', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_a4', cat: 'car', name: 'Audi A4', icon: '🚘', rarity: 'rare', bonus: 9, t: ['de'], value: 4e6,
    img: 'img/cars/c_a4.png', credit: 'Alexander-93 · CC BY-SA 4.0' },
  { id: 'c_prado', cat: 'car', name: 'Toyota Land Cruiser Prado', icon: '🚙', rarity: 'epic', bonus: 14, t: ['jp'], value: 8.5e6,
    img: 'img/cars/c_prado.png', credit: 'Mr.choppers · CC BY-SA 4.0' },
  { id: 'c_m3', cat: 'car', name: 'BMW M3', icon: '🏎️', rarity: 'epic', bonus: 16, t: ['de'], value: 12e6,
    img: 'img/cars/c_m3.png', credit: 'Alexander Migl · CC BY-SA 4.0' },
  { id: 'c_tesla', cat: 'car', name: 'Tesla Model S Plaid', icon: '🚘', rarity: 'epic', bonus: 16, value: 13e6,
    img: 'img/cars/c_tesla.png', credit: 'Peteratkins · CC BY-SA 4.0' },
  { id: 'c_range', cat: 'car', name: 'Range Rover', icon: '🚙', rarity: 'epic', bonus: 18, value: 19e6,
    img: 'img/cars/c_range.png', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_amggt', cat: 'car', name: 'Mercedes-AMG GT', icon: '🏎️', rarity: 'legendary', bonus: 30, t: ['de'], value: 25e6,
    img: 'img/cars/c_amggt.png', credit: 'Thesupermat · CC BY-SA 4.0' },
  { id: 'c_db11', cat: 'car', name: 'Aston Martin DB11', icon: '🏎️', rarity: 'legendary', bonus: 32, value: 30e6,
    img: 'img/cars/c_db11.png', credit: 'Vauxford · CC BY-SA 4.0' },
  { id: 'c_nevera', cat: 'car', name: 'Rimac Nevera', icon: '🏎️', rarity: 'mythic', bonus: 60, value: 220e6,
    img: 'img/cars/c_nevera.png', credit: 'MrWalkr · CC BY-SA 4.0' },
  { id: 'c_laferrari', cat: 'car', name: 'LaFerrari', icon: '🏎️', rarity: 'mythic', bonus: 58, value: 300e6,
    img: 'img/cars/c_laferrari.png', credit: 'Axion23 · CC BY 2.0' },
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

  { id: 'h_brezh', cat: 'home', name: 'Брежневка в регионе', icon: '🏢', rarity: 'common', bonus: 12e3, value: 2.2e6,
    img: 'img/homes/h_brezh.jpg', credit: 'Jelger Groeneveld · CC BY 2.0' },
  { id: 'h_kazan', cat: 'home', name: 'Квартира в Казани', icon: '🕌', rarity: 'rare', bonus: 40e3, value: 8e6,
    img: 'img/homes/h_kazan.jpg', credit: 'Vitaly Ilyin · CC BY-SA 4.0' },
  { id: 'h_spb', cat: 'home', name: 'Квартира в Петербурге', icon: '🌉', rarity: 'rare', bonus: 55e3, value: 11e6,
    img: 'img/homes/h_spb.jpg', credit: 'A.Savin · FAL' },
  { id: 'h_loft', cat: 'home', name: 'Лофт в центре', icon: '🏭', rarity: 'rare', bonus: 65e3, value: 13e6,
    img: 'img/homes/h_loft.jpg', credit: 'Jennifer D. Ames · CC BY-SA 3.0' },
  { id: 'h_polyana', cat: 'home', name: 'Шале в Красной Поляне', icon: '🏔️', rarity: 'epic', bonus: 150e3, value: 30e6,
    img: 'img/homes/h_polyana.jpg', credit: 'Sergei Kazantsev · CC BY-SA 4.0' },
  { id: 'h_chalet', cat: 'home', name: 'Шале в Альпах', icon: '🏔️', rarity: 'epic', bonus: 180e3, value: 38e6,
    img: 'img/homes/h_chalet.jpg', credit: 'Leemburg-CH · CC BY-SA 4.0' },
  { id: 'h_tuscany', cat: 'home', name: 'Вилла в Тоскане', icon: '🌳', rarity: 'legendary', bonus: 900e3, value: 180e6,
    img: 'img/homes/h_tuscany.jpg', credit: 'Anton Sulsky · CC BY 2.0' },
  { id: 'h_ny', cat: 'home', name: 'Пентхаус на Манхэттене', icon: '🗽', rarity: 'legendary', bonus: 1.7e6, value: 350e6,
    img: 'img/homes/h_ny.jpg', credit: 'Gryffindor · CC BY-SA 3.0' },
  { id: 'h_tower', cat: 'home', name: 'Собственный небоскрёб', icon: '🏙️', rarity: 'mythic', bonus: 25e6, value: 5e9,
    img: 'img/homes/h_tower.jpg', credit: 'Anton Galakhov · CC BY-SA 4.0' },

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
  { id: 'free', cover: 'img/cases/free.jpg', credit: 'Wikimedia Commons · Public domain', name: 'Ежедневный', icon: '🎁', price: 0, cooldown: 24 * 3600e3, tier: 'free',
    desc: 'Раз в сутки: недорогая машина или жильё', w: W_CHEAP,
    items: ['c_2107', 'c_2109', 'c_matiz', 'c_logan', 'c_granta', 'c_niva', 'h_bed', 'h_garage', 'h_dacha', 'h_village', 'c_tiggo', 'h_room'] },

  { id: 'car_junk', cover: 'img/cases/car_junk.jpg', credit: 'Sergey Korovkin 84 · CC BY-SA 4.0', name: 'Битые тачки', icon: '🛠️', price: 'auto', tier: 'cheap',
    desc: 'Старьё на ходу: Москвич, Жигули, Lanos', w: W_CHEAP, items: ['c_moskvich', 'c_2109', 'c_2107', 'c_lanos', 'c_matiz'] },
  { id: 'car_people', cover: 'img/cases/car_people.jpg', credit: 'Gennady Grachev from Moscow, Russia · CC BY 2.0', name: 'Народные иномарки', icon: '🚗', price: 'auto', tier: 'cheap',
    desc: 'Logan, Focus, Polo, Solaris, Rio', w: { common: 90, rare: 10, epic: 0, legendary: 0, mythic: 0 },
    items: ['c_logan', 'c_focus', 'c_polo', 'c_solaris', 'c_rio', 'c_corolla'] },
  { id: 'car_suv', cover: 'img/cases/car_suv.jpg', credit: 'Dazzuko at English Wikipedia · Public domain', name: 'Кроссоверы и внедорожники', icon: '🚙', price: 'auto', tier: 'cheap',
    desc: 'Нива, УАЗ, Haval, Chery, X-Trail', w: { common: 70, rare: 30, epic: 0, legendary: 0, mythic: 0 },
    items: ['c_niva', 'c_uaz', 'c_jolion', 'c_tiggo', 'c_xtrail', 'c_tiguan'] },
  { id: 'car_garage', cover: 'img/cases/car_ru.jpg', credit: 'ShinePhantom · CC BY-SA 3.0', name: 'Гаражный кооператив', icon: '🔧', price: 'auto', tier: 'cheap',
    desc: 'Жигули, Нива, Матиз — дёшево и сердито', w: W_CHEAP,
    items: ['c_2109', 'c_2107', 'c_matiz', 'c_logan', 'c_granta', 'c_niva', 'c_moskvich', 'c_lanos', 'c_largus'] },
  { id: 'car_used', cover: 'img/cases/car_used.jpg', credit: '293.xx.xxx.xx · CC BY-SA 3.0', name: 'Авторынок б/у', icon: '🚗', price: 'auto', tier: 'cheap',
    desc: 'Народные машины и иногда иномарка получше', w: W_CHEAP,
    items: ['c_logan', 'c_granta', 'c_niva', 'c_polo', 'c_vesta', 'c_solaris', 'c_rio', 'c_jolion', 'c_tiggo', 'c_octavia', 'c_k5', 'c_mazda6', 'c_focus', 'c_largus', 'c_uaz', 'c_corolla', 'c_passat'] },
  { id: 'car_new', cover: 'img/cases/car_new.jpg', credit: 'Swoodchatla · CC BY-SA 3.0', name: 'Автосалон', icon: '🚘', price: 'auto', tier: 'mid',
    desc: 'Новые машины бизнес-класса', w: W_MID,
    items: ['c_octavia', 'c_k5', 'c_mazda6', 'c_xtrail', 'c_camry', 'c_rav4', 'c_tiguan', 'c_monjaro', 'c_eclass', 'c_lc300', 'c_x5', 'c_cayenne', 'c_corolla', 'c_passat', 'c_a4', 'c_prado', 'c_m3'] },
  { id: 'car_premium', cover: 'img/cases/car_premium.jpg', credit: 'Diego Delso · CC BY-SA 3.0', name: 'Премиум-салон', icon: '💼', price: 'auto', tier: 'elite',
    desc: 'Мощные седаны и внедорожники, шанс на спорткар', w: { common: 0, rare: 0, epic: 80, legendary: 20, mythic: 0 },
    items: ['c_eclass', 'c_lc300', 'c_x5', 'c_cayenne', 'c_gtr', 'c_m5', 'c_rs6', 'c_sclass', 'c_lx', 'c_911', 'c_g63', 'c_bentley', 'c_prado', 'c_m3', 'c_tesla', 'c_range', 'c_amggt', 'c_db11'] },
  { id: 'car_elite', cover: 'img/cases/car_elite.jpg', credit: 'Saaremees · CC BY-SA 4.0', name: 'Элитный автосалон Дубая', icon: '🏎️', price: 'auto', tier: 'elite',
    desc: 'Спорткары и редкие роскошные машины', w: { common: 0, rare: 0, epic: 0, legendary: 85, mythic: 15 },
    items: ['c_911', 'c_g63', 'c_bentley', 'c_mclaren', 'c_ferrari', 'c_urus', 'c_aventador', 'c_phantom', 'c_cullinan', 'c_amggt', 'c_db11'] },
  { id: 'car_hyper', cover: 'img/cases/car_sc.jpg', credit: 'Axion23 · CC BY 2.0', name: 'Гиперкары', icon: '🏁', price: 'auto', tier: 'elite',
    desc: 'Только здесь: Bugatti, Pagani, Koenigsegg', w: { common: 0, rare: 0, epic: 0, legendary: 55, mythic: 45 },
    items: ['c_mclaren', 'c_ferrari', 'c_urus', 'c_aventador', 'c_huayra', 'c_jesko', 'c_chiron', 'c_laferrari', 'c_nevera'] },
  { id: 'car_cn', cover: 'img/cases/car_cn.jpg', credit: 'N509FZ · CC BY-SA 4.0', name: 'Китайцы', icon: '🇨🇳', price: 'auto', tier: 'cheap', theme: true,
    desc: 'Haval, Chery, Geely', w: { common: 55, rare: 45, epic: 0, legendary: 0, mythic: 0 }, items: ['c_jolion', 'c_tiggo', 'c_monjaro'] },
  { id: 'car_jp', cover: 'img/cases/car_jp.jpg', credit: 'TTTNIS · CC0', name: 'Японцы', icon: '🇯🇵', price: 'auto', tier: 'mid', theme: true,
    desc: 'Toyota, Nissan, Mazda, Lexus', w: { common: 0, rare: 65, epic: 35, legendary: 0, mythic: 0 },
    items: ['c_mazda6', 'c_xtrail', 'c_camry', 'c_rav4', 'c_lc300', 'c_gtr', 'c_lx', 'c_corolla', 'c_prado'] },
  { id: 'car_de', cover: 'img/cases/car_de.jpg', credit: 'Diego Delso · CC BY-SA 3.0', name: 'Немецкое качество', icon: '🇩🇪', price: 'auto', tier: 'mid', theme: true,
    desc: 'VW, Skoda, BMW, Mercedes, Audi, Porsche', w: { common: 0, rare: 55, epic: 42, legendary: 3, mythic: 0 },
    items: ['c_octavia', 'c_tiguan', 'c_eclass', 'c_x5', 'c_cayenne', 'c_m5', 'c_rs6', 'c_sclass', 'c_911', 'c_g63', 'c_passat', 'c_a4', 'c_m3', 'c_amggt'] },

  { id: 'home_dorm', cover: 'img/cases/home_dorm.jpg', credit: 'benuski from Richmond, VA, USA · CC BY-SA 2.0', name: 'Общаги и гаражи', icon: '🛏️', price: 'auto', tier: 'cheap',
    desc: 'Койка, гараж, дача, дом в деревне', w: W_CHEAP, items: ['h_bed', 'h_garage', 'h_dacha', 'h_village'] },
  { id: 'home_used', cover: 'img/cases/home_used.jpg', credit: 'Andreas Wolf 01 · CC BY-SA 4.0', name: 'Вторичка', icon: '🏚️', price: 'auto', tier: 'cheap',
    desc: 'Комнаты и квартиры в старых домах', w: { common: 75, rare: 25, epic: 0, legendary: 0, mythic: 0 },
    items: ['h_garage', 'h_room', 'h_studio', 'h_flat', 'h_brezh', 'h_kazan'] },
  { id: 'home_new', cover: 'img/cases/home_new.jpg', credit: 'Anneli Vaniala · CC BY-SA 4.0', name: 'Новостройки', icon: '🏗️', price: 'auto', tier: 'mid',
    desc: 'Квартиры, таунхаусы и дома', w: W_MID, items: ['h_studio', 'h_flat', 'h_newflat', 'h_house', 'h_town', 'h_kazan', 'h_spb', 'h_loft', 'h_polyana'] },
  { id: 'home_elite', cover: 'img/cases/home_elite.jpg', credit: 'mos.ru · CC BY 4.0', name: 'Элитная Москва', icon: '🌆', price: 'auto', tier: 'elite',
    desc: 'Патриаршие, Москва-Сити, пентхаусы', w: { common: 0, rare: 0, epic: 70, legendary: 30, mythic: 0 },
    items: ['h_patriki', 'h_city', 'h_pent', 'h_hotel'] },
  { id: 'home_abroad', cover: 'img/cases/home_abroad.jpg', credit: 'Phil6007 · CC BY-SA 4.0', name: 'Зарубежная элитка', icon: '✈️', price: 'auto', tier: 'elite',
    desc: 'Дубай, Лондон, Лазурный берег, Монако', w: { common: 0, rare: 0, epic: 60, legendary: 36, mythic: 4 },
    items: ['h_cottage', 'h_dubai_apt', 'h_palm', 'h_london', 'h_riviera', 'h_monaco', 'h_chalet', 'h_tuscany', 'h_ny'] },
  { id: 'home_castle', cover: 'img/cases/home_castle.jpg', credit: 'WorldKnowledge0815 · CC BY-SA 3.0', name: 'Замки и острова', icon: '🏰', price: 'auto', tier: 'elite',
    desc: 'Только здесь: замок и частный остров', w: { common: 0, rare: 0, epic: 0, legendary: 65, mythic: 35 },
    items: ['h_rublyovka', 'h_palm', 'h_london', 'h_castle', 'h_island', 'h_riviera', 'h_monaco', 'h_ny', 'h_tower'] },
  { id: 'home_resort', cover: 'img/cases/home_resort.jpg', credit: 'Narek75 · CC BY-SA 4.0', name: 'Курорты', icon: '🏖️', price: 'auto', tier: 'mid', theme: true,
    desc: 'Батуми, Алания, Сочи, Дубай', w: { common: 35, rare: 55, epic: 10, legendary: 0, mythic: 0 },
    items: ['h_batumi', 'h_alanya', 'h_sochi', 'h_dubai_apt', 'h_polyana'] },
  { id: 'home_country', cover: 'img/cases/home_country.jpg', credit: 'Peretz Partensky from San Francisco, USA · CC BY-SA 2.0', name: 'Загородная жизнь', icon: '🌲', price: 'auto', tier: 'mid', theme: true,
    desc: 'Дачи, дома в деревне, коттеджи и таунхаусы', w: { common: 50, rare: 0, epic: 50, legendary: 0, mythic: 0 },
    items: ['h_dacha', 'h_village', 'h_house', 'h_town', 'h_polyana'] },
  { id: 'home_msk', cover: 'img/cases/home_msk.jpg', credit: 'U.S. Department of State · Public domain', name: 'Москва', icon: '🏙️', price: 'auto', tier: 'mid', theme: true,
    desc: 'От коммуналки до квартиры на Патриарших', w: { common: 30, rare: 55, epic: 15, legendary: 0, mythic: 0 },
    items: ['h_room', 'h_studio', 'h_flat', 'h_newflat', 'h_patriki', 'h_loft'] },

  { id: 'conn_free', cover: 'img/cases/conn_free.jpg', credit: 'US Embassy from New Zealand · CC BY 2.0', name: 'Знакомство дня', icon: '🍀', price: 0, cooldown: 24 * 3600e3, tier: 'free',
    desc: 'Раз в сутки: полезный человек', w: { common: 75, rare: 20, epic: 4, legendary: 0.9, mythic: 0.1 },
    items: ['k_police', 'k_gibdd', 'k_zhkh', 'k_tax', 'k_official', 'k_banker', 'k_prosecutor', 'k_judge', 'k_deputy', 'k_governor', 'k_oligarch', 'k_minister'] },
  { id: 'conn_district', cover: 'img/cases/conn_district.jpg', credit: 'Юрий Д.К. · CC BY 4.0', name: 'Районные знакомства', icon: '🏘️', price: 150e3, tier: 'cheap',
    desc: 'Участковый, гаишник, ЖКХ — иногда кто-то повыше', w: W_CHEAP,
    items: ['k_police', 'k_gibdd', 'k_zhkh', 'k_tax', 'k_banker'] },
  { id: 'conn_forum', cover: 'img/cases/conn_forum.jpg', credit: 'USDAgov · Public domain', name: 'Деловой форум', icon: '🎤', price: 4e6, tier: 'mid',
    desc: 'Чиновники, банкиры, силовики', w: W_MID,
    items: ['k_tax', 'k_official', 'k_banker', 'k_prosecutor', 'k_judge'] },
  { id: 'conn_club', cover: 'img/cases/conn_club.jpg', credit: 'Wikimedia Commons · Public domain', name: 'Закрытый клуб', icon: '🥃', price: 150e6, tier: 'elite',
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
  cash:       'Выгодная сделка: +{h} мес. твоего дохода',
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

const START_MONEY = 150e3;

const SKILL_MAX = 50;
const SKILLS = [
  { id: 'int', name: 'Интеллект', icon: '🧠', desc: '+1% к зарплате за уровень. Нужен для умных профессий.' },
  { id: 'cha', name: 'Харизма',   icon: '🗣️', desc: '−1% к цене кейсов за уровень (до −30%). Нужна для работы с людьми.' },
  { id: 'fit', name: 'Физуха',    icon: '💪', desc: '+5% к оплате подработок за уровень. Нужна для физической работы.' },
  { id: 'biz', name: 'Бизнес',    icon: '📈', desc: '+2% к аренде за уровень. Нужен для руководящих должностей.' },
];
// Учёба без перерывов: прокачка ограничена только деньгами, каждый уровень на 30% дороже предыдущего
const skillCost = lvl => Math.round(100e3 * Math.pow(1.3, lvl)); // курсы, тренер, MBA…

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
  { id: 'd_race',  ev: 'race_win', n: 1, text: 'Выиграй гонку', need: 'car' },
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
  { id: 'w_race',  ev: 'race_win',  n: 8,  text: 'Выиграй 8 гонок', need: 'car' },
];
const QUESTS_PER_DAY = 3;
const QUESTS_PER_WEEK = 3;
// Награды: деньги — в месяцах текущего дохода (не меньше min), билеты — бесплатное открытие кейса
const DAILY_REWARD = { hours: 0.75, min: 10e3 };
const DAILY_BONUS = { hours: 1.5, min: 20e3, ticket: 'car_garage' };          // за все ежедневные
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
  { type: 'job',       v: 150e3, text: 'Зарплата от 150 тыс ₽/мес',  reward: { money: 500000 } },
  { type: 'connLv',    v: 3,     text: 'Подними доверие любой связи до 3', reward: { ticket: 'home_dorm' } },
  { type: 'rank',      v: 3,     text: 'Стань «Средним классом»',    reward: { money: 1e06 } },
  { type: 'carRarity', v: 2,     text: 'Получи эпическую машину',    reward: { ticket: 'car_new' } },
  { type: 'home',      v: 5,     text: 'Собери 5 объектов недвижимости', reward: { money: 2.5e06 } },
  { type: 'rank',      v: 4,     text: 'Стань «Успешным»',           reward: { ticket: 'home_used' } },
  { type: 'bizProfit', v: 1e6,   text: 'Прибыль бизнеса от 1 млн ₽/мес', reward: { ticket: 'car_new' } },
  { type: 'connLv',    v: 5,     text: 'Доведи связь до полного доверия', reward: { money: 1e07 } },
  { type: 'job',       v: 450e3, text: 'Зарплата от 450 тыс ₽/мес',  reward: { money: 1.5e07 } },
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
const BIZ_MAX = 10;             // максимум рабочих мест (и столько же уровней клиентов)
const BIZ_REV = 0.035;          // выручка одного загруженного места в месяц — доля цены бизнеса
const BIZ_SALARY = 0.008;       // зарплата на одно место в месяц
const BIZ_RENT = 0.006;         // аренда помещения в месяц
const BIZ_MGR = 0.008;          // управляющий в месяц
const BIZ_SLOT_COST = 0.55;     // первое новое место — доля цены бизнеса
const BIZ_AD_COST = 0.35;       // первый уровень рекламы
const BIZ_GROWTH = 1.12;        // каждое следующее место и уровень рекламы дороже
const HIRE_MGR_MONTHS = 2;      // найм управляющего — столько его зарплат

// price — помещение и запуск; rank / req — что нужно для открытия; unit — чем меряем клиентов; perSlot — клиентов на место в месяц
const BUSINESSES = [
  { id: 'b_shawarma',  name: 'Ларёк с шаурмой',       icon: '🌯', price: 1.5e6, rank: 2, req: { biz: 2 },  unit: 'покупателей', perSlot: 1500, slot: 'Повар у гриля' },
  { id: 'b_tires',     name: 'Шиномонтаж',            icon: '🛞', price: 4e6,   rank: 2, req: { biz: 4 },  unit: 'машин',       perSlot: 300,  slot: 'Мастер со стендом' },
  { id: 'b_carwash',   name: 'Автомойка',             icon: '🚿', price: 8e6,   rank: 3, req: { biz: 6 },  unit: 'машин',       perSlot: 400,  slot: 'Моечный пост' },
  { id: 'b_coffee',    name: 'Кофейня',               icon: '☕', price: 15e6,  rank: 3, req: { biz: 9 },  unit: 'гостей',      perSlot: 3000, slot: 'Бариста с кофемашиной' },
  { id: 'b_bakery',    name: 'Пекарня',               icon: '🥐', price: 30e6,  rank: 4, req: { biz: 12 }, unit: 'покупателей', perSlot: 4000, slot: 'Пекарь с печью' },
  { id: 'b_service',   name: 'Автосервис',            icon: '🔧', price: 60e6,  rank: 4, req: { biz: 15 }, unit: 'заказов',     perSlot: 60,   slot: 'Механик с подъёмником' },
  { id: 'b_gym',       name: 'Фитнес-клуб',           icon: '🏋️', price: 120e6, rank: 5, req: { biz: 18 }, unit: 'абонементов', perSlot: 300,  slot: 'Тренер и зал' },
  { id: 'b_furniture', name: 'Мебельный цех',         icon: '🪑', price: 300e6, rank: 5, req: { biz: 22 }, unit: 'комплектов',  perSlot: 40,   slot: 'Столяр со станком ЧПУ' },
  { id: 'b_logistics', name: 'Логистическая компания', icon: '🚛', price: 800e6, rank: 6, req: { biz: 26 }, unit: 'рейсов',      perSlot: 120,  slot: 'Фура с водителем' },
  { id: 'b_gas',       name: 'Сеть АЗС',              icon: '⛽', price: 2e9,   rank: 6, req: { biz: 30 }, unit: 'заправок',    perSlot: 20e3, slot: 'Заправка с персоналом' },
  { id: 'b_factory',   name: 'Завод стройматериалов', icon: '🏭', price: 6e9,   rank: 7, req: { biz: 35 }, unit: 'тонн',        perSlot: 4000, slot: 'Производственная линия' },
  { id: 'b_it',        name: 'IT-холдинг',            icon: '🏢', price: 20e9,  rank: 7, req: { biz: 40 }, unit: 'проектов',    perSlot: 4,    slot: 'Команда разработчиков' },
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

// ---------- промокоды и значки ----------
// Коды хранятся не открытым текстом, а в виде SHA-256 от кода в ВЕРХНЕМ регистре без пробелов —
// так их не подсмотреть в файлах игры. Хэш для нового кода выдаёт тестовая панель (?debug → профиль).
// reward: money — рубли; tickets — { id кейса: сколько }; items — вещи сразу в имущество; badge — значок из BADGES;
// message — личное сообщение в окне активации.
// until — до какой даты (включительно) код работает; без until — бессрочно. Каждый код срабатывает на телефоне один раз.
const PROMO_CODES = [
  { hash: 'c37c4ebb553abdd981090aa5a9b0b1b557afe1cca78b302a54b9fc1634514f5f', label: 'Для первых игроков',
    until: '2026-11-30', reward: { money: 5e6, tickets: { car_new: 1, conn_forum: 1 }, badge: 'first' } },
  { hash: 'e6ce4116699e55cc3bab95ed51b9d3865ef609c0a771d3295ef249ff713f6a13', label: 'Подарок',
    reward: { money: 10e6, items: ['c_x5', 'h_newflat'], message: 'Моей хорошей девушке Кате ❤️' } },
];
const BADGES = {
  first: { name: 'Первый игрок', icon: 'crown' },
};

// ---------- гонки (драг на четверть мили) ----------
// Класс машины — по её редкости. Время заезда считается от мощности, а два нажатия игрока
// (старт по зелёному и переключение передачи в зелёной зоне) решают остальное.
// Не фарм: заездов в день ограничено, есть взнос, расход топлива, износ и поломки.
const CAR_HP = {
  c_2109: 70, c_2107: 75, c_matiz: 52, c_logan: 102, c_granta: 90, c_niva: 83, c_polo: 110, c_vesta: 106,
  c_solaris: 123, c_rio: 123, c_jolion: 143, c_tiggo: 147, c_octavia: 150, c_k5: 194, c_mazda6: 194, c_xtrail: 163,
  c_camry: 200, c_rav4: 199, c_tiguan: 180, c_monjaro: 238, c_eclass: 245, c_lc300: 409, c_x5: 340, c_cayenne: 353,
  c_gtr: 565, c_m5: 600, c_rs6: 600, c_sclass: 367, c_lx: 409, c_911: 385, c_g63: 585, c_bentley: 659,
  c_mclaren: 720, c_ferrari: 830, c_urus: 666, c_aventador: 770, c_phantom: 571, c_cullinan: 571,
  c_huayra: 730, c_jesko: 1600, c_chiron: 1500,
  c_moskvich: 75, c_lanos: 86, c_focus: 125, c_largus: 106, c_uaz: 150, c_corolla: 122, c_passat: 150, c_a4: 190, c_prado: 249, c_m3: 510, c_tesla: 1020, c_range: 400, c_amggt: 585, c_db11: 630, c_nevera: 1914, c_laferrari: 963,
};
// Ставки растут вместе с игроком. Единица ставки U = RACE_FEE_MONTHS месячного дохода × mult класса
// (не меньше RACE_FEE_MIN). Взнос и выплата уровня — в U: fee — платишь на старте, prize — получаешь при победе.
const RACE_CLASSES = {
  common:    { name: 'D', mult: 1 },
  rare:      { name: 'C', mult: 1.1 },
  epic:      { name: 'B', mult: 1.2 },
  legendary: { name: 'A', mult: 1.35 },
  mythic:    { name: 'S', mult: 1.5 },
};
const RACE_FEE_MONTHS = 0.15;
const RACE_FEE_MIN = 20e3;
// Пять уровней соперников. base — шанс победы на стоковой машине (Stage 0).
// Соперник уровня N сам затюнингован на Stage N−1, поэтому тюнинг двигает тебя вверх по лестнице:
// разница d = уровень − твой Stage; d ≤ 0 — 100%, d = 1 — 90% (если машина хоть немного затюнингована), d ≥ 2 — base[d].
// Ожидаемый выигрыш на заезд (в U): сток — лучше всего «Любитель» +0,5; Stage 5 на «Легенде» +2,4.
// На полном лимите (10 заездов в час) это +10–15% к доходу на стоке и до +45% (класс D) … +68% (класс S) на Stage 5.
const RACE_LEVELS = [
  { name: 'Новичок',  color: '#7bc68a', base: 100, fee: 0,   prize: 0.4 },
  { name: 'Любитель', color: '#b5d36b', base: 85,  fee: 0.5, prize: 1.2 },
  { name: 'Профи',    color: '#e6c372', base: 50,  fee: 1,   prize: 2.2 },
  { name: 'Мастер',   color: '#f0a35b', base: 30,  fee: 1.5, prize: 3.2 },
  { name: 'Легенда',  color: '#e5484d', base: 0,   fee: 2,   prize: 4.4 },
];
const RACE_NEAR_WIN = 90;            // шанс, когда соперник ровно на ступень сильнее твоей затюнингованной машины
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
//   mythic    — госномер: серии АМР и ЕКХ, только Москва. С ним ГИБДД не штрафует.
// value — стоимость (₽) в регионе с множителем 1; госномер стоит одинаково везде.
const PLATE_RARITY = {
  common:    { name: 'Обычный',   value: 8e3 },
  rare:      { name: 'Круглый',   value: 60e3 },
  epic:      { name: 'Красивый',  value: 400e3 },
  legendary: { name: 'Блатной',   value: 3e6 },
  mythic:    { name: 'Госномер',  value: 25e6 },
};
const PLATE_GOV = ['АМР', 'ЕКХ'];
const PLATE_GOV_CODES = ['77', '97', '99', '177', '199', '799'];
// Регион выбирает игрок: в Москве номера дороже — и набор стоит дороже (mult)
const PLATE_REGIONS = [
  { id: 'msk',  name: 'Москва',        mult: 3,   codes: ['77', '97', '99', '177', '197', '199', '777', '797', '799'] },
  { id: 'spb',  name: 'Петербург',     mult: 2,   codes: ['78', '98', '178', '198'] },
  { id: 'mo',   name: 'Подмосковье',   mult: 1.6, codes: ['50', '90', '150', '190', '750'] },
  { id: 'kzn',  name: 'Казань',        mult: 1.2, codes: ['16', '116', '716'] },
  { id: 'krd',  name: 'Краснодар',     mult: 1.2, codes: ['23', '93', '123', '193'] },
  { id: 'ekb',  name: 'Екатеринбург',  mult: 1.1, codes: ['66', '96', '196'] },
  { id: 'nsk',  name: 'Новосибирск',   mult: 1,   codes: ['54', '154'] },
  { id: 'vl',   name: 'Владивосток',   mult: 1,   codes: ['25', '125'] },
];
// Наборы номеров: w — шансы редкостей (%). Цена считается сама — PLATE_PRICE_RATE от ожидаемой стоимости
// для выбранного региона, как у кейсов. rank — с какого статуса доступен.
const PLATE_BOXES = [
  { id: 'p_basic', name: 'Обычный номер',    icon: '🔢', rank: 0, w: { common: 80, rare: 17, epic: 2.7, legendary: 0.28, mythic: 0.02 } },
  { id: 'p_good',  name: 'Улучшенный номер', icon: '✨', rank: 2, w: { common: 0, rare: 75, epic: 22, legendary: 2.8, mythic: 0.2 } },
  { id: 'p_nice',  name: 'Красивый номер',   icon: '💎', rank: 4, w: { common: 0, rare: 0, epic: 85, legendary: 14, mythic: 1 } },
];
const PLATE_PRICE_RATE = 0.95;
const PLATE_SELL_RATE = 0.85;        // номера держат цену лучше машин, но перепродажа — всё равно потеря

// ---------- бесплатные кейсы растут вместе с игроком ----------
// Ежедневный кейс: набор вещей зависит от статуса (индекс в RANKS) — от «копейки» до машин бизнес-класса.
const FREE_TIERS = [
  { rank: 0, items: ['c_2109', 'c_2107', 'c_matiz', 'h_bed', 'h_garage', 'c_moskvich', 'c_lanos'] },
  { rank: 2, items: ['c_2107', 'c_matiz', 'c_logan', 'c_granta', 'c_niva', 'h_bed', 'h_garage', 'h_dacha', 'h_village', 'c_largus', 'c_focus'] },
  { rank: 4, items: ['c_granta', 'c_niva', 'c_polo', 'c_vesta', 'c_solaris', 'c_rio', 'c_tiggo', 'c_octavia', 'h_dacha', 'h_village', 'h_room', 'h_studio', 'c_uaz', 'c_corolla', 'h_brezh'] },
  { rank: 6, items: ['c_solaris', 'c_rio', 'c_jolion', 'c_camry', 'c_k5', 'c_tiguan', 'c_eclass', 'h_room', 'h_studio', 'h_flat', 'h_newflat', 'h_house', 'c_passat', 'c_a4', 'h_kazan'] },
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
