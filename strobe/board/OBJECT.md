# OBJECT: Turbocharger

A single-scroll, wastegated, journal-bearing turbocharger for a 2.0 L petrol engine
(the size class with a ~60 mm compressor wheel). No brand, no logo, no part numbers from any maker.

Coordinates: **X is the shaft axis**, the natural assembly axis. Turbine (hot) end at −X, compressor
(cold) end at +X, origin at the centre of the bearing housing. +Z is up (oil in at the top, oil out at
the bottom). Units are millimetres.

---

## 1. Anatomy (46 parts)

`xv` is the explode vector in mm (x, y, z). Shells travel farthest, the core spreads along the shaft,
small parts follow the part they fasten. `tbase` is the working-state field value 0–1 (see §2).

### Shell (9)

| ID | Part | Material | xv (mm) | tbase |
|---|---|---|---|---|
| S01 | Turbine housing (volute, inlet flange, wastegate port) | cast SiMo ductile iron, raw cast skin, machined flange faces | (−170, 0, 0) | 0.92 |
| S02 | Compressor housing (volute, inducer bore, outlet) | cast A356 aluminium, machined inlet lip | (+185, 0, 0) | 0.30 |
| S03 | Bearing housing (centre housing) | grey cast iron, machined bores and flanges | (0, 0, 0) | 0.52 |
| S04 | Compressor backplate (seal plate) | cast aluminium, turned face | (+70, 0, 0) | 0.36 |
| S05 | Turbine heat shield | stamped 304 stainless | (−62, 0, 0) | 0.78 |
| S06 | Turbine V-band clamp | 304 stainless band | (−105, 0, 22) | 0.74 |
| S07 | Compressor clamp ring | spring steel, zinc plated | (+120, 0, 0) | 0.33 |
| S08 | Wastegate actuator canister | stamped steel, zinc plated | (+60, −95, 40) | 0.28 |
| S09 | Actuator bracket | stamped steel | (+95, −70, 25) | 0.30 |

### Core (10)

| ID | Part | Material | xv (mm) | tbase |
|---|---|---|---|---|
| C01 | Turbine wheel (11 blades, radial inflow) | Inconel 713C, as-cast blades, ground hub | (−118, 0, 0) | 0.88 |
| C02 | Shaft (journals, ring groove, threaded nose) | 4140 steel, ground and induction hardened | (−40, 0, 0) | 0.60 |
| C03 | Compressor wheel (6 + 6 splitter blades) | forged 2618 aluminium, 5-axis milled | (+138, 0, 0) | 0.26 |
| C04 | Journal bearing, turbine side (floating) | leaded bronze | (−22, 0, 0) | 0.58 |
| C05 | Journal bearing, compressor side (floating) | leaded bronze | (+22, 0, 0) | 0.46 |
| C06 | Bearing spacer | steel | (0, 0, 0) | 0.50 |
| C07 | Thrust bearing (360° pad, oil feed drilling) | sintered bronze | (+50, 0, 0) | 0.42 |
| C08 | Thrust collar | hardened steel | (+41, 0, 0) | 0.43 |
| C09 | Thrust spacer / oil slinger | hardened steel | (+60, 0, 0) | 0.40 |
| C10 | Oil deflector | stamped steel | (+56, 0, −14) | 0.40 |

### Small (27)

| ID | Part | Material | xv (mm) | tbase |
|---|---|---|---|---|
| F01 | Compressor lock nut (left-hand M6×1.0, 12-point) | steel | (+165, 0, 0) | 0.25 |
| F02 | Turbine piston-ring seal | cast iron ring | (−52, 0, 0) | 0.72 |
| F03 | Compressor piston-ring seal | cast iron ring | (+66, 0, 0) | 0.38 |
| F04 | Backplate O-ring | FKM rubber | (+64, 0, 0) | 0.37 |
| F05–F08 | Bearing retaining circlips ×4 | spring steel | (−30 / −14 / +14 / +30, 0, 0) | 0.48–0.58 |
| F09–F11 | Thrust bearing screws ×3 (M4×0.7, countersunk) | steel | (+78, 0, 0) | 0.41 |
| F12–F15 | Backplate bolts ×4 (M6×1.0, flanged hex) | steel, zinc plated | (+98, 0, 0) | 0.35 |
| F16–F19 | Turbine inlet studs ×4 (M10×1.5) | heat-resistant steel | (−170, 0, +42) | 0.94 |
| F20 | V-band T-bolt and nut (M6) | stainless | (−105, 0, 50) | 0.70 |
| F21 | Wastegate flapper valve | cast heat-resistant steel | (−205, −30, 0) | 0.96 |
| F22 | Wastegate arm and spindle | heat-resistant steel | (−190, −58, 0) | 0.90 |
| F23 | Wastegate bushing | stainless | (−178, −44, 0) | 0.88 |
| F24 | Actuator rod (threaded end M5) | steel | (0, −110, 30) | 0.45 |
| F25 | Rod-end E-clip | spring steel | (−150, −84, 6) | 0.80 |
| F26 | Oil inlet fitting with restrictor (M12×1.5) | steel, zinc plated | (0, 0, +85) | 0.44 |
| F27 | Oil drain flange, gasket and 2 bolts (M6) | steel / fibre gasket | (0, 0, −85) | 0.50 |

F27 is built as four objects (flange, gasket, two bolts), F05–F19 as one object each: 46 objects in all.

**Explode order.** Outer parts leave first by distance from the bearing housing: S01/S02 → clamps, actuator,
wastegate → heat shield, backplate → wheels → thrust stack → bearings and circlips. Reassembly is the exact
reverse. S03 never moves: it is the fixed reference and the seat point.

**Hero parts** (the camera dwells here, so they get sculpt-level detail): C01 turbine wheel (core lock
close-up), C03 compressor wheel, S01 and S02 volutes (cast skin, parting seam, bosses, machined faces),
S03 bearing housing (oil gallery bosses, cooling ribs).

---

## 2. The field: temperature

A turbocharger lives between an exhaust stream hot enough to make iron glow and an intake stream it must
not heat. Every design choice in it (Inconel wheel, heat shield, oil film, the long bearing housing) is
about that gradient. The field is **metal temperature, °C**.

| | Value |
|---|---|
| Unit | °C |
| Ambient / cold soak | 20 °C |
| Working range (full load, steady) | 20 °C at the compressor inlet → 830 °C at the turbine inlet |
| **Limit** | **950 °C** turbine inlet temperature (maximum continuous for the housing and wheel) |
| Film peak (over the limit) | 1 040 °C |
| Scale ceiling | 1 050 °C |

**One scale for every number on screen:**

```
T(v) = 20 + 1030 · v^1.6      [°C],  v = field value 0–1
```

| v | T | where |
|---|---|---|
| 0.00 | 20 °C | cold soak |
| 0.30 | 170 °C | compressor housing, working (compressed charge air) |
| 0.52 | 382 °C | bearing housing, working |
| 0.88 | 859 °C | turbine wheel, working |
| 0.92 | 921 °C | turbine housing, working: just under the limit |
| **0.951** | **950 °C** | **the limit** |
| 0.99 | 1 034 °C | turbine housing, peak |

Secondary readout (log only, derived from the same state curve `s`): shaft speed
`N = 4 000 + 176 000 · s` rpm, so idle 4 k, working 150 k, peak 180 k rpm. This also drives the pitch of the
machine voice (4 k → 180 k rpm is far more than two octaves, so the voice is mapped to two octaves over the
working act as the brief asks).

**Ramp (sRGB hex), defined once and used by the shader, legend and insets:**

| pos | hex | name |
|---|---|---|
| 0.00 | `#050B24` | navy |
| 0.18 | `#1239A6` | cobalt |
| 0.36 | `#9FD4FF` | ice |
| 0.46 | `#0A0B10` | unlit band |
| 0.56 | `#5A1206` | ember |
| 0.72 | `#D81E0A` | red |
| 0.88 | `#FF7A1A` | orange |
| 1.00 | `#FFF1DC` | near-white |

No green, no yellow-green. The ramp position is the field value `v`, so the limit (v = 0.951) sits between
orange and near-white: only over-limit metal goes white.

---

## 3. The story in four beats

1. **Cold, at rest** (frames 0–167). Engine off, everything soaked at 20 °C. The field pass in the diagnostic
   acts is a blue scan: noise damped, values 20–60 °C. The core-lock pulses are the machine *predicting* load
   on the turbine wheel, three short test pulses that stay under 200 °C.
2. **Working** (168–215). Exhaust gas arrives at the turbine inlet flange. A heat front runs along +X:
   inlet studs and wastegate → turbine housing → turbine wheel → heat shield → bearing housing → backplate →
   compressor wheel → compressor housing. A part switches to the field pass as the front reaches its centre.
   Turbine inlet climbs to 921 °C, shaft speed to 150 k rpm.
3. **Over the limit** (216–245). The wastegate sticks shut. Warning on frame 216; turbine inlet crosses
   **950 °C on frame 228** (first beat after the warning), which is when the alarm, the red and the 2.5 Hz
   flicker start. Peak on frame 240: turbine housing 1 034 °C near-white, wheel 1 000 °C, 180 k rpm. Every part
   is in the field pass. This is the most extreme frame of the film.
4. **Recovery** (246–269). Wastegate opens, boost drops. A cool front runs back from the compressor inlet
   along −X; a part returns to the solid pass once the front has passed it, and from then on it reads as
   recovered (under 200 °C and falling). The turbine housing is last.

Then the clean beat (270–287): the product alone, solid, light backdrop, running into frame 0.

---

## 4. Proportions (constants table, mm)

All geometry reads from `scripts/constants.py`, which mirrors this table.

| Constant | Value | Note |
|---|---|---|
| Overall length (X) | 196 | compressor inlet lip to turbine outlet face |
| Overall height (Z) | 178 | including oil fitting and drain flange |
| **Compressor** | | |
| Wheel inducer Ø | 46 | |
| Wheel exducer Ø | 60 | |
| Wheel height | 33 | hub length incl. nose |
| Blades | 6 full + 6 splitter | backswept 35° |
| Housing volute outer Ø | 142 | |
| Volute tube Ø, small → large | 16 → 40 | grows over 340° |
| Inlet bore Ø / lip outer Ø | 47 / 62 | |
| Outlet Ø | 50 (2 in hose) | tangential |
| Housing wall | 4.0 | |
| Backplate Ø / thickness | 120 / 9 | |
| **Turbine** | | |
| Wheel inducer Ø | 54 | |
| Wheel exducer Ø | 47 | |
| Wheel height | 34 | |
| Blades | 11 | |
| Housing volute outer Ø | 128 | |
| Volute tube Ø, small → large | 12 → 38 | |
| Inlet flange | 86 × 56, 12 thick | 4 studs M10, 68 × 38 pattern |
| Outlet Ø / V-band flange Ø | 60 / 76 | |
| Housing wall | 5.5 | |
| Wastegate port Ø / flapper Ø | 26 / 32 | |
| Heat shield Ø / thickness | 70 / 0.8 | |
| **Centre section** | | |
| Bearing housing length | 72 | |
| Bearing housing body Ø | 62 | |
| Turbine-side flange Ø | 92 | V-band |
| Compressor-side flange Ø | 104 | 4 × M6 on 88 PCD |
| Shaft journal Ø | 8.0 | |
| Shaft length | 122 | |
| Shaft nose thread | M6 × 1.0 LH | |
| Journal bearing OD / ID / length | 13.0 / 8.03 / 9 | 6 oil holes Ø 1.5 |
| Bearing span (centre to centre) | 36 | |
| Thrust bearing Ø / thickness | 46 / 4.5 | |
| Thrust collar Ø | 20 | |
| Piston ring Ø, turbine / compressor | 17 / 14 | 1.6 section |
| Oil inlet thread | M12 × 1.5 | 1.1 restrictor |
| Oil drain bore Ø | 16 | flange 2 × M6 on 38 centres |
| **Wastegate** | | |
| Actuator canister Ø / length | 62 / 44 | |
| Actuator rod Ø / length | 5 / 118 | |
| **Framing** | | |
| Main axis on screen | −27° | turbine lower left, compressor upper right |
