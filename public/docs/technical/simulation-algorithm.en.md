# FlowSim Simulation Algorithm Guide

Language: English  
Updated: 2026-06-07

## 1. Execution model

The simulation core lives in `hooks/useProcessSimulation.ts`. FlowSim is driven by browser animation frames: each tick advances simulated time, creates arrivals, allocates resources, advances processing, settles terminal items, and refreshes statistics.

Tick sequence: compute delta time → create Start arrivals → count current resource usage → start queued items → process transmitting/processing items → drain due business events → apply queue cancellation and settlement → update UI.

---

## 2. Time advancement

Real frame delta is capped at 100 ms to avoid huge jumps after browser lag or backgrounding.

$$
\Delta t_{sim}=\min(\Delta t_{real},100ms)\times speedMultiplier\times timeCompression
$$

`speedMultiplier` comes from Speed. `timeCompression` comes from Sim Clock. React UI is updated about every 33 ms while simulation logic continues between updates.

---

## 3. WorkItem state machine

| State | Meaning |
| --- | --- |
| `transmitting` | Visual movement to the next node; business transmission time is 0 |
| `queued` | Waiting for resources or working time |
| `processing` | Active processing or delay |
| `finished` | Completed successfully |
| `cancelled` | Queue cancellation; off-hours reject increments Cancelled without creating a WorkItem |
| `error` | Processing failure |

Transmission animation lasts about 900 ms visually but does not add business cycle time.

---

## 4. Start arrival algorithms

### Simple

Rate mode:

$$
nextDelay=\frac{unitMs\times batchSize}{arrivalRate\times demandMultiplier}
$$

Interval mode:

$$
nextDelay=\frac{arrivalInterval\times unitMs}{demandMultiplier}
$$

Range mode samples a random value between min and max. Higher demand multiplier means more frequent arrivals.

### Schedule

`burst` dispatches `quantity × demandMultiplier` at the window start. `spread` distributes the adjusted quantity evenly through the window. Filters include weekdays, months, startDate, and endDate.

### Events

Events are based on `dayOffset + hour` or `startDate + hour`. Repeat supports Once, Daily, Working days, Weekly, Monthly, and Yearly. `sequence` dispatches one item at a time using item interval; `burst` dispatches all at once.

---

## 5. Off-hours arrivals

Start arrivals check the effective calendar:

| Policy | Behavior |
| --- | --- |
| `queue` | Create items and let them enter the flow |
| `delay` | Move the arrival slot to the next working segment |
| `reject` | Do not create items; increment cancelled count |

---

## 6. Routing and resource allocation

Connections are sampled after normalizing probabilities by their total. If a node has no outgoing connection, the item goes to finished.

Resource queue order: higher priority first; ties are resolved by earlier queue time, then earlier creation time.

| Execution Mode | Algorithm |
| --- | --- |
| Single | One item consumes one resource |
| Collaborative | An item consumes multiple resources; explicit teams handle one item per team |
| Multitask | Item capacity is `capacity × maxConcurrentItemsPerResource` |

Default collaborative speed is approximately `1 + (resources - 1) × 0.65`. Default multitask speed decreases as concurrent load increases, down to about 0.25.

---

## 7. Processing duration

Duration source priority: Source Rule → Range → Fixed.

| Mode | Fixed + Variance behavior |
| --- | --- |
| Realistic | Normal random noise, clamped between base × 0.2 and base × 3 |
| Worst-Case | Uniform random `base × (1 ± variance)` |

Actual duration:

$$
actualDuration=\frac{baseDuration\times profileTimeFactor}{executionSpeedMultiplier}
$$

---

## 8. Business calendar

Calendar logic is in `services/simulationCalendar.ts`. `isWorkingTime` checks whether a time is open. `getNextWorkingSimulationTime` finds the next open segment. `addWorkingDuration` adds work duration while skipping closed time. `getWorkingDurationBetween` computes working-time overlap.

Processing starts are moved to the next open segment. Processing ends use `addWorkingDuration`, so work pauses across nights, weekends, or lunch breaks.

---

## 9. Failure, cancellation, and statistics

Failure chance:

$$
failChance=clamp(step.failureProbability\times item.failureMultiplier,0,1)
$$

Queue cancellation: Realistic uses `1 - exp(-p × seconds)`. Worst-Case uses `min(1, p × seconds)`.

Only finished items enter cycle-time samples. Calendar Cycle is created-to-completed elapsed time. Global Working Cycle uses the global calendar. Operational Working Cycle is `totalWorkingWaitTime + totalProcessingTime`. Off-hours Delay is Calendar Cycle minus Global Working Cycle.

---

## 10. Safety limits

| Limit | Value |
| --- | --- |
| Max spawns per Start per tick | 1000 |
| Max business events processed per tick | 5000 |
| Max UI-rendered items | 900 |
| transmitting / processing / queued render caps | 420 / 320 / 120 |

These are browser real-time simulation safeguards, not theoretical business model limits.