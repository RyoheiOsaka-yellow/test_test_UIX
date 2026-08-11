/** Recursively free GPU resources under an object and detach it from its parent. */
export function disposeObject(root) {
  if (!root) return;
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    const mat = node.material;
    if (!mat) return;
    const list = Array.isArray(mat) ? mat : [mat];
    for (const m of list) {
      for (const key of Object.keys(m)) {
        const value = m[key];
        if (value && value.isTexture) value.dispose();
      }
      m.dispose();
    }
  });
  root.parent?.remove(root);
}
