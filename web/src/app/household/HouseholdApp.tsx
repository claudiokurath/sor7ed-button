"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./household.module.css";
import {
  type Assignee,
  type Frequency,
  type Household,
  type Responsibility,
  EXAMPLE,
  FREQ,
  FREQ_ORDER,
  computeLoad,
  emptyHousehold,
  fmt,
  loadHousehold,
  saveHousehold,
  uid,
} from "./logic";

type Filter = "all" | Assignee;

function TaskForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  nameOf,
}: {
  initial?: Responsibility;
  onSubmit: (item: Omit<Responsibility, "id" | "createdAt">) => void;
  onCancel?: () => void;
  submitLabel: string;
  nameOf: (assignee: Assignee) => string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [assignee, setAssignee] = useState<Assignee>(initial?.assignee ?? "A");
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? "weekly");
  const [error, setError] = useState("");
  const key = initial?.id ?? "new";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Add a name for this responsibility.");
      return;
    }
    onSubmit({ name: name.trim(), assignee, frequency });
    if (!initial) setName("");
    setError("");
  }

  return (
    <form className={styles.taskForm} onSubmit={submit} noValidate>
      <div className={styles.field}>
        <label htmlFor={`name-${key}`}>Responsibility</label>
        <input
          id={`name-${key}`}
          maxLength={80}
          placeholder="School forms, car maintenance"
          value={name}
          onChange={(event) => { setName(event.target.value); if (error) setError(""); }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `error-${key}` : undefined}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor={`assignee-${key}`}>Who carries it</label>
        <select id={`assignee-${key}`} value={assignee} onChange={(event) => setAssignee(event.target.value as Assignee)}>
          <option value="A">{nameOf("A")}</option>
          <option value="B">{nameOf("B")}</option>
          <option value="shared">Shared</option>
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor={`frequency-${key}`}>How often</label>
        <select id={`frequency-${key}`} value={frequency} onChange={(event) => setFrequency(event.target.value as Frequency)}>
          {FREQ_ORDER.map((value) => <option key={value} value={value}>{FREQ[value].label}</option>)}
        </select>
      </div>
      <div className={styles.formActions}>
        <button className={styles.primaryButton} type="submit">{submitLabel}</button>
        {onCancel && <button className={styles.secondaryButton} type="button" onClick={onCancel}>Cancel</button>}
      </div>
      {error && <p id={`error-${key}`} className={styles.validationError} role="alert">{error}</p>}
    </form>
  );
}

export default function HouseholdApp() {
  const [data, setData] = useState<Household>(() => emptyHousehold());
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<Frequency | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const result = loadHousehold();
    setData(result.data);
    setStorageError(result.error);
    if (result.migrated) {
      setNotice(`Moved ${result.migrated} responsibilities from the earlier version. Their saved frequencies were converted.`);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) setStorageError(saveHousehold(data));
  }, [data, ready]);

  const personName = (key: "A" | "B") => data.names[key].trim() || `Person ${key}`;
  const assigneeLabel = (assignee: Assignee) => assignee === "shared" ? "Shared" : personName(assignee);
  const load = useMemo(() => computeLoad(data.items), [data.items]);
  const visibleItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    return data.items
      .filter((item) =>
        (filter === "all" || item.assignee === filter) &&
        (frequencyFilter === "all" || item.frequency === frequencyFilter) &&
        (!search || item.name.toLowerCase().includes(search)),
      )
      .sort((a, b) => FREQ[b.frequency].perWeek - FREQ[a.frequency].perWeek || b.createdAt - a.createdAt);
  }, [data.items, query, filter, frequencyFilter]);

  function add(item: Omit<Responsibility, "id" | "createdAt">) {
    setData((current) => ({ ...current, items: [{ ...item, id: uid(), createdAt: Date.now() }, ...current.items] }));
  }
  function update(id: string, patch: Partial<Responsibility>) {
    setData((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }
  function remove(id: string) {
    setData((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
    setConfirmRemove(null);
  }
  function loadExample() {
    const now = Date.now();
    setData((current) => ({
      ...current,
      items: EXAMPLE.map((item, index) => ({ ...item, id: uid(), createdAt: now - index })),
    }));
  }

  const balance = load.total === 0
    ? { title: "Nothing yet", detail: "Add a responsibility to start" }
    : load.diff < 1
      ? { title: "Even", detail: "Within one task per week" }
      : { title: `${load.a > load.b ? personName("A") : personName("B")} carries more`, detail: `${fmt(load.diff)} more tasks per week` };

  return (
    <main className={styles.root}>
      <a className={styles.skipLink} href="#main">Skip to main content</a>
      <header className={styles.header}>
        <a className={styles.wordmark} href="/" aria-label="SOR7ED home">
          <strong>SOR7ED</strong><span>HOUSEHOLD</span>
        </a>
        <a className={styles.headerLink} href="#how">How the load is counted</a>
      </header>

      <div id="main">
        <section className={styles.intro}>
          <p className={styles.eyebrow}>LOAD BALANCER FOR TWO</p>
          <h1>Make the invisible work <em>visible.</em></h1>
          <p className={styles.lede}>List what keeps your home running, who carries it, and how often it comes round. The numbers show who holds what, so the conversation starts from facts.</p>
        </section>

        {(storageError || notice) && (
          <div className={styles.messages}>
            {storageError && (
              <div className={styles.alert} role="alert">
                <span>{storageError}</span>
                <button className={styles.secondaryButton} onClick={() => setStorageError(saveHousehold(data))}>Retry save</button>
              </div>
            )}
            {notice && (
              <div className={styles.notice} role="status">
                <span>{notice}</span>
                <button className={styles.secondaryButton} aria-label="Dismiss notice" onClick={() => setNotice(null)}>Dismiss</button>
              </div>
            )}
          </div>
        )}

        <section className={styles.panel} aria-labelledby="balance-heading">
          <h2 id="balance-heading">The balance</h2>
          <div className={styles.balanceGrid}>
            {(["A", "B"] as const).map((key) => (
              <div className={styles.scoreCard} key={key}>
                <label htmlFor={`person-${key}`}>Person {key} name</label>
                <input
                  id={`person-${key}`}
                  maxLength={24}
                  placeholder={`Person ${key}`}
                  value={data.names[key]}
                  onChange={(event) => setData((current) => ({ ...current, names: { ...current.names, [key]: event.target.value } }))}
                />
                <div className={styles.score} aria-label={`${personName(key)}: ${fmt(key === "A" ? load.a : load.b)} tasks per week`}>{fmt(key === "A" ? load.a : load.b)}</div>
                <p>tasks per week</p>
              </div>
            ))}
            <div className={styles.scoreCard}>
              <p className={styles.scoreLabel}>Balance</p>
              <div className={styles.balanceTitle} aria-live="polite">{balance.title}</div>
              <p>{balance.detail}</p>
              <div className={styles.barWrap}>
                <div className={styles.balanceBar} role="img" aria-label={`${personName("A")} ${Math.round(load.shareA * 100)} percent, ${personName("B")} ${Math.round((1 - load.shareA) * 100)} percent`}>
                  <span style={{ transform: `scaleX(${load.total ? load.shareA : 0})` }} />
                </div>
                <div className={styles.barLabels}>
                  <span>{personName("A")} {load.total ? Math.round(load.shareA * 100) : 0}%</span>
                  <span>{load.total ? Math.round((1 - load.shareA) * 100) : 0}% {personName("B")}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="add-heading">
          <h2 id="add-heading">Add a responsibility</h2>
          <TaskForm nameOf={assigneeLabel} onSubmit={add} submitLabel="Add responsibility" />
        </section>

        <section className={styles.responsibilities} aria-labelledby="list-heading">
          <div className={styles.listHeading}>
            <h2 id="list-heading">Responsibilities <span>{data.items.length}</span></h2>
            {data.items.length > 0 && (
              confirmClear
                ? <div className={styles.confirmActions}><span>Remove all {data.items.length}?</span><button className={styles.primaryButton} onClick={() => { setData((current) => ({ ...current, items: [] })); setConfirmClear(false); }}>Remove all</button><button className={styles.secondaryButton} onClick={() => setConfirmClear(false)}>Keep</button></div>
                : <button className={styles.secondaryButton} onClick={() => setConfirmClear(true)}>Clear list</button>
            )}
          </div>

          {data.items.length === 0 ? (
            <div className={styles.emptyState}>
              <div>
                <p className={styles.emptyScore} aria-hidden="true">0.00 / 0.00</p>
                <h3>Nothing on the list yet</h3>
                <p>Start with the things nobody sees: remembering birthdays, booking the dentist, noticing the milk is low. Add them above, or look at an example household first.</p>
              </div>
              <button className={styles.primaryButton} onClick={loadExample}>Load example household</button>
            </div>
          ) : (
            <>
              <div className={styles.filters}>
                <label className={styles.searchLabel} htmlFor="search">Search responsibilities</label>
                <input id="search" type="search" placeholder="Search responsibilities" value={query} onChange={(event) => setQuery(event.target.value)} />
                <div className={styles.chips} role="group" aria-label="Filter by person">
                  {(["all", "A", "B", "shared"] as Filter[]).map((value) => (
                    <button key={value} className={styles.chip} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "Everyone" : assigneeLabel(value)}</button>
                  ))}
                </div>
                <div className={styles.chips} role="group" aria-label="Filter by frequency">
                  {(["all", ...FREQ_ORDER] as const).map((value) => (
                    <button key={value} className={styles.chip} aria-pressed={frequencyFilter === value} onClick={() => setFrequencyFilter(value)}>{value === "all" ? "Any frequency" : FREQ[value].label}</button>
                  ))}
                </div>
              </div>

              {visibleItems.length === 0 ? (
                <div className={styles.noMatch}>
                  <h3>No match</h3><p>Nothing fits those filters.</p>
                  <button className={styles.secondaryButton} onClick={() => { setQuery(""); setFilter("all"); setFrequencyFilter("all"); }}>Reset filters</button>
                </div>
              ) : (
                <ul className={styles.itemList}>
                  {visibleItems.map((item) => (
                    <li className={styles.item} key={item.id}>
                      {editing === item.id ? (
                        <div className={styles.editForm}>
                          <TaskForm
                            initial={item}
                            nameOf={assigneeLabel}
                            submitLabel="Save"
                            onCancel={() => setEditing(null)}
                            onSubmit={(patch) => { update(item.id, patch); setEditing(null); }}
                          />
                        </div>
                      ) : (
                        <div className={styles.itemContent}>
                          <div className={styles.itemWeight}><strong>{fmt(FREQ[item.frequency].perWeek)}</strong><span>PER WEEK</span></div>
                          <div className={styles.itemDetails}>
                            <h3>{item.name}</h3>
                            <p>{FREQ[item.frequency].label}{item.assignee === "shared" ? " · split equally" : ""}</p>
                          </div>
                          <div className={styles.assignGroup} role="group" aria-label={`Reassign ${item.name}`}>
                            {(["A", "B", "shared"] as Assignee[]).map((assignee) => (
                              <button key={assignee} aria-pressed={item.assignee === assignee} onClick={() => update(item.id, { assignee })}>{assigneeLabel(assignee)}</button>
                            ))}
                          </div>
                          <div className={styles.itemActions}>
                            {confirmRemove === item.id
                              ? <><button className={styles.primaryButton} onClick={() => remove(item.id)}>Remove</button><button className={styles.secondaryButton} onClick={() => setConfirmRemove(null)}>Keep</button></>
                              : <><button className={styles.secondaryButton} aria-label={`Edit ${item.name}`} onClick={() => setEditing(item.id)}>Edit</button><button className={styles.secondaryButton} aria-label={`Remove ${item.name}`} onClick={() => setConfirmRemove(item.id)}>Remove</button></>}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section id="how" className={styles.panel} aria-labelledby="how-heading">
          <h2 id="how-heading">How it works</h2>
          <p className={styles.explainer}>Every responsibility is converted to <strong>equivalent tasks per week</strong>, so a daily chore and a yearly one can be compared fairly.</p>
          <div className={styles.tableWrap}>
            <table>
              <caption className={styles.srOnly}>Frequency and weekly load values</caption>
              <thead><tr><th>Frequency</th><th>Calculation</th><th>Tasks per week</th></tr></thead>
              <tbody>{FREQ_ORDER.map((frequency) => <tr key={frequency}><td>{FREQ[frequency].label}</td><td>{FREQ[frequency].formula}</td><td>{FREQ[frequency].perWeek.toFixed(3)}</td></tr>)}</tbody>
            </table>
          </div>
          <ul className={styles.explainerList}>
            <li>A person's load is the sum of their responsibilities per week.</li>
            <li>Shared responsibilities count as half for each person.</li>
            <li>The balance reads even when the gap is under one task per week.</li>
            <li>Your information is stored only in this browser.</li>
          </ul>
        </section>
      </div>

      <footer className={styles.footer}><strong>SOR7ED</strong><span>Stored locally on this device</span></footer>
    </main>
  );
}
