# Routing Configuration and Diagnostics Guide

Language: English  
Updated: 2026-06-07

## 1. What problem does this solve?

Earlier FlowSim `connections` used fixed probability routing only, such as 50% to A and 50% to B. Real operations usually behave differently:

- They avoid stations that are already congested.
- VIP, urgent, or high-priority work follows different lanes.
- If no rule matches perfectly, the system still needs a safe fallback so items do not get stuck.

The new routing feature keeps the original probability model and adds **Load-aware routing**, **Time-aware / ETA routing**, **Item Profile filters**, **Priority filters**, and **Routing Diagnostics**.

---

## 2. Routing Strategy

In a node's **Connections / Routing** section, choose a routing strategy.

| Strategy | Behavior | Best for |
| --- | --- | --- |
| `Probability` | Selects only by each route's base weight | Stable percentage splits and simple rules |
| `Load-aware` | Keeps the base weight, then reduces the effective weight of congested targets | Multiple desks, shared pools, and automatic congestion avoidance |
| `Time-aware / ETA` | Keeps the base weight, then favors routes with shorter estimated completion time | Realistic routing where queue, capacity, processing time, and calendar availability matter |

### Probability

If a node has two routes:

| Route | Probability |
| --- | --- |
| Team A | 0.5 |
| Team B | 0.5 |

Over time, roughly half of the items go to A and half go to B. Even if A already has a queue, A can still keep receiving new items.

### Load-aware

Load-aware treats each route's `probability` as a **base weight**, then computes an effective weight from target load.

Conceptual formula:

```text
effective weight = base weight / (1 + load sensitivity × congestion)
```

`congestion` considers:

- Items waiting in the target queue
- Items actively processing at the target
- Inbound items already moving toward the target
- Target capacity

Higher `Load sensitivity` avoids congested targets more aggressively. A value of 0 behaves close to pure base weights.

### Time-aware / ETA

Time-aware routing treats each route's `probability` as a **base weight**, then estimates the target route's completion time.

The estimate includes:

- Queue work already waiting at the target
- Active work still processing at the target
- Inbound items already moving toward the target
- Target capacity and resource mode
- Expected processing time, including item profile processing multiplier
- Optional calendar delay from target business hours

Conceptual formula:

```text
effective weight = base weight / (1 + ETA sensitivity × relative delay)
```

`ETA sensitivity` controls how strongly FlowSim prefers the fastest estimated route. A value of 0 behaves close to base weights. With **Calendar-aware ETA** enabled, a route whose target is currently off-hours or has a shorter business window can become less attractive.

---

## 3. Route Filters

Each connection can restrict which items may use that route.

| Filter | Meaning | Example |
| --- | --- | --- |
| Item Profiles | Allow only selected Start node profiles | VIP goes to Fast Lane, Standard goes to normal queue |
| Min Priority | Allow only priority greater than or equal to the value | priority >= 5 may enter an urgent lane |
| Max Priority | Allow only priority less than or equal to the value | priority <= 3 uses standard handling |

Filters can be combined. If a route has both profile and priority filters, the item must satisfy both.

---

## 4. Fallback Logic

FlowSim avoids trapping items when rules are too strict. Every routing decision tries candidates in this order:

1. **Routes matching the filters**
2. **Routes with no filters**
3. **All valid routes**
4. If no valid route remains, the item ends as `finished`

Recommended pattern:

- Add filters to special-purpose routes, such as VIP Fast Lane.
- Keep at least one unfiltered route as the general fallback.
- Use Routing Diagnostics to check whether fallback usage is unexpectedly high.

---

## 5. Routing Demo Walkthrough

The toolbar **Routing Demo** button loads a sample model:

```text
Customer Demand Mix
├─ Standard → Standard Intake Router → General Team A / General Team B → Quality Check → End
└─ VIP      → VIP Intake Gate         → VIP Fast Lane                 → Quality Check → End
```

What to observe:

| Design | How to observe it |
| --- | --- |
| Start node creates Standard and VIP item profiles | Check profile probabilities and priority in the Start node |
| VIP route uses profile / priority filters | VIP items go through VIP Intake Gate and VIP Fast Lane |
| Standard Intake Router uses Time-aware / ETA routing | Team A opens later in the day, so calendar-aware ETA can initially favor Team B |
| VIP Intake Gate uses Load-aware routing | VIP work prefers the VIP Fast Lane but can use an overflow route if needed |
| Routing Diagnostics shows actual behavior | Watch Actual Share, Effective, Congestion, and Fallback |

Suggested steps:

1. Click **Routing Demo**.
2. Click **Start**.
3. Let the simulation run for several simulated minutes.
4. Watch the connection badges on the map.
5. Review the **Routing Diagnostics** table below the map.
6. Change General Team A capacity, processing time, or business hours, then compare route shares and ETA.

---

## 6. How to Read Routing Diagnostics

| Column | Meaning |
| --- | --- |
| Selected | Number of times this route was selected |
| Actual Share | This route's selected share among routes from the same source |
| Base | User-configured base probability / weight |
| Effective | Latest effective share after dynamic adjustment |
| ETA | Latest estimated queue + processing + calendar time for Time-aware routes |
| Congestion | Estimated current congestion of the target node |
| Fallback | How many selections happened after filter fallback |
| Profile Hits | Selections where the profile filter matched |
| Priority Hits | Selections where the priority filter matched |
| Mode | Whether the latest decision used Probability, Load-aware, or Time-aware |

Reading shortcuts:

- **Base ≠ Actual Share**: normal; randomness, filters, and load-aware adjustment can change results.
- **Effective lower than Base**: the target is likely more congested.
- **High ETA calendar delay**: the target calendar may be closed or have limited working hours.
- **High Fallback**: filters may be too strict or a general fallback route is missing.
- **High sustained Congestion**: the target may need more capacity or shorter processing time.

---

## 7. Modeling Recommendations

| Goal | Recommended setup |
| --- | --- |
| Fixed percentage allocation | Use `Probability`; keep total weight close to 100% |
| Balance multiple desks | Use `Load-aware`; start sensitivity around 1-4 |
| Choose fastest realistic lane | Use `Time-aware / ETA`; start sensitivity around 2-5 and enable Calendar-aware ETA |
| VIP / urgent priority | Use item profile filters or min priority on dedicated routes |
| Avoid trapping items | Keep at least one unfiltered route |
| Debug routing rules | Run the simulation and inspect Fallback and Actual Share in Routing Diagnostics |

---

## 8. FAQ

### Q: Does Load-aware always choose the shortest queue?

No. FlowSim still uses weighted random selection, but it reduces the weight of congested targets. This is more stable than always choosing the shortest queue and avoids every item rushing to the same newly empty node.

### Q: Do probabilities have to add up to 1?

They should be close to 1, but it is not required. FlowSim normalizes the effective candidate routes during simulation.

### Q: Why did VIP not go to the VIP lane?

Check:

1. The Start node is actually generating the VIP profile.
2. The VIP route's `itemProfileIds` contains the correct profile id.
3. The priority filter is not too high.
4. The route target still exists and is connected.

### Q: Why does Fallback appear?

It means the first pass found no route matching the filters. This is not always an error; the model may be using a normal route as a safe exit. If fallback is high, review the filter rules.
