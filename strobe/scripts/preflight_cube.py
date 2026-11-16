"""Preflight: one 540x960 frame of a cube with the final render settings. Reports device + s/frame."""
import bpy, time, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
dev = 'CPU'
for t in ('OPTIX', 'CUDA', 'METAL', 'HIP'):
    try:
        prefs.compute_device_type = t
        prefs.get_devices()
        if any(d.type == t for d in prefs.devices):
            dev = t; break
    except Exception:
        pass
sc.cycles.device = 'GPU' if dev != 'CPU' else 'CPU'
sc.cycles.samples = 128; sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.03
sc.cycles.use_denoising = True; sc.cycles.denoiser = 'OPTIX' if dev == 'OPTIX' else 'OPENIMAGEDENOISE'
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 540, 960, 100
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Khronos PBR Neutral'; sc.view_settings.exposure = -1
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'; sc.render.image_settings.color_depth = '16'
sc.render.use_motion_blur = True
bpy.ops.mesh.primitive_cube_add(size=1); cube = bpy.context.object
bpy.ops.object.modifier_add(type='BEVEL')
m = bpy.data.materials.new('glass3'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputMaterial'); prev = None
for col, ior in (((1, 0, 0, 1), 1.47), ((0, 1, 0, 1), 1.51), ((0, 0, 1, 1), 1.57)):
    g = nt.nodes.new('ShaderNodeBsdfGlass'); g.inputs['Color'].default_value = col; g.inputs['IOR'].default_value = ior; g.inputs['Roughness'].default_value = 0.02
    if prev is None: prev = g
    else:
        a = nt.nodes.new('ShaderNodeAddShader'); nt.links.new(prev.outputs[0], a.inputs[0]); nt.links.new(g.outputs[0], a.inputs[1]); prev = a
nt.links.new(prev.outputs[0], out.inputs[0]); cube.data.materials.append(m)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.8, 0.8, 0.85, 1)
bpy.ops.object.light_add(type='AREA', location=(2, -2, 3)); bpy.context.object.data.energy = 300
bpy.ops.object.camera_add(location=(2.2, -2.6, 1.6)); cam = bpy.context.object; sc.camera = cam
c = cam.constraints.new('TRACK_TO'); c.target = cube
sc.render.filepath = sys.argv[-1]
t = time.time(); bpy.ops.render.render(write_still=True)
print(f"PREFLIGHT device={dev} blender={bpy.app.version_string} sec_per_frame_540x960={time.time()-t:.1f}")
