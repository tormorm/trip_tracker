// Shared by the driver and lost cards: show one pre-rendered hotel card.
import { tripNow } from './time';
import { defaultStopId } from './trip';

export interface StopsData {
  startDate: string;
  endDate: string;
  stops: { id: string; arrive: string; depart: string; lat: number; lng: number; name: string; country: 'VN' | 'KH'; hotel: { name: string; lat: number; lng: number } }[];
}

export function readStopsData(): StopsData {
  return JSON.parse(document.getElementById('stops-data')!.textContent!);
}

/** Initial hotel: ?hotel=<stopId> if valid, else tonight's. */
export function initialStopId(data: StopsData): string {
  const q = new URLSearchParams(location.search).get('hotel');
  return q && data.stops.some((s) => s.id === q) ? q : defaultStopId(data as any, tripNow().date);
}

export function initHotelPicker() {
  const data = readStopsData();
  const select = document.querySelector<HTMLSelectElement>('[data-hotel-select]');
  const show = (id: string) => {
    document.querySelectorAll<HTMLElement>('[data-hotel]').forEach((el) => (el.hidden = el.dataset.hotel !== id));
    document.querySelectorAll<HTMLAnchorElement>('[data-hotel-link]').forEach((a) => (a.href = `${a.dataset.hotelLink}?hotel=${id}`));
    if (select) select.value = id;
  };
  show(initialStopId(data));
  select?.addEventListener('change', () => {
    const url = new URL(location.href);
    url.searchParams.set('hotel', select.value);
    history.replaceState(null, '', url);
    show(select.value);
  });
  document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => (history.length > 1 && document.referrer.startsWith(location.origin) ? history.back() : location.assign('/'))),
  );
}
