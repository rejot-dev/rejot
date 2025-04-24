---
title: "A short introduction to ReJot"
description: "ReJot is a synchronization engine that transfers operational data between product teams within
larger organizations. We're aiming to solve a technical and people problem by moving data as soon as
it is created. By letting teams define their data contract and having other teams pull in this data
declaratively, we avoid project management overhead as well as the technical integration burden."
author: "Wilco Kruijer"
publicationDate: "Jan 13 2025"
heroImage: "/rejot-logo-on-white.webp"
---

# In Short

ReJot is a synchronization engine that transfers operational data between product teams within
larger organizations. We're aiming to solve a technical and people problem by moving data as soon as
it is created. By letting teams define their data contract and having other teams pull in this data
declaratively, we avoid project management overhead as well as the technical integration burden.

# It's the Data, Stupid

We believe that cohesion between products is all about data:

- Data should be in the right place, at the right time (or before).
- Data has to be understood completely: only the team producing the data knows what the definition
  really is.

ReJot's **"integration through synchronization"** approach ties together the team, the product, and
the data. Teams own their data like they own their code. Only the team can decide if and how they
publish the data they produce. Only they can write the nuanced definition of the data.

ReJot in practice:

- Data owners create a contract, add transformations, and (if necessary) apply access control rules.
- Integrators find data that might enhance their product in the catalog and create derived data from
  it.
- ReJot keeps everything up-to-date.

By putting the data model in the center, we enhance the user experience by enabling deeper
integration between products. A big win is in developer productivity: by giving product engineers
the autonomy to define their own data sharing strategies, we keep hidden dependencies in check. Too
often have we seen ETL pipelines defined outside of the control of product teams, slowing down
feature development by making data schema change hard or impossible. Other wins are in cutting down
on repetitive integration tasks and cracking down on fragile reverse-ETL processes.

This all leads to less alignment required between teams, better user experience for your end users
and quicker development cycles for your engineers.

Signed,

Jan & Wilco, founders at ReJot
