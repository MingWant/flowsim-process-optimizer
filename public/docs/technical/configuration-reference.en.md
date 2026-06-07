# Configuration, Import/Export, and Data Model Reference

Language: English  
Updated: 2026-06-07

## 1. Configuration structure

The main FlowSim configuration type is `SimulationConfig`. It contains global settings and the step array.

| Field | Meaning |
| --- | --- |
| `steps` | All Start, Process, and End nodes |
| `isRunning` | Runtime state; import resets it to false |
| `speedMultiplier` | Speed multiplier |
| `timeCompression` | Sim Clock; simulated ms per real ms |
| `simulationMode` | `realistic` or `worst-case` |
| `calendarStartIso` | Calendar timestamp mapped to simulation time zero |
| `businessCalendar` | Global working calendar |
| `demandModifiers` | Global demand peaks |
| `autoPause` | Auto-pause conditions |
| `waitTimeCalculationMode` | `both`, `calendar`, or `working` |

---

## 2. Node data model

All nodes are `ProcessStep` objects and are distinguished by `type`.

| type | Core fields | Purpose |
| --- | --- | --- |
| `start` | arrivalModel, arrivalRate, arrivalSchedule, arrivalEvents, itemProfiles | Creates items |
| `process` | capacity, simulationMode, resourceExecutionMode, processingTime, failureProbability | Queues, processes, fails, cancels |
| `end` | endTimeUnit | Completion point and display unit |

All non-End nodes may have `connections`. Every node has `id`, `name`, `color`, `x`, and `y`.

---

## 3. Default sample flow

The default model is an online-order flow:

```text
Online Orders → Order Taking → Preparation → Quality Check → Packaging → Shipment
                         ↑                 |
                         └──── 10% rework ─┘
```

Important defaults: Start is 12 items/hour. Order Taking has Capacity 2, Processing 2 seconds, and Queue Cancellation 5%/sec. Preparation has Capacity 3, Processing 4 seconds, and 10% failure. Quality Check has Capacity 1, Processing 1.5 seconds, 5% failure, and routes 90% to Packaging and 10% back to Preparation. Packaging has Capacity 2 and Processing 1 second.

---

## 4. Import sanitization rules

The import entry point is `parseImportedConfig`. It accepts a direct `SimulationConfig` or a wrapped `{ config: ... }` export format.

| Item | Rule |
| --- | --- |
| Node type | Only start/process/end are accepted |
| Probability | Clamped to 0-1 |
| Connections | Invalid targets and self-links are removed, then probabilities are normalized |
| Capacity | Minimum 1 for Process nodes |
| Batch size | 1 to 1000 |
| Scheduled quantity | Maximum 50000 |
| Teams | Resources are positive integers |
| Explicit teams | Total team resources must equal Capacity before saving |
| Working hours | Invalid segments are ignored; default is 9-17 |
| Demand multiplier | Minimum 0.01 |
| Auto Pause target | Must be positive |

---

## 5. Multilingual Docs configuration

The in-app Docs menu is managed by `constants/documents.ts`.

| Field | Meaning |
| --- | --- |
| `id` | Unique document identifier |
| `title` | Menu title |
| `shortTitle` | Short title |
| `description` | Menu description |
| `category` | guide or technical |
| `defaultPath` | Default file path |
| `alternates` | zh-TW, zh-CN, en paths |

When adding a primary document, add all three language files, update `MARKDOWN_DOCS`, update the documentation index, and update README.

---

## 6. Draft and backup strategy

FlowSim stores drafts in browser localStorage. Drafts are useful for short-term recovery but should not be treated as durable backups.

Recommended practice:

- Export before important experiments.
- Export the current model before importing someone else's JSON.
- Use JSON files for sharing and versioning instead of relying on browser drafts.

---

## 7. Maintenance guidance

| Task | Recommendation |
| --- | --- |
| Add a field | Update `types.ts`, sanitization, defaults, and docs |
| Add a node mode | Update Step Editor, simulation core, StatsBoard, and import sanitization |
| Add a document | Add all three languages and update `constants/documents.ts` |
| Change algorithm semantics | Update algorithm docs, wait-time docs, and troubleshooting |
| Change metrics | Update StatsBoard explanation and technical metric docs |