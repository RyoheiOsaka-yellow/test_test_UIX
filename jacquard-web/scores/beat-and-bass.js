// A demonstration score: a beat with a bass line on it.
//
// The startup score this port opened on is the original's own piece, and it is kept
// beside this one. What it does not do is show the thing a grid sequencer is easiest
// to hear — drums and a bass running against each other on one plane — so this is
// written for that, in the format the app itself writes.
//
// Seven lanes, one module's worth of idea each:
//
//   CH1  kick       a pitch envelope four octaves deep, which is most of what a kick is
//   CH2  snare      the same two operators with the feedback up, which is noise
//   CH3  accent     four steps of PREL over the hats, so every other sixteenth ducks
//   CH3  hats       sixteenths, with one PABS opening the gate on the last of the bar
//   CH4  bass       the line, with a GCYC over a JUMP that takes a fill every fourth lap
//   CH5  stab       chords off the beat, thrown at the delay
//   CH6  lead       a few notes in the reverb, each on a cycle of its own
//
// The accent lane is the idiom the original's sample score demonstrates: four steps
// against sixteen, no notes of its own, and placed above the lane it colours because
// what a lock reaches is whatever is processed after it.
//
// The bass jumps out at step twelve and the branch is four steps long, so a lap is
// sixteen either way.

export const BeatAndBass = `jacquard 11
tempo 124
meter 4 4
fx rsize=0.45 rdamp=0.55 rwidth=1 dbeats=0.375 dfb=0.42 dtone=0.35 dspread=1
limiter drive=3 ceiling=-1.5 attack=0.006 release=0.12
patch 1 level=0.9 pan=0 gate=0.6 mratio=1 index=2.5 fb=0 md=0.08 ca=0.001 cr=0.28 ps=4 pd=0.055 rsend=0 dsend=0
patch 2 level=0.85 pan=0 gate=0.4 mratio=3.4 index=7 fb=6.5 md=0.12 ca=0.001 cr=0.18 ps=1 pd=0.02 rsend=0.18 dsend=0
patch 3 level=0.36 pan=0.15 gate=0.08 mratio=7.6 index=8 fb=7.5 md=0.03 ca=0.001 cr=0.035 ps=0 pd=0.05 rsend=0.05 dsend=0
patch 4 level=0.62 pan=0 gate=0.92 mratio=1 index=3.2 fb=0.6 md=0.28 ca=0.002 cr=0.09 ps=0 pd=0.05 rsend=0 dsend=0
patch 5 level=0.45 pan=-0.25 gate=0.5 mratio=2 index=4.5 fb=0 md=0.22 ca=0.003 cr=0.22 ps=0 pd=0.05 rsend=0.25 dsend=0.45
patch 6 level=0.46 pan=0.3 gate=0.6 mratio=3 index=2.2 fb=0 md=0.45 ca=0.004 cr=0.35 ps=0 pd=0.05 rsend=0.5 dsend=0.3
patch 7 level=0.3 pan=0 gate=1.1975 mratio=2.575 index=1.8 fb=0 md=0.37772 ca=0.02595 cr=0.36 ps=0 pd=0.05 rsend=0 dsend=0
patch 8 level=0.3 pan=0 gate=1.1975 mratio=2.575 index=1.8 fb=0 md=0.37772 ca=0.02595 cr=0.36 ps=0 pd=0.05 rsend=0 dsend=0
lane 2 1 CHAN:1 div=16
  step C1
  step
  step
  step
  step C1
  step
  step
  step GPRB:35 C1
  step C1
  step
  step
  step
  step C1
  step
  step GPRB:45 C1
  step
lane 2 4 CHAN:2 div=16
  step
  step
  step
  step
  step D3
  step
  step
  step GPRB:30 PREL:level,-0.35 D3
  step
  step
  step GPRB:25 PREL:level,-0.4 D3
  step
  step D3
  step
  step
  step GPRB:35 PREL:level,-0.3 D3
lane 2 8 CHAN:3 div=16
  step PREL:level,0.12
  step
  step PREL:level,-0.28
  step
lane 2 9 CHAN:3 div=16
  step A6
  step A6
  step A6
  step A6
  step A6
  step A6
  step A6
  step A6
  step A6
  step A6
  step A6
  step A6
  step A6
  step A6
  step PABS:gate,0.6,carrelease,0.16 A6
  step A6
lane 2 12 CHAN:4 div=16
  step E1
  step
  step
  step E1
  step
  step
  step E1
  step GPRB:40 E1
  step G1
  step
  step B1
  step B1 GCYC:4,0001 JUMP
  step D2
  step
  step E1
  step GPRB:50 E2
lane 2 17 CHAN:5 div=16
  step
  step
  step E3 G3 B3
  step
  step
  step
  step GPRB:70 E3 G3 B3
  step
  step
  step
  step E3 A3 C4
  step
  step
  step
  step GPRB:60 D3 G3 B3
  step
lane 2 22 CHAN:6 div=16
  step GCYC:2,10 B4
  step
  step
  step
  step
  step
  step G4
  step
  step
  step
  step GCYC:4,0010 E5
  step
  step D5
  step
  step
  step GCYC:4,0001 B4
lane 8 26 JDST from=13,14
  step D2
  step E2
  step GPRB:60 F#2
  step G2
`
