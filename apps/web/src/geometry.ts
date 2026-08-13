/**
 * Hull loft: turns the offsets table into render geometry.
 *
 * Ship frame (x fore, y stbd, z up) maps to three.js as
 *   three.X = ship x,  three.Y = ship z,  three.Z = ship y
 */

import * as THREE from 'three';
import { halfBreadthAt, type HullGeometry, type Station } from '@dock/shared';

const WL_SAMPLES = 24;

function sampleStation(station: Station, samples: number): { z: number; y: number }[] {
  const zTop = station.offsets.length ? station.offsets[station.offsets.length - 1].z : 0;
  const out: { z: number; y: number }[] = [];
  for (let j = 0; j < samples; j++) {
    const z = (zTop * j) / (samples - 1);
    out.push({ z, y: Math.max(0, halfBreadthAt(station, z)) });
  }
  return out;
}

export interface HullMeshData {
  surface: THREE.BufferGeometry;
  stationLines: THREE.BufferGeometry;
  deckLine: THREE.BufferGeometry;
}

export function buildHullGeometry(hull: HullGeometry): HullMeshData {
  const stations = hull.stations;
  const nSt = stations.length;
  const nWl = WL_SAMPLES;
  const grid = stations.map((s) => sampleStation(s, nWl));

  // vertices: starboard sheet then port sheet
  const positions: number[] = [];
  const push = (x: number, z: number, y: number) => positions.push(x, z, y);
  for (let i = 0; i < nSt; i++) {
    for (let j = 0; j < nWl; j++) {
      push(stations[i].x, grid[i][j].z, grid[i][j].y);
    }
  }
  const portBase = nSt * nWl;
  for (let i = 0; i < nSt; i++) {
    for (let j = 0; j < nWl; j++) {
      push(stations[i].x, grid[i][j].z, -grid[i][j].y);
    }
  }

  const indices: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip = false) => {
    if (flip) indices.push(a, c, b, b, c, d);
    else indices.push(a, b, c, b, d, c);
  };
  for (let i = 0; i < nSt - 1; i++) {
    for (let j = 0; j < nWl - 1; j++) {
      const s00 = i * nWl + j;
      const s01 = i * nWl + j + 1;
      const s10 = (i + 1) * nWl + j;
      const s11 = (i + 1) * nWl + j + 1;
      quad(s00, s10, s01, s11);
      const p00 = portBase + s00;
      const p01 = portBase + s01;
      const p10 = portBase + s10;
      const p11 = portBase + s11;
      quad(p00, p10, p01, p11, true);
    }
  }
  // deck cap between the two top waterlines
  for (let i = 0; i < nSt - 1; i++) {
    const sTop0 = i * nWl + (nWl - 1);
    const sTop1 = (i + 1) * nWl + (nWl - 1);
    quad(portBase + sTop0, portBase + sTop1, sTop0, sTop1);
  }

  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  surface.setIndex(indices);
  surface.computeVertexNormals();

  // station section outlines (every other station for a drafting-table look)
  const linePos: number[] = [];
  for (let i = 0; i < nSt; i += 2) {
    for (let j = 0; j < nWl - 1; j++) {
      linePos.push(stations[i].x, grid[i][j].z, grid[i][j].y);
      linePos.push(stations[i].x, grid[i][j + 1].z, grid[i][j + 1].y);
      linePos.push(stations[i].x, grid[i][j].z, -grid[i][j].y);
      linePos.push(stations[i].x, grid[i][j + 1].z, -grid[i][j + 1].y);
    }
    // close across the deck
    linePos.push(stations[i].x, grid[i][nWl - 1].z, grid[i][nWl - 1].y);
    linePos.push(stations[i].x, grid[i][nWl - 1].z, -grid[i][nWl - 1].y);
  }
  const stationLines = new THREE.BufferGeometry();
  stationLines.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));

  // sheer line (deck edge), both sides
  const deckPos: number[] = [];
  for (let i = 0; i < nSt - 1; i++) {
    const a = grid[i][nWl - 1];
    const b = grid[i + 1][nWl - 1];
    deckPos.push(stations[i].x, a.z, a.y, stations[i + 1].x, b.z, b.y);
    deckPos.push(stations[i].x, a.z, -a.y, stations[i + 1].x, b.z, -b.y);
  }
  const deckLine = new THREE.BufferGeometry();
  deckLine.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));

  return { surface, stationLines, deckLine };
}
