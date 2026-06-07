# FlowSim Documentation Index

Language: English  
Updated: 2026-06-07

## 1. Document entry points

| Document | Purpose | 繁體中文 | 简体中文 | English |
| --- | --- | --- | --- | --- |
| User Guide | Full system operations, nodes, metrics, templates | [開啟](user-guide.md) | [打开](user-guide.md) | [Open](user-guide.md) |
| Wait Time Quick Reference | Five-minute decision table and reading shortcuts | [開啟](wait-time-quick-reference.zh-TW.md) | [打开](wait-time-quick-reference.zh-CN.md) | [Open](wait-time-quick-reference.en.md) |
| Wait Time Mode Guide | Three modes, scenarios, FAQ | [開啟](wait-time-mode-configuration.zh-TW.md) | [打开](wait-time-mode-configuration.zh-CN.md) | [Open](wait-time-mode-configuration.en.md) |
| Dual Wait Time Metrics | Metric definitions, aggregation, interpretation | [開啟](../technical/dual-wait-time-metrics.zh-TW.md) | [打开](../technical/dual-wait-time-metrics.zh-CN.md) | [Open](../technical/dual-wait-time-metrics.en.md) |
| Simulation Algorithm | Tick loop, arrivals, resources, calendar, statistics | [開啟](../technical/simulation-algorithm.zh-TW.md) | [打开](../technical/simulation-algorithm.zh-CN.md) | [Open](../technical/simulation-algorithm.en.md) |
| Simulation Mode Guide | Realistic, Worst-Case, resource execution modes | [開啟](../technical/simulation-mode-guide.zh-TW.md) | [打开](../technical/simulation-mode-guide.zh-CN.md) | [Open](../technical/simulation-mode-guide.en.md) |
| Multi-Segment Business Hours | Business Hours, queue/delay/reject, Override | [開啟](../technical/multi-segment-business-hours.zh-TW.md) | [打开](../technical/multi-segment-business-hours.zh-CN.md) | [Open](../technical/multi-segment-business-hours.en.md) |
| Troubleshooting | Symptom → check → fix | [開啟](../technical/troubleshooting.zh-TW.md) | [打开](../technical/troubleshooting.zh-CN.md) | [Open](../technical/troubleshooting.en.md) |
| Configuration Reference | Config structure, import sanitization, Docs maintenance | [開啟](../technical/configuration-reference.zh-TW.md) | [打开](../technical/configuration-reference.zh-CN.md) | [Open](../technical/configuration-reference.en.md) |

---

## 2. Recommended reading paths

| Scenario | Reading path |
| --- | --- |
| First-time use | User Guide → Wait Time Quick Reference → Troubleshooting |
| SLA report | Wait Time Mode Guide → Dual Wait Time Metrics → Quick Reference |
| Capacity planning | User Guide → Simulation Mode Guide → Dual Wait Time Metrics |
| Algorithm semantics | Simulation Algorithm → Dual Wait Time Metrics → Configuration Reference |
| Business-hours tuning | Multi-Segment Business Hours → Wait Time Mode Guide → Dual Wait Time Metrics |
| Bottleneck diagnosis | Quick Reference → Dual Wait Time Metrics → Troubleshooting |
| Documentation maintenance | This index → `public/docs/README.md` → `constants/documents.ts` |

---

## 3. Directory policy

| Directory | Purpose |
| --- | --- |
| `public/docs/guide/` | User-facing guides and quick references |
| `public/docs/technical/` | Metric definitions, mode descriptions, troubleshooting, implementation concepts |
| `public/docs/archive/` | Historical records and old materials; not the main entry point |

When adding a primary document:

1. Add all three language files.
2. Update `constants/documents.ts`.
3. Update this documentation index.
4. Verify the in-app Docs menu and Markdown language switcher.