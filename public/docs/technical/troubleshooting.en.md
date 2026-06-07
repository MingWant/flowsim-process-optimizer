# FlowSim Troubleshooting Guide

Language: English  
Updated: 2026-06-07

## 1. Docs do not open or language is wrong

| Symptom | Check | Fix |
| --- | --- | --- |
| Docs home does not open | Path should be `/docs/index.html` | Docs must live under `public/docs/` |
| Markdown does not open | File exists under `guide/` or `technical/` | Check `constants/documents.ts` paths |
| Language switch does not work | Alternates are configured | Add zh-TW, zh-CN, and en files |
| Relative links go to the wrong place | Link is relative to current Markdown | Use `../technical/file.md` or same-folder filenames |

---

## 2. Simulation creates no items

| Cause | Check | Fix |
| --- | --- | --- |
| Start not configured | Arrival Model, Rate / Interval, Batch size | Use positive arrival values |
| Off-hours arrivals are rejected | Business Hours + Non-working arrivals | Use queue / delay or adjust working hours |
| Schedule / Events not active | Calendar start, weekdays, months, date range | Adjust date filters or Stop Date |
| Demand Peaks set to zero | Global or Start-level multiplier | Use multiplier greater than 0 |
| No route to Process | Connections | Add a target and Probability |

---

## 3. Items queue but do not process

| Cause | Check | Fix |
| --- | --- | --- |
| Currently closed | Business Time Open / Closed | Adjust Working days / hours |
| Process custom calendar is closed | Calendar Override | Use Inherit or fix custom segments |
| Capacity is zero or too low | Process Basic | Set reasonable Capacity |
| Team config invalid | Explicit team total | Total resources must equal Capacity |
| Execution Mode limits concurrency | Team size, Max concurrent | Increase concurrency or reduce team size |

---

## 4. Queue keeps growing

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Long Queue, high Util. | Resources are overloaded | Add Capacity, reduce duration, reduce rework |
| Long Queue, low Util. | Closed calendar, routing, or override issue | Check Business Hours, Calendar Override, Connections |
| P90 rises quickly | Demand peak or complex items | Check Demand Peaks, Item Mix, Range |
| Rework causes congestion | Loop probability too high | Check connection probabilities and failures |

---

## 5. Connection warnings or broken flow

| Issue | Fix |
| --- | --- |
| Outgoing probabilities do not sum to 1.0 | Adjust route Probability values |
| End has no upstream step | Connect the last Process to End |
| Process has no exit | Add a downstream Process or End |
| Rework probability too high | Reduce rework or add capacity on rework steps |
| Pasted connections look wrong | Verify copy range; only valid internal connections are rebuilt |

---

## 6. Metrics look abnormal

| Symptom | Interpretation | Next step |
| --- | --- | --- |
| Calendar Wait very high | May include nights, weekends, lunch breaks | Switch to Both and compare Working Wait |
| Working Wait high | Real working-time congestion | Check Capacity, duration, rework, peaks |
| Diagnostic Working Wait high | A step may be blocked | Inspect step queue and utilization |
| Avg low but P90 high | A minority waits very long | Check complex items, rework, variability |
| Too few Finished items | Sample size too small | Extend Auto Pause or increase time compression |

---

## 7. Import / Export / Draft

| Symptom | Fix |
| --- | --- |
| Import replaced current flow | Expected; Export a backup before importing |
| Import failed | Ensure JSON came from FlowSim and was not manually corrupted |
| Draft is stale | Browser localStorage may have been cleared; use Export for long-term backup |
| IDs changed after copy/paste | Expected; IDs are rebuilt to avoid conflicts |

---

## 8. AI features

| Issue | Check |
| --- | --- |
| Generate Scenario unavailable | API Key is selected |
| Generated flow does not match business | AI output is a draft; verify Capacity, Connections, durations |
| Bottleneck analysis is generic | Run until enough items have finished |
| AI suggestion conflicts with metrics | Trust StatsBoard and domain knowledge first; AI is explanatory support |

---

## 9. Fast diagnosis sequence

1. No items: check Start.
2. Items do not move: check Business Hours and Process Capacity.
3. Queue exists: check Resource Utilization.
4. Utilization high: capacity or duration problem.
5. Utilization low: calendar, routing, or mode problem.
6. Metrics high: switch to Both and separate Calendar from Working.
7. Before reporting: confirm Auto Pause boundary and sample size.