import { useEffect, useState } from 'react';
import type { Trip, Place } from '../../data/schema';
import { tripNow, fmtDay, fmtWeekday, fmtRange, fmtShort, daysBetween, addDays, type TripNow } from '../../lib/time';
import { sunTimes } from '../../lib/sun';
import { phaseOf, tripLength, dayNumber, stopForNight, stopForDate, nextTransfer } from '../../lib/trip';
import { Tx, U } from './Tx';
import './today.css';

interface Props {
  trip: Pick<Trip, 'title' | 'startDate' | 'endDate' | 'stops' | 'days' | 'transfers'>;
  places: Pick<Place, 'id' | 'name' | 'tier' | 'note'>[];
}

function useTripNow() {
  const [now, setNow] = useState<TripNow | null>(null);
  useEffect(() => {
    setNow(tripNow());
    const id = setInterval(() => setNow(tripNow()), 30_000);
    const onVis = () => document.visibilityState === 'visible' && setNow(tripNow());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return now;
}

function useName() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    try {
      setName(localStorage.getItem('tc.name'));
    } catch {}
  }, []);
  return name;
}

export default function TodayView({ trip, places }: Props) {
  const now = useTripNow();
  const name = useName();
  if (!now) return <div className="today-skeleton" aria-hidden="true" />;

  const phase = phaseOf(trip, now.date);
  if (phase === 'before') return <Before trip={trip} now={now} name={name} />;
  if (phase === 'after') return <After trip={trip} />;
  return <During trip={trip} places={places} now={now} />;
}

function RouteChips({ trip }: Pick<Props, 'trip'>) {
  return (
    <ol className="route">
      {trip.stops.map((s, i) => (
        <li key={s.id} className={`chip chip-${s.country}`}>
          <a href={`/plan/${s.id}/`}>{s.name}</a>
          {i < trip.stops.length - 1 && <span className="arrow" aria-hidden="true">→</span>}
        </li>
      ))}
    </ol>
  );
}

function Before({ trip, now, name }: { trip: Props['trip']; now: TripNow; name: string | null }) {
  const left = daysBetween(now.date, trip.startDate);
  return (
    <>
      <p className="label head-label"><Tx v={trip.title} /></p>
      {name && <p className="muted hello"><U k="today.hello" />, {name}</p>}
      <section className="countdown card-strong">
        <span className="stamp"><U k="today.depart" /> {fmtShort(trip.startDate)}</span>
        <div className="big serif">{left}</div>
        <p className="big-label">{left === 1 ? <U k="today.dayLeft" /> : <U k="today.daysLeft" />}</p>
        <p className="muted">
          <Tx v={fmtDay(trip.startDate)} /> → <Tx v={fmtDay(trip.endDate)} /> · {tripLength(trip)} <U k="plan.days" />
        </p>
        <hr />
        <p className="aside quip"><U k="today.quip" /></p>
      </section>
      <h2 className="section-title"><U k="today.route" /></h2>
      <RouteChips trip={trip} />
    </>
  );
}

function After({ trip }: Pick<Props, 'trip'>) {
  return (
    <>
      <p className="label head-label"><Tx v={trip.title} /></p>
      <section className="countdown card-strong">
        <h1 className="serif done-title"><U k="today.doneTitle" /></h1>
        <p className="aside quip"><U k="today.doneText" /></p>
        <p className="muted"><Tx v={fmtRange(trip.startDate, trip.endDate)} /> · {tripLength(trip)} <U k="plan.days" /></p>
      </section>
      <h2 className="section-title"><U k="today.route" /></h2>
      <RouteChips trip={trip} />
    </>
  );
}

function During({ trip, places, now }: Props & { now: TripNow }) {
  const day = trip.days.find((d) => d.date === now.date);
  const stop = trip.stops.find((s) => s.id === day?.stopId) ?? stopForDate(trip.stops, now.date)!;
  const night = stopForNight(trip.stops, now.date);
  const stopDays = trip.days.filter((d) => d.stopId === stop.id).map((d) => d.date);
  const placeById = new Map(places.map((p) => [p.id, p]));

  const sunToday = sunTimes(now.date, stop.lat, stop.lng);
  const afterSunset = now.time > sunToday.sunset;
  const sunrise = afterSunset ? sunTimes(addDays(now.date, 1), stop.lat, stop.lng).sunrise : sunToday.sunrise;

  const items = day?.items ?? [];
  let current = -1;
  items.forEach((it, i) => {
    if (it.time && it.time <= now.time) current = i;
  });

  const transfer = nextTransfer(trip.transfers, now.date, now.time);
  const target = night ?? stop;

  return (
    <>
      <p className="label head-label">
        <U k="today.dayOf" /> {dayNumber(trip, now.date)}/{tripLength(trip)} · <Tx v={fmtDay(now.date)} />
      </p>
      <h1 className="serif city">{stop.name}</h1>
      <p className="muted sub">
        <U k={`country.${stop.country}` as const} /> ·{' '}
        <Tx v={{ et: `${stopDays.indexOf(now.date) + 1}. päev ${stopDays.length}-st`, en: `day ${stopDays.indexOf(now.date) + 1} of ${stopDays.length}` }} />
      </p>
      <span className="pill offline-pill"><U k="offline" /></span>

      <div className="sun-row">
        <div className="sun card-strong">
          <p className="label">{afterSunset ? <U k="today.sunriseTomorrow" /> : <U k="today.sunrise" />}</p>
          <p className="sun-time">{sunrise}</p>
        </div>
        <div className="sun card-strong">
          <p className="label"><U k="today.sunset" /></p>
          <p className="sun-time">{sunToday.sunset}</p>
        </div>
      </div>

      <section className="stops card-strong">
        <header>
          <h2><U k="today.stops" /></h2>
          <a href={`/plan/#d-${now.date}`} className="link"><U k="today.wholeDay" /></a>
        </header>
        {items.length === 0 && <p className="muted empty"><Tx v={day?.note} />{!day?.note && <U k="today.noStops" />}</p>}
        <ol>
          {items.map((it, i) => {
            const place = it.placeId ? placeById.get(it.placeId) : undefined;
            const state = i < current ? 'past' : i === current ? 'now' : 'next';
            return (
              <li key={i} className={`item ${state}`}>
                <span className="time">{it.time ?? ''}</span>
                <span className={`mk mk-${place?.tier ?? 'text'}`} />
                <span className="what">
                  {place ? (
                    <a href={`/map/?place=${place.id}`}>{place.name}</a>
                  ) : (
                    <Tx v={it.text} />
                  )}
                  {state !== 'past' && (
                    <small>
                      {state === 'now' ? <U k="today.now" /> : place ? <Tx v={place.note} /> : null}
                    </small>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="info-row">
        <div className="info">
          <p className="label">{night ? <U k="today.tonight" /> : <U k="today.goingHome" />}</p>
          {night ? (
            <>
              <p className="info-main">{night.hotel.name}</p>
              <p className="info-sub"><U k="today.checkout" /> <Tx v={fmtWeekday(night.depart)} /></p>
            </>
          ) : (
            <p className="info-sub"><Tx v={day?.note} /></p>
          )}
        </div>
        {transfer && (
          <div className="info">
            <p className="label"><U k="today.nextTransfer" /></p>
            <p className="info-main">
              {transfer.date !== now.date && <><Tx v={fmtWeekday(transfer.date)} /> </>}
              {transfer.time} <U k={`mode.${transfer.mode}` as const} />
            </p>
            <p className="info-sub">
              <Tx v={transfer.detail} />
            </p>
          </div>
        )}
      </div>

      <div className="actions">
        <a className="btn btn-big btn-primary" href={`/beacon/?hotel=${target.id}`}>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 2 20 22 12 17 4 22Z" fill="currentColor" /></svg>
          <U k="today.beacon" />
        </a>
        <a className="btn btn-big btn-ink" href={`/driver/?hotel=${target.id}`}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M3 15v-3l2-5h14l2 5v3H3Zm0 0v3h3v-3m12 0v3h3v-3M3 12h18" /></svg>
          <U k="today.driver" />
        </a>
      </div>
    </>
  );
}
