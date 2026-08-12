// The controls a panel is built out of.
//
// A number is a bar, not a field: the readout sits on a bar that fills as the value
// rises, dragging scrubs it and a double click types an exact one, so a parameter
// shows where it sits inside its useful range as well as what it is. What that range
// is comes from the synth itself, which is what lets a lock's amount be read against
// what it moves; typing is deliberately not held to it.
//
// A bar reports twice, and the second report is what sounds a note. The setter runs at
// every value a scrub passes through, because the model has to be current — the
// sequencer may well be playing through the edit. settled runs once the number has
// stopped moving instead: at the end of a drag, or immediately for anything that was
// never a drag, since a typed value arrives already decided.
//
// Travel is a ratio wherever the range spans decades, and an exponent is the wrong
// shape for one: a geometric bar moves every pixel by the same ratio rather than by
// the same amount, and prints three figures wherever the value stands.

export function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

export function button(label, onClick, className = '') {
  const node = element('button', 'control button ' + className, label)
  node.addEventListener('click', event => {
    event.stopPropagation()
    onClick(event)
  })
  return node
}

// A button that is on while it is held rather than reporting on the release.
//
// The stock click reports on the release and captures the pointer to decide whether
// the release counts, so a press and a release read through it arrive together at the
// end and the effect is never on for any length of time. What is left is a box dressed
// as a button with the press and the lost capture read directly — the lost capture and
// not the release, because a capture can go without one, and an effect latched on is
// the one failure this control cannot have.
export function holdButton(label, onPress, onRelease, className = '') {
  const node = element('button', 'control button hold ' + className, label)

  const down = event => {
    event.preventDefault()
    event.stopPropagation()
    node.setPointerCapture(event.pointerId)
    node.classList.add('held')
    onPress()
  }

  const up = () => {
    if (!node.classList.contains('held')) return
    node.classList.remove('held')
    onRelease()
  }

  node.addEventListener('pointerdown', down)
  node.addEventListener('pointerup', up)
  node.addEventListener('pointercancel', up)
  node.addEventListener('lostpointercapture', up)

  // A key held down is the same gesture with a different hand, and the panel is meant
  // to be played with both.
  node.addEventListener('keydown', event => {
    if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return
    event.preventDefault()
    node.classList.add('held')
    onPress()
  })

  node.addEventListener('keyup', up)
  node.addEventListener('blur', up)

  return node
}

// A panel: a header that says what it is showing rather than what it is called, a rule
// under it, and rows.
export function panel(title, className = '') {
  const node = element('div', 'panel ' + className)

  if (title != null) {
    node.appendChild(element('div', 'panel-header', title))
    node.appendChild(element('div', 'panel-rule'))
  }

  return node
}

export function heading(text) {
  return element('div', 'heading', text)
}

export function row(...children) {
  const node = element('div', 'row')
  for (const child of children) node.appendChild(child)
  return node
}

// A number stepped rather than scrubbed, which is what a count of cells has to be
// since each one is a cell and growing can be refused.
export function stepper(label, value, onStep, canStep = () => true) {
  const node = element('div', 'stepper')

  node.appendChild(element('span', 'caption', label))

  const down = button('−', () => onStep(-1), 'small')
  const readout = element('span', 'readout', String(value))
  const up = button('+', () => onStep(1), 'small')

  down.disabled = !canStep(-1)
  up.disabled = !canStep(1)

  node.append(down, readout, up)
  return node
}

const clamp = (value, low, high) => value < low ? low : value > high ? high : value

// Three figures wherever the value stands — 1.05, 44.7, 299, 2000 — which move exactly
// when the value does, and a bare 0 at the bottom where the number is a setting rather
// than a quantity.
function significant(value) {
  if (value === 0) return '0'

  const magnitude = Math.abs(value)
  const decimals = magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : magnitude >= 1 ? 2 : 3

  return value.toFixed(decimals)
}

// A bar. taper is 'linear' or 'geometric'; a range whose bottom is negative fills out
// from the centre rather than from the left edge.
export function valueBar(options) {
  const {
    label, min, max, taper = 'linear', get, set,
    settled = null, format = null, engaged = null, onRelease = null, hue = null
  } = options

  const node = element('div', 'value-bar')
  const fill = element('div', 'value-fill')
  const caption = element('span', 'value-label', label)
  const readout = element('span', 'value-readout')

  node.append(fill, caption, readout)

  // Where this row sits in the run of rows it belongs to. Only the neon theme reads
  // it, and what it does with it is light the fill: a panel of thirteen parameters is
  // a spectrum rather than thirteen of the same bar.
  if (hue != null) node.style.setProperty('--hue', hue)

  // A geometric travel needs somewhere to start from, since no number of ratios
  // reaches zero: a millisecond is the shortest time this synth has any use for, and
  // where a parameter's own low end is zero the bottom pixel keeps it.
  const floor = Math.max(min, 0.001)

  const toNormalized = value => {
    if (taper === 'geometric') {
      if (value <= floor) return 0
      return Math.log(value / floor) / Math.log(max / floor)
    }
    return (value - min) / (max - min)
  }

  const fromNormalized = p => {
    p = clamp(p, 0, 1)
    if (taper === 'geometric') return p <= 0 ? min : floor * Math.pow(max / floor, p)
    return min + p * (max - min)
  }

  const refresh = () => {
    const value = get()
    const p = clamp(toNormalized(value), 0, 1)

    // Symmetric about the centre, which is what tells the bar to draw itself out from
    // where the note is unpanned rather than from the left edge.
    if (min < 0) {
      const centre = toNormalized(0)
      const left = Math.min(p, centre)
      fill.style.left = (left * 100) + '%'
      fill.style.width = (Math.abs(p - centre) * 100) + '%'
    } else {
      fill.style.left = '0'
      fill.style.width = (p * 100) + '%'
    }

    readout.textContent = format ? format(value)
      : taper === 'geometric' ? significant(value) : significant(value)

    node.classList.toggle('idle', engaged != null && !engaged())
  }

  let dragging = false
  let last = 0
  let moved = false

  node.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    node.setPointerCapture(event.pointerId)
    dragging = true
    moved = false
    last = event.clientX
  })

  node.addEventListener('pointermove', event => {
    if (!dragging) return

    const dx = event.clientX - last
    if (dx === 0) return

    last = event.clientX
    moved = true

    const width = node.clientWidth || 1
    set(fromNormalized(toNormalized(get()) + dx / width))
    refresh()
  })

  const finish = event => {
    if (!dragging) return
    dragging = false
    node.releasePointerCapture?.(event.pointerId)

    // A tap on the name is how a lock lets a parameter go: the whole row is the bar,
    // so the gesture that means "stop holding this" has to be the one that moved
    // nothing.
    if (!moved && onRelease != null && event.target === caption) {
      onRelease()
      refresh()
      return
    }

    if (settled) settled(get())
  }

  node.addEventListener('pointerup', finish)
  node.addEventListener('pointercancel', finish)

  // Typing is deliberately not held to the range the bar draws: what the travel is
  // useful over is not the same question as what a number may be.
  node.addEventListener('dblclick', event => {
    event.preventDefault()
    event.stopPropagation()

    const typed = window.prompt(label, String(Math.round(get() * 100000) / 100000))
    if (typed == null) return

    const value = Number(typed)
    if (!Number.isFinite(value)) return

    set(value)
    refresh()
    if (settled) settled(get())
  })

  node.refresh = refresh
  refresh()

  return node
}
