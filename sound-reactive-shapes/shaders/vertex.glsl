// Fullscreen triangle/quad pass-through. All work happens in the fragment stage.
void main() {
  gl_Position = vec4(position, 1.0);
}
