# Mock Test Platform — Memory Index

| File | What it covers |
|---|---|
| [project-overview.md](project-overview.md) | Goals, scale, cost targets, source file map |
| [tech-stack.md](tech-stack.md) | Full tech stack — CF, AWS, clients, deploy, testing |
| [layer-registry.md](layer-registry.md) | All 33 layers, 245 modules with module numbers |
| [db-architecture.md](db-architecture.md) | Global DB schema, tenant DB schema, connection routing |
| [services.md](services.md) | CF Workers services + AWS Lambda services (endpoints, triggers, logic) |
| [question-schema.md](question-schema.md) | QID format, type codes, DB record, R2 content + solution file schemas |
| [bundle-delivery.md](bundle-delivery.md) | Bundle build, manifest, delivery, integrity, swap rules |
| [event-batching.md](event-batching.md) | P0-P7 priorities, DO batching, dynamic pA, file lifecycle |
| [sync-offline-encryption.md](sync-offline-encryption.md) | Client sync queue, offline engine, AES-GCM encryption |
| [tenant-rules.md](tenant-rules.md) | Tenant isolation, GID groups, dynamic T1/T2/T3 DB allocation, migration |
| [weakness-analysis.md](weakness-analysis.md) | Subject→topic→subtopic weakness scoring, status states, display rules |
| [observability.md](observability.md) | Alert thresholds, tiers, tooling (CF, Grafana, CloudWatch) |
| [non-negotiable-rules.md](non-negotiable-rules.md) | All 22 [!] non-negotiable rules |
| [growth-mode.md](growth-mode.md) | 4-phase infra growth plan — P0 free tier → P3 full scale, triggers + costs |
| [exam-module.md](exam-module.md) | Exam entity hierarchy, ID formats, section JSONB, bundle trigger — full doc in docs/exam-module.md |
| [repo-architecture.md](repo-architecture.md) | Turborepo monorepo, branch strategy (main/dev/prod), repo name, CI/CD, CODEOWNERS, backup |
| [module-architecture.md](module-architecture.md) | Module isolation, sub-modules, shared-lib components, registry, canary rollout, plugin registry |
| [tenant-architecture.md](tenant-architecture.md) | 3-level config hierarchy, PLATFORM_NAME env, tenant naming, RBAC roles, entitlements |
| [enterprise-standards.md](enterprise-standards.md) | Idempotency, API versioning, DPDP compliance, audit log, anti-cheat, SLOs, load testing, incidents |
| [change-design.md](change-design.md) | What changes vs what is locked — volatile in config, stable in code, migration rules, ADRs |
| [feedback-memory-before-git.md](feedback-memory-before-git.md) | Rule: update memory ONLY immediately before git push — not mid-task |
| [rrb-group-d-module.md](rrb-group-d-module.md) | First implemented module (v1.0.0) — canonical file layout, API routes, TSF structure, patterns |

## Exam Catalog — Individual Sub-modules (exams/)

### Engineering (exams/engineering/)
- [jee-main.md](exams/engineering/jee-main.md) | [jee-advanced.md](exams/engineering/jee-advanced.md) | [bitsat.md](exams/engineering/bitsat.md)
- [mht-cet.md](exams/engineering/mht-cet.md) | [kcet.md](exams/engineering/kcet.md) | [wbjee.md](exams/engineering/wbjee.md) | [comedk.md](exams/engineering/comedk.md)
- [ts-eamcet.md](exams/engineering/ts-eamcet.md) | [ap-eamcet.md](exams/engineering/ap-eamcet.md) | [ts-ecet.md](exams/engineering/ts-ecet.md) | [ap-ecet.md](exams/engineering/ap-ecet.md)

### Medical (exams/medical/)
- [neet-ug.md](exams/medical/neet-ug.md) | [neet-pg.md](exams/medical/neet-pg.md) | [fmge.md](exams/medical/fmge.md)

### Civil Services (exams/civil-services/)
- [upsc-cse.md](exams/civil-services/upsc-cse.md) | [upsc-nda.md](exams/civil-services/upsc-nda.md) | [upsc-cds.md](exams/civil-services/upsc-cds.md)
- [upsc-capf.md](exams/civil-services/upsc-capf.md) | [afcat.md](exams/civil-services/afcat.md)

### SSC (exams/ssc/)
- [cgl.md](exams/ssc/cgl.md) | [chsl.md](exams/ssc/chsl.md) | [mts.md](exams/ssc/mts.md) | [gd-constable.md](exams/ssc/gd-constable.md)
- [cpo.md](exams/ssc/cpo.md) | [je.md](exams/ssc/je.md) | [steno.md](exams/ssc/steno.md)

### RRB (exams/rrb/)
- [ntpc.md](exams/rrb/ntpc.md) | [group-d.md](exams/rrb/group-d.md) | [je.md](exams/rrb/je.md) | [alp.md](exams/rrb/alp.md) | [rpf.md](exams/rrb/rpf.md)

### Banking (exams/banking/)
- [ibps-po.md](exams/banking/ibps-po.md) | [ibps-clerk.md](exams/banking/ibps-clerk.md) | [ibps-rrb.md](exams/banking/ibps-rrb.md)
- [sbi-po.md](exams/banking/sbi-po.md) | [sbi-clerk.md](exams/banking/sbi-clerk.md)
- [rbi-grade-b.md](exams/banking/rbi-grade-b.md) | [rbi-assistant.md](exams/banking/rbi-assistant.md)
- [nabard.md](exams/banking/nabard.md) | [sebi.md](exams/banking/sebi.md) | [lic-aao.md](exams/banking/lic-aao.md)

### Teaching (exams/teaching/)
- [ctet.md](exams/teaching/ctet.md) | [ugc-net.md](exams/teaching/ugc-net.md) | [dsssb.md](exams/teaching/dsssb.md) | [kvs.md](exams/teaching/kvs.md)

### MBA (exams/mba/)
- [cat.md](exams/mba/cat.md) | [xat.md](exams/mba/xat.md) | [iift.md](exams/mba/iift.md) | [snap.md](exams/mba/snap.md) | [cmat.md](exams/mba/cmat.md)

### Law (exams/law/)
- [clat.md](exams/law/clat.md) | [ailet.md](exams/law/ailet.md)

### CA / CMA / CS (exams/ca-cma-cs/)
- [ca.md](exams/ca-cma-cs/ca.md) | [cma.md](exams/ca-cma-cs/cma.md) | [cs.md](exams/ca-cma-cs/cs.md)

### School Boards (exams/school/)
- [cbse-class10.md](exams/school/cbse-class10.md) | [cbse-class12.md](exams/school/cbse-class12.md)
- [icse.md](exams/school/icse.md) | [isc.md](exams/school/isc.md)

### Olympiads (exams/olympiad/)
- [ntse.md](exams/olympiad/ntse.md) | [imo.md](exams/olympiad/imo.md) | [nso.md](exams/olympiad/nso.md)
- [ieo.md](exams/olympiad/ieo.md) | [rmo-inmo.md](exams/olympiad/rmo-inmo.md)

### Telangana (exams/telangana/)
- [tspsc-group1.md](exams/telangana/tspsc-group1.md) | [tspsc-group2.md](exams/telangana/tspsc-group2.md)
- [tspsc-group3.md](exams/telangana/tspsc-group3.md) | [tspsc-group4.md](exams/telangana/tspsc-group4.md)
- [tspsc-aee.md](exams/telangana/tspsc-aee.md) | [tsgenco.md](exams/telangana/tsgenco.md)
- [ts-police-si.md](exams/telangana/ts-police-si.md) | [ts-police-constable.md](exams/telangana/ts-police-constable.md)
- [tstet.md](exams/telangana/tstet.md) | [ts-dsc.md](exams/telangana/ts-dsc.md)
- [ts-icet.md](exams/telangana/ts-icet.md) | [ts-lawcet.md](exams/telangana/ts-lawcet.md)

### Andhra Pradesh (exams/andhra-pradesh/)
- [appsc-group1.md](exams/andhra-pradesh/appsc-group1.md) | [appsc-group2.md](exams/andhra-pradesh/appsc-group2.md)
- [appsc-group3.md](exams/andhra-pradesh/appsc-group3.md) | [appsc-group4.md](exams/andhra-pradesh/appsc-group4.md)
- [appsc-aee.md](exams/andhra-pradesh/appsc-aee.md) | [apgenco.md](exams/andhra-pradesh/apgenco.md)
- [ap-police-si.md](exams/andhra-pradesh/ap-police-si.md) | [ap-police-constable.md](exams/andhra-pradesh/ap-police-constable.md)
- [aptet.md](exams/andhra-pradesh/aptet.md) | [ap-dsc.md](exams/andhra-pradesh/ap-dsc.md)
- [ap-grama-sachivalayam.md](exams/andhra-pradesh/ap-grama-sachivalayam.md)
- [ap-icet.md](exams/andhra-pradesh/ap-icet.md) | [ap-lawcet.md](exams/andhra-pradesh/ap-lawcet.md)
